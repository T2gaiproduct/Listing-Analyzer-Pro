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
import { purgeBlockingOffersForSku } from "./ebay-inventory-offers.js";
import {
  fetchEbayTradingItemDetails,
  reviseEbayListingContent,
  reviseEbayListingPrice,
} from "./ebay-trading-client.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import { materializeAuditImagesForPublish } from "./materialize-audit-images-for-publish.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  resolveInventoryOfferForListing,
  shouldUseInventoryApiAfterTradingReviseError,
  updateInventoryBasedEbayListing,
} from "./ebay-inventory-listing-update.js";
import {
  defaultEbayInventorySkuForAudit,
  isEbayOfferNotAvailableMessage,
  isInvalidEbayInventorySkuError,
  isValidEbayInventorySku,
  normalizeToEbayInventorySku,
  pickEbayInventorySkuForApi,
  resolveEbayInventorySku,
} from "./ebay-listing-sku.js";

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

async function publishInventoryBasedEbayListing(
  input: {
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
  },
  offerRow?: Awaited<ReturnType<typeof resolveInventoryOfferForListing>>,
): Promise<EbayPublishResult> {
  const resolvedOffer = offerRow ?? await resolveInventoryOfferForListing({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId: input.itemId,
    skuCandidates: buildInventorySkuCandidates({
      auditId: input.auditId,
      listingSku: input.listingRow?.sku,
      profileSku: await loadProfileSku(input.auditId),
    }),
  });
  if (!resolvedOffer) {
    throw new Error(
      "This eBay listing was created with inventory management. SellerLens could not find the matching inventory offer — try reconnecting eBay or contact support.",
    );
  }

  const { listingId, inventorySku, warning: inventoryWarning } = await updateInventoryBasedEbayListing({
    environment: input.environment,
    accessToken: input.accessToken,
    offerRow: resolvedOffer,
    listingId: input.itemId,
    auditId: input.auditId,
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
        sku: inventorySku,
        listingUrl,
        priceCents: input.priceCents ?? input.listingRow.priceCents,
        currency: input.currency || input.listingRow.currency,
        publishedAt: input.listingRow.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, input.listingRow.id));
    await syncEbayMarketplaceSkuFromListing({
      environment: input.environment,
      accessToken: input.accessToken,
      itemId: listingId,
      listingRowId: input.listingRow.id,
    });
  }

  return {
    itemId: listingId,
    listingUrl,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

function shouldFallbackToInventoryReviseError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return shouldUseInventoryApiAfterTradingReviseError(message);
}

async function tryPublishInventoryListingFirst(
  input: Parameters<typeof publishInventoryBasedEbayListing>[0],
): Promise<EbayPublishResult | null> {
  const skuCandidates = buildInventorySkuCandidates({
    auditId: input.auditId,
    listingSku: input.listingRow?.sku,
    profileSku: await loadProfileSku(input.auditId),
  });
  const offerRow = await resolveInventoryOfferForListing({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId: input.itemId,
    skuCandidates,
    listingIdOnly: true,
  });
  if (!offerRow) return null;
  try {
    return await publishInventoryBasedEbayListing(input, offerRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isEbayOfferNotAvailableMessage(message) && !isInvalidEbayInventorySkuError(message)) {
      throw err;
    }
    for (const sku of skuCandidates) {
      if (!isValidEbayInventorySku(sku)) continue;
      await purgeBlockingOffersForSku({
        environment: input.environment,
        accessToken: input.accessToken,
        sku,
      }).catch(() => undefined);
    }
    const retryOffer = await resolveInventoryOfferForListing({
      environment: input.environment,
      accessToken: input.accessToken,
      listingId: input.itemId,
      skuCandidates,
      listingIdOnly: true,
    });
    if (retryOffer) {
      try {
        return await publishInventoryBasedEbayListing(input, retryOffer);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function tryInventoryPushAfterTradingFailure(
  input: Parameters<typeof publishInventoryBasedEbayListing>[0],
  tradingErr: unknown,
): Promise<EbayPublishResult> {
  const tradingMessage = tradingErr instanceof Error ? tradingErr.message : String(tradingErr);
  try {
    const details = await fetchEbayTradingItemDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      itemId: input.itemId,
    });
    const ebayCustomLabel = details.sku?.trim() || "";
    if (ebayCustomLabel && !isValidEbayInventorySku(ebayCustomLabel)) {
      throw new Error(
        `${tradingMessage} This listing's eBay custom label (SKU) is "${ebayCustomLabel}". `
        + "SellerLens cannot use the Inventory API for hyphenated SKUs. "
        + "Deploy the latest API so Push uses Trading first, or change the custom label in eBay sandbox to alphanumeric only (e.g. WALLAMP0880), then push again.",
      );
    }
  } catch (lookupErr) {
    if (lookupErr instanceof Error && lookupErr.message.includes("custom label")) {
      throw lookupErr;
    }
  }

  const inventory = await tryPublishInventoryListingFirst(input);
  if (inventory) return inventory;
  throw tradingErr instanceof Error ? tradingErr : new Error(String(tradingErr));
}

async function syncEbayMarketplaceSkuFromListing(input: {
  environment: "sandbox" | "production";
  accessToken: string;
  itemId: string;
  listingRowId: number;
}): Promise<void> {
  try {
    const details = await fetchEbayTradingItemDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      itemId: input.itemId,
    });
    const ebaySku = details.sku?.trim();
    if (!ebaySku) return;
    await db
      .update(productMarketplaceListingsTable)
      .set({ sku: ebaySku, updatedAt: new Date() })
      .where(eq(productMarketplaceListingsTable.id, input.listingRowId));
  } catch {
    // non-fatal
  }
}

async function loadProfileSku(auditId: number): Promise<string | null | undefined> {
  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, auditId))
    .limit(1);
  return profile?.sku;
}

function buildInventorySkuCandidates(input: {
  auditId: number;
  listingSku: string | null | undefined;
  profileSku: string | null | undefined;
}): string[] {
  const skuCandidates: string[] = [defaultEbayInventorySkuForAudit(input.auditId)];
  const pushCandidate = (raw: string | null | undefined) => {
    if (isValidEbayInventorySku(raw)) {
      skuCandidates.push(raw!.trim());
      return;
    }
    const normalized = normalizeToEbayInventorySku(raw);
    if (normalized && isValidEbayInventorySku(normalized)) {
      skuCandidates.push(normalized);
    }
  };
  pushCandidate(input.listingSku);
  pushCandidate(input.profileSku);
  try {
    skuCandidates.push(resolveEbayInventorySku({
      profileSku: input.profileSku,
      listingSku: input.listingSku,
      auditId: input.auditId,
    }));
  } catch {
    // ignore
  }
  return [...new Set(skuCandidates)];
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
      return tryInventoryPushAfterTradingFailure(inventoryPublishInput, err);
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
        return tryInventoryPushAfterTradingFailure(inventoryPublishInput, err);
      }
      const message = err instanceof Error ? err.message : "Price update failed";
      warnings.push(`Listing content was updated but price could not be changed: ${message}`);
    }
  } else {
    warnings.push("Price was not updated — set a price in Product Explorer overview and push again.");
  }

  const now = new Date();
  const tradingPersistSku = pickEbayInventorySkuForApi({
    offerSku: null,
    rowSku: listingRow?.sku,
    auditId: input.audit.id,
  });
  if (listingRow) {
    await db
      .update(productMarketplaceListingsTable)
      .set({
        status: "live",
        sku: isValidEbayInventorySku(listingRow.sku) ? listingRow.sku!.trim() : tradingPersistSku,
        listingUrl,
        priceCents: priceCents ?? listingRow.priceCents,
        currency: currency || listingRow.currency,
        publishedAt: listingRow.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(productMarketplaceListingsTable.id, listingRow.id));
    await syncEbayMarketplaceSkuFromListing({
      environment,
      accessToken,
      itemId,
      listingRowId: listingRow.id,
    });
  }

  return {
    itemId,
    listingUrl,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
