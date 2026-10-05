import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  parseEbayItemIdFromListingUrl,
  parseEbayItemIdFromSku,
} from "./ebay-import-utils.js";
import { buildEbayListingDescriptionHtml } from "./ebay-listing-description.js";
import { truncateEbayListingTitle } from "./ebay-item-specific-limits.js";
import { resolveEbayHostedPictureUrls } from "./ebay-publish-images.js";
import { resolveEbayAccessToken } from "./ebay-inventory-client.js";
import {
  reviseEbayListingContent,
  reviseEbayListingPrice,
} from "./ebay-trading-client.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import { materializeAuditImagesForPublish } from "./materialize-audit-images-for-publish.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  isInventoryBasedListingReviseError,
  resolveInventoryOfferForListing,
  updateInventoryBasedEbayListing,
} from "./ebay-inventory-listing-update.js";
import { generatedEbayListingSku } from "./ebay-listing-sku.js";

export type EbayPublishResult = {
  itemId: string;
  listingUrl: string;
  warning?: string;
};

function productionListingUrl(environment: "sandbox" | "production", itemId: string): string {
  const host = environment === "sandbox" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${host}/itm/${itemId}`;
}

async function resolveEbayPublishPriceCents(auditId: number): Promise<{
  priceCents: number | null;
  currency: string;
}> {
  const [ebayRow] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.marketplace, "eBay"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  if (ebayRow?.priceCents != null && ebayRow.priceCents > 0) {
    return {
      priceCents: ebayRow.priceCents,
      currency: ebayRow.currency?.trim() || "USD",
    };
  }

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

  const any = rows.find((row) => row.priceCents != null && row.priceCents > 0);
  if (!any?.priceCents) {
    return { priceCents: null, currency: "USD" };
  }
  return {
    priceCents: any.priceCents,
    currency: any.currency?.trim() || "USD",
  };
}

function isEbayTransientReviseError(message: string): boolean {
  return /trouble updating your listing|try again later|system error|internal error/i.test(message);
}

async function reviseListingContentWithPictureFallback(input: {
  environment: "sandbox" | "production";
  accessToken: string;
  itemId: string;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
}): Promise<string | undefined> {
  const warnings: string[] = [];
  const attempts: Array<{ pictureUrls: string[]; descriptionHtml: string; label: string }> = [
    { pictureUrls: input.pictureUrls, descriptionHtml: input.descriptionHtml, label: "full" },
    { pictureUrls: [], descriptionHtml: input.descriptionHtml, label: "no-gallery" },
    { pictureUrls: [], descriptionHtml: "", label: "title-only" },
  ];

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    if (attempt.label === "no-gallery" && input.pictureUrls.length === 0) continue;
    if (attempt.label === "title-only" && !lastError) break;
    try {
      await reviseEbayListingContent({
        environment: input.environment,
        accessToken: input.accessToken,
        itemId: input.itemId,
        title: input.title,
        descriptionHtml: attempt.descriptionHtml,
        pictureUrls: attempt.pictureUrls,
      });
      if (attempt.label === "no-gallery" && input.pictureUrls.length > 0) {
        warnings.push("Gallery images could not be applied on eBay; title and description were updated.");
      } else if (attempt.label === "title-only") {
        warnings.push(
          "eBay only accepted a title update this time. Try push again later for description and images.",
        );
      }
      return warnings.length > 0 ? warnings.join(" ") : undefined;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isEbayTransientReviseError(lastError.message) && attempt.label === "full") {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("eBay listing update failed.");
}

async function publishInventoryBasedEbayListing(input: {
  environment: "sandbox" | "production";
  accessToken: string;
  auditId: number;
  itemId: string;
  listingRow: typeof productMarketplaceListingsTable.$inferSelect | undefined;
  listingUrl: string;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
  priceCents: number | null;
  currency: string;
  imageWarning?: string;
}): Promise<EbayPublishResult> {
  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, input.auditId))
    .limit(1);

  const skuCandidates = [
    input.listingRow?.sku,
    profile?.sku,
    `SL-${input.auditId}`,
    generatedEbayListingSku(input.itemId),
  ].filter((sku): sku is string => Boolean(sku?.trim()));

  const offerRow = await resolveInventoryOfferForListing({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId: input.itemId,
    skuCandidates,
  });
  if (!offerRow) {
    throw new Error(
      "This eBay listing was created with inventory management. SellerLens could not find the matching inventory offer — try reconnecting eBay or contact support.",
    );
  }

  const { listingId, warning: inventoryWarning } = await updateInventoryBasedEbayListing({
    environment: input.environment,
    accessToken: input.accessToken,
    offerRow,
    title: input.title,
    descriptionHtml: input.descriptionHtml,
    pictureUrls: input.pictureUrls,
    priceCents: input.priceCents,
    currency: input.currency,
  });

  const listingUrl = input.listingRow?.listingUrl?.trim()
    || productionListingUrl(input.environment, listingId);
  const warnings: string[] = [];
  if (input.imageWarning) warnings.push(input.imageWarning);
  if (inventoryWarning) warnings.push(inventoryWarning);

  const now = new Date();
  if (input.listingRow) {
    await db
      .update(productMarketplaceListingsTable)
      .set({
        status: "live",
        sku: input.listingRow.sku ?? generatedEbayListingSku(listingId),
        listingUrl,
        priceCents: input.priceCents ?? input.listingRow.priceCents,
        currency: input.currency || input.listingRow.currency,
        publishedAt: input.listingRow.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, input.listingRow.id));
  }

  return {
    itemId: listingId,
    listingUrl,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

function shouldFallbackToInventoryReviseError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return isInventoryBasedListingReviseError(message);
}

export async function publishListingToEbay(input: {
  workspaceId: number;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[] | null;
  graphicsProjectId?: number | null;
  publicBaseUrl: string;
}): Promise<EbayPublishResult> {
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

  const itemId = parseEbayItemIdFromListingUrl(listingRow?.listingUrl)
    ?? parseEbayItemIdFromSku(listingRow?.sku);
  if (!itemId) {
    throw new Error(
      "This product is not linked to an eBay listing. Use Marketplaces → List as new on eBay (sandbox), or import an existing listing to push updates.",
    );
  }

  const listingUrl = listingRow?.listingUrl?.trim() || productionListingUrl(connection.environment, itemId);

  const content = resolveListingContentForExport(input.audit);
  const title = truncateEbayListingTitle(content.title?.trim() ?? "");
  if (!title) {
    throw new Error("Add a listing title before publishing to eBay.");
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

  const descriptionHtml = buildEbayListingDescriptionHtml({
    htmlDescription: content.htmlDescription?.trim()
      || input.audit.storeDescriptionHtml?.trim()
      || "",
    bulletPoints: content.bulletPoints ?? [],
    keywords: content.keywords ?? [],
    category: input.audit.category,
  });

  const { priceCents, currency } = await resolveEbayPublishPriceCents(input.audit.id);

  const inventoryPublishInput = {
    environment,
    accessToken,
    auditId: input.audit.id,
    itemId,
    listingRow,
    listingUrl,
    title,
    descriptionHtml,
    pictureUrls,
    priceCents,
    currency,
    imageWarning,
  };

  let pictureFallbackWarning: string | undefined;
  try {
    pictureFallbackWarning = await reviseListingContentWithPictureFallback({
      environment,
      accessToken,
      itemId,
      title,
      descriptionHtml,
      pictureUrls,
    });
  } catch (err) {
    if (shouldFallbackToInventoryReviseError(err)) {
      return publishInventoryBasedEbayListing(inventoryPublishInput);
    }
    throw err;
  }

  const warnings: string[] = [];
  if (imageWarning) warnings.push(imageWarning);
  if (pictureFallbackWarning) warnings.push(pictureFallbackWarning);

  if (priceCents != null && priceCents > 0) {
    try {
      await reviseEbayListingPrice({
        environment,
        accessToken,
        itemId,
        priceCents,
        currency,
      });
    } catch (err) {
      if (shouldFallbackToInventoryReviseError(err)) {
        return publishInventoryBasedEbayListing(inventoryPublishInput);
      }
      const message = err instanceof Error ? err.message : "Price update failed";
      warnings.push(`Listing content was updated but price could not be changed: ${message}`);
    }
  } else {
    warnings.push("Price was not updated — set a price in Product Explorer overview and push again.");
  }

  const now = new Date();
  if (listingRow) {
    await db
      .update(productMarketplaceListingsTable)
      .set({
        status: "live",
        sku: listingRow.sku ?? `SL-${itemId}`,
        listingUrl,
        priceCents: priceCents ?? listingRow.priceCents,
        currency: currency || listingRow.currency,
        publishedAt: listingRow.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, listingRow.id));
  }

  return {
    itemId,
    listingUrl,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
