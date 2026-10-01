import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable } from "@workspace/db";
import {
  parseEbayItemIdFromListingUrl,
  parseEbayItemIdFromSku,
} from "./ebay-import-utils.js";
import { resolveEbayAccessToken } from "./ebay-inventory-client.js";
import { reviseEbayListingContent } from "./ebay-trading-client.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import {
  materializeAuditImagesForPublish,
  resolvePublishImageUrlsFromAudit,
} from "./materialize-audit-images-for-publish.js";
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

  const pictureUrls = resolvePublishImageUrlsFromAudit({
    audit: auditAfterImages,
    graphicsImageRecords: input.graphicsImageRecords ?? undefined,
    graphicsProjectId: input.graphicsProjectId ?? null,
    publicBaseUrl: input.publicBaseUrl,
    maxImages: 12,
  });

  const descriptionHtml = content.htmlDescription?.trim()
    || input.audit.storeDescriptionHtml?.trim()
    || "";

  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  if (environment !== connection.environment) {
    throw new Error("eBay connection environment does not match the server token. Reconnect eBay on Marketplaces.");
  }

  await reviseEbayListingContent({
    environment,
    accessToken,
    itemId,
    title,
    descriptionHtml,
    pictureUrls,
  });

  const now = new Date();
  if (listingRow) {
    await db
      .update(productMarketplaceListingsTable)
      .set({
        status: "live",
        sku: listingRow.sku ?? `SL-${itemId}`,
        listingUrl,
        publishedAt: listingRow.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, listingRow.id));
  }

  let warning: string | undefined;
  if (pictureUrls.length === 0) {
    warning = "Title and description were updated on eBay; no gallery images were sent (add images in Graphics or use public image URLs).";
  }

  return { itemId, listingUrl, warning };
}
