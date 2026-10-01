import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable } from "@workspace/db";
import {
  parseEbayItemIdFromListingUrl,
  parseEbayItemIdFromSku,
} from "./ebay-import-utils.js";
import { buildEbayListingDescriptionHtml } from "./ebay-listing-description.js";
import { resolveEbayHostedPictureUrls } from "./ebay-publish-images.js";
import { resolveEbayAccessToken } from "./ebay-inventory-client.js";
import {
  fetchEbayTradingItemDetails,
  reviseEbayListingContent,
  type EbayItemSpecific,
} from "./ebay-trading-client.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import { materializeAuditImagesForPublish } from "./materialize-audit-images-for-publish.js";
import { sanitizeEbayItemSpecificValues } from "./ebay-item-specific-limits.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";

export type EbayPublishResult = {
  itemId: string;
  listingUrl: string;
  warning?: string;
};

function productionListingUrl(environment: "sandbox" | "production", itemId: string): string {
  const host = environment === "sandbox" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${host}/itm/${itemId}`;
}

function buildEbayItemSpecifics(input: {
  keywords: string[];
  category?: string | null;
}): EbayItemSpecific[] {
  const specifics: EbayItemSpecific[] = [];
  // Full bullet copy lives in the HTML description; eBay item specifics allow max 65 chars per value.
  const keywords = sanitizeEbayItemSpecificValues(
    input.keywords.map((k) => k.trim()).filter(Boolean),
  ).slice(0, 10);
  if (keywords.length > 0) {
    specifics.push({ name: "Tags", values: keywords });
  }
  const categoryValues = sanitizeEbayItemSpecificValues(
    input.category?.trim() ? [input.category.trim()] : [],
  );
  if (categoryValues.length > 0) {
    specifics.push({ name: "Type", values: categoryValues });
  }
  return specifics;
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
      "This product is not linked to an eBay listing. Import it from eBay first so SellerLens knows which Item ID to update.",
    );
  }

  const listingUrl = listingRow?.listingUrl?.trim() || productionListingUrl(connection.environment, itemId);

  const content = resolveListingContentForExport(input.audit);
  const title = content.title?.trim();
  if (!title) {
    throw new Error("Add a listing title before publishing to eBay.");
  }

  const auditAfterImages = await materializeAuditImagesForPublish(input.audit);

  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  if (environment !== connection.environment) {
    throw new Error("eBay connection environment does not match the server token. Reconnect eBay on Marketplaces.");
  }

  const existingItem = await fetchEbayTradingItemDetails({
    environment,
    accessToken,
    itemId,
  });

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
  const itemSpecifics = buildEbayItemSpecifics({
    keywords: content.keywords ?? [],
    category: input.audit.category,
  });

  await reviseEbayListingContent({
    environment,
    accessToken,
    itemId,
    title,
    descriptionHtml,
    pictureUrls,
    priceCents,
    currency,
    primaryCategoryId: existingItem.primaryCategoryId,
    itemSpecifics,
  });

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

  const warnings: string[] = [];
  if (imageWarning) warnings.push(imageWarning);
  if (pictureUrls.length === 0) {
    warnings.push("Title and description were updated; no gallery images were sent.");
  }
  if (priceCents == null || priceCents <= 0) {
    warnings.push("Price was not updated — set a price in Product Explorer overview and push again.");
  }

  return {
    itemId,
    listingUrl,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
