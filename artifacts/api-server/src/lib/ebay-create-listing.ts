import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable } from "@workspace/db";
import {
  parseEbayItemIdFromListingUrl,
  parseEbayItemIdFromSku,
} from "./ebay-import-utils.js";
import { buildEbayListingDescriptionHtml } from "./ebay-listing-description.js";
import {
  sanitizeEbayItemSpecificValues,
  truncateEbayItemSpecificValue,
  truncateEbayListingTitle,
} from "./ebay-item-specific-limits.js";
import { fetchEbayCategoryAspects, type EbayCategoryAspectField } from "./ebay-taxonomy.js";
import { resolveEbayHostedPictureUrls } from "./ebay-publish-images.js";
import { resolveEbayAccessToken } from "./ebay-inventory-client.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import { materializeAuditImagesForPublish } from "./materialize-audit-images-for-publish.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  createAndPublishEbayOffer,
  ebayListingUrl,
  purgeBlockingOffersForSku,
  resolveEbayMerchantLocationKey,
  upsertEbayInventoryItem,
} from "./ebay-inventory-offers.js";
import {
  alternateEbayInventorySkuForAudit,
  defaultEbayInventorySkuForAudit,
  isEbayOfferNotAvailableMessage,
} from "./ebay-listing-sku.js";

export type CreateEbayListingInput = {
  workspaceId: number;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[] | null;
  graphicsProjectId?: number | null;
  publicBaseUrl: string;
  primaryCategoryId: string;
  quantity?: number;
  condition?: "NEW" | "LIKE_NEW" | "USED_EXCELLENT";
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  itemAspects?: Record<string, string>;
};

export type CreateEbayListingResult = {
  itemId: string;
  listingUrl: string;
  sku: string;
  warning?: string;
};

function buildAspectsForInventory(
  fields: EbayCategoryAspectField[],
  input: Record<string, string> | undefined,
): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};
  for (const field of fields) {
    const raw = input?.[field.name]?.trim();
    if (!raw) continue;
    let value = truncateEbayItemSpecificValue(raw);
    if (field.selectionOnly && field.values.length > 0) {
      const match = field.values.find((v) => v.toLowerCase() === value.toLowerCase());
      value = match ?? field.values[0]!;
    }
    const sanitized = sanitizeEbayItemSpecificValues([value]);
    if (sanitized[0]) aspects[field.name] = sanitized;
  }
  return aspects;
}

function assertRequiredAspectsPresent(
  fields: EbayCategoryAspectField[],
  aspects: Record<string, string[]>,
): void {
  const missing = fields
    .filter((field) => field.required && !aspects[field.name]?.[0])
    .map((field) => field.name);
  if (missing.length > 0) {
    throw new Error(
      `Missing required eBay item specifics: ${missing.join(", ")}. Fill them in the List on eBay dialog and try again.`,
    );
  }
}

async function resolveEbayPublishPriceCents(auditId: number): Promise<{
  priceCents: number | null;
  currency: string;
}> {
  const rows = await db
    .select({
      marketplace: productMarketplaceListingsTable.marketplace,
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  const ebay = rows.find((row) => row.marketplace === "eBay");
  if (ebay?.priceCents != null && ebay.priceCents > 0) {
    return { priceCents: ebay.priceCents, currency: ebay.currency?.trim() || "USD" };
  }
  const any = rows.find((row) => row.priceCents != null && row.priceCents > 0);
  if (!any?.priceCents) return { priceCents: null, currency: "USD" };
  return { priceCents: any.priceCents, currency: any.currency?.trim() || "USD" };
}

export async function createNewEbayListingFromAudit(
  input: CreateEbayListingInput,
): Promise<CreateEbayListingResult> {
  const connection = await getEbayWorkspaceConnection(input.workspaceId);
  if (!connection) {
    throw new Error("Connect your eBay seller account on the Marketplaces page before publishing.");
  }
  if (!isEbayTradingApiConfigured(connection.environment)) {
    throw new Error(
      "eBay Trading API keys are not configured on the server. Contact support to enable eBay publish.",
    );
  }

  const [listingRow] = await db
    .select()
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "eBay"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const existingItemId = parseEbayItemIdFromListingUrl(listingRow?.listingUrl)
    ?? parseEbayItemIdFromSku(listingRow?.sku);
  if (existingItemId) {
    throw new Error(
      "This product is already linked to an eBay listing. Use Push to eBay listing to update it.",
    );
  }

  const categoryId = input.primaryCategoryId.trim();
  if (!categoryId) {
    throw new Error("Select an eBay category before publishing.");
  }

  const content = resolveListingContentForExport(input.audit);
  const title = truncateEbayListingTitle(content.title?.trim() ?? "");
  if (!title) {
    throw new Error("Add a listing title before publishing to eBay.");
  }

  const { priceCents, currency } = await resolveEbayPublishPriceCents(input.audit.id);
  if (priceCents == null || priceCents <= 0) {
    throw new Error("Set a price on this product before publishing to eBay.");
  }

  // One inventory SKU per SellerLens product — avoids sandbox junk on profile/custom SKUs.
  let inventorySku = defaultEbayInventorySkuForAudit(input.audit.id);
  let forceFreshOffer = false;
  let skuRetryWarning: string | undefined;

  if (!input.fulfillmentPolicyId?.trim()
    || !input.paymentPolicyId?.trim()
    || !input.returnPolicyId?.trim()) {
    throw new Error(
      "eBay business policies are required. Open List on eBay and select shipping, payment, and return policies.",
    );
  }

  const auditAfterImages = await materializeAuditImagesForPublish(input.audit);
  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  if (environment !== connection.environment) {
    throw new Error("eBay connection environment does not match the server token. Reconnect eBay on Marketplaces.");
  }

  const { urls: pictureUrls, warning: imageWarning } = await resolveEbayHostedPictureUrls({
    environment,
    accessToken,
    audit: auditAfterImages,
    graphicsImageRecords: input.graphicsImageRecords ?? undefined,
    graphicsProjectId: input.graphicsProjectId ?? null,
    publicBaseUrl: input.publicBaseUrl,
  });

  if (pictureUrls.length === 0) {
    throw new Error("Add at least one product or generated image before publishing to eBay.");
  }

  const descriptionHtml = buildEbayListingDescriptionHtml({
    htmlDescription: content.htmlDescription?.trim()
      || input.audit.storeDescriptionHtml?.trim()
      || "",
    bulletPoints: content.bulletPoints ?? [],
    keywords: content.keywords ?? [],
    category: input.audit.category,
  });

  const merchantLocationKey = await resolveEbayMerchantLocationKey({ environment, accessToken });
  const quantity = input.quantity ?? 1;
  const condition = input.condition ?? "NEW";

  const aspectFields = await fetchEbayCategoryAspects({
    environment,
    accessToken,
    categoryId,
  });
  const aspects = buildAspectsForInventory(aspectFields, input.itemAspects);
  assertRequiredAspectsPresent(aspectFields, aspects);

  const offerInput = {
    environment,
    accessToken,
    categoryId,
    priceCents,
    currency,
    quantity,
    fulfillmentPolicyId: input.fulfillmentPolicyId.trim(),
    paymentPolicyId: input.paymentPolicyId.trim(),
    returnPolicyId: input.returnPolicyId.trim(),
    merchantLocationKey,
    listingDescriptionHtml: descriptionHtml,
  };

  const upsertAndPublish = async (sku: string, fresh: boolean) => {
    await purgeBlockingOffersForSku({ environment, accessToken, sku });
    await upsertEbayInventoryItem({
      environment,
      accessToken,
      sku,
      title,
      descriptionHtml,
      imageUrls: pictureUrls,
      quantity,
      condition,
      aspects,
    });
    return createAndPublishEbayOffer({
      ...offerInput,
      sku,
      forceFreshOffer: fresh,
    });
  };

  let publishResult: Awaited<ReturnType<typeof createAndPublishEbayOffer>>;
  try {
    publishResult = await upsertAndPublish(inventorySku, forceFreshOffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isEbayOfferNotAvailableMessage(message)) {
      throw err;
    }
    inventorySku = alternateEbayInventorySkuForAudit(input.audit.id);
    forceFreshOffer = true;
    skuRetryWarning =
      "eBay sandbox still had a broken offer for this product. SellerLens retried with a new inventory SKU.";
    publishResult = await upsertAndPublish(inventorySku, forceFreshOffer);
  }

  const { listingId, warning: offerWarning } = publishResult;

  const listingUrl = ebayListingUrl(environment, listingId);
  const now = new Date();

  if (listingRow) {
    await db
      .update(productMarketplaceListingsTable)
      .set({
        status: "live",
        sku: inventorySku,
        listingUrl,
        priceCents,
        currency,
        inventory: quantity,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, listingRow.id));
  } else if (input.audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: input.audit.id,
      workspaceId: input.audit.workspaceId,
      marketplace: "eBay",
      status: "live",
      sku: inventorySku,
      listingUrl,
      priceCents,
      currency,
      inventory: quantity,
      publishedAt: now,
    });
  }

  const warnings = [imageWarning, offerWarning, skuRetryWarning].filter(Boolean);
  return {
    itemId: listingId,
    listingUrl,
    sku: inventorySku,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
