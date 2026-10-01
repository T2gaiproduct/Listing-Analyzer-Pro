import { and, eq, inArray } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
  type GeneratedContent,
} from "@workspace/db";
import { TARGET_MARKETPLACES } from "./create-product.js";
import { ebayAsin, ebaySkuFromAsin } from "./ebay-import-utils.js";
import type { EbayListingMigrateResult } from "./ebay-listing-migrate.js";
import { generatedEbayListingSku } from "./ebay-listing-sku.js";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import {
  fetchEbayTradingItemDetails,
  type EbayActiveListing,
  type EbayTradingItemDetails,
} from "./ebay-trading-client.js";
import type { ShopifySyncResult } from "./shopify-product-sync.js";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const SANDBOX_LISTING_URL = "https://www.sandbox.ebay.com/itm";

function buildGeneratedContent(descriptionHtml: string | null): GeneratedContent | null {
  if (!descriptionHtml) return null;
  return { title: "", bulletPoints: [], keywords: [], htmlDescription: descriptionHtml };
}

async function loadExistingEbayAudits(
  workspaceId: number,
  skus: string[],
): Promise<Map<string, number>> {
  if (skus.length === 0) return new Map();
  const asins = skus.map(ebayAsin);
  const rows = await db
    .select({ id: auditsTable.id, asin: auditsTable.asin })
    .from(auditsTable)
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
      inArray(auditsTable.asin, asins),
    ));

  const map = new Map<string, number>();
  for (const row of rows) {
    const sku = ebaySkuFromAsin(row.asin);
    if (sku) map.set(sku, row.id);
  }
  return map;
}

/** Map wizard product id (SKU or item id) → eBay ItemID. */
export function resolveEbayItemIdFromProductId(
  productId: string,
  activeListings: EbayActiveListing[],
): string | null {
  const id = productId.trim();
  if (!id) return null;
  if (/^\d{6,}$/.test(id)) return id;
  if (id.startsWith("SL-")) {
    const itemId = id.slice(3).trim();
    return itemId || null;
  }
  const bySku = activeListings.find((row) => row.sku?.trim() === id);
  if (bySku) return bySku.itemId;
  return null;
}

function listingTargetsForSandboxFallback(input: {
  productIds?: string[];
  importLimit: number;
  migration: EbayListingMigrateResult;
  inventorySkusImported: Set<string>;
}): EbayActiveListing[] {
  const listings = input.migration.activeListings;
  if (input.productIds?.length) {
    const targets: EbayActiveListing[] = [];
    for (const productId of input.productIds) {
      const itemId = resolveEbayItemIdFromProductId(productId, listings);
      if (!itemId) continue;
      const listing = listings.find((row) => row.itemId === itemId);
      if (!listing) continue;
      const sku = listing.sku?.trim() || generatedEbayListingSku(itemId);
      if (input.inventorySkusImported.has(sku)) continue;
      targets.push(listing);
    }
    return targets;
  }

  const targets: EbayActiveListing[] = [];
  for (const listing of listings) {
    const sku = listing.sku?.trim() || generatedEbayListingSku(listing.itemId);
    if (input.inventorySkusImported.has(sku)) continue;
    targets.push(listing);
    if (targets.length >= input.importLimit) break;
  }
  return targets;
}

async function upsertAuditFromTradingItem(input: {
  workspaceId: number;
  ownerId: string;
  createdByUserId: string | null;
  details: EbayTradingItemDetails;
  existingAudits: Map<string, number>;
  result: ShopifySyncResult;
}): Promise<void> {
  const sku = input.details.sku.trim();
  const title = input.details.title.trim();
  if (!sku || !title) {
    input.result.errors.push({
      handle: input.details.itemId,
      error: "Missing SKU or title from eBay listing",
    });
    return;
  }

  const imageUrls = input.details.imageUrls.slice(0, 9);
  const storeDescriptionHtml = input.details.descriptionHtml;
  const listingUrl = `${SANDBOX_LISTING_URL}/${input.details.itemId}`;

  if (input.existingAudits.has(sku)) {
    const auditId = input.existingAudits.get(sku)!;
    try {
      await db
        .update(auditsTable)
        .set({
          projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          title,
          bulletPoints: [],
          imageUrls,
          storeDescriptionHtml,
          updatedAt: new Date(),
        })
        .where(eq(auditsTable.id, auditId));
      input.result.updated += 1;
      input.result.skipped += 1;
    } catch (err) {
      input.result.errors.push({
        handle: sku,
        error: err instanceof Error ? err.message : "Refresh failed",
      });
    }
    return;
  }

  try {
    const generatedContent = buildGeneratedContent(storeDescriptionHtml);
    const [audit] = await db
      .insert(auditsTable)
      .values({
        userId: input.ownerId,
        createdByUserId: input.createdByUserId,
        workspaceId: input.workspaceId,
        projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
        productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
        asin: ebayAsin(sku),
        brandName: null,
        category: null,
        title,
        bulletPoints: [],
        imageUrls,
        targetKeywords: [],
        storeDescriptionHtml,
        generatedContent,
        overallScore: 0,
        status: "pending",
        currentStep: 1,
      })
      .returning();

    await db.insert(productProfilesTable).values({
      auditId: audit.id,
      sku,
      priority: "medium",
      workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
      targetMarketplaces: ["eBay"],
    });

    await db.insert(productMarketplaceListingsTable).values(
      TARGET_MARKETPLACES.map((marketplace) => ({
        auditId: audit.id,
        workspaceId: input.workspaceId,
        marketplace,
        status: marketplace === "eBay" ? "live" : "not_listed",
        sku: marketplace === "eBay" ? sku : null,
        priceCents: null,
        currency: "USD",
        listingUrl: marketplace === "eBay" ? listingUrl : null,
        publishedAt: marketplace === "eBay" ? new Date() : null,
        inventory: null,
      })),
    );

    input.existingAudits.set(sku, audit.id);
    input.result.imported += 1;
    input.result.pendingAuditIds.push(audit.id);
    input.result.products.push({
      id: audit.id,
      name: audit.projectName ?? audit.productName,
      sku,
      handle: sku,
      detailUrl: `/products/${audit.id}`,
      workflowUrl: `/audits/workflow?resume=${audit.id}`,
    });
  } catch (err) {
    input.result.errors.push({
      handle: sku,
      error: err instanceof Error ? err.message : "Import failed",
    });
  }
}

/**
 * Sandbox-only: import listings via Trading GetItem when inventory migrate is not available.
 * Production must never call this.
 */
export async function importEbaySandboxListingsViaTrading(input: {
  workspaceId: number;
  ownerId: string;
  createdByUserId: string | null;
  environment: EbayOAuthEnvironment;
  accessToken: string;
  migration: EbayListingMigrateResult;
  productIds?: string[];
  importLimit: number;
  inventorySkusImported: Set<string>;
  baseResult: ShopifySyncResult;
}): Promise<ShopifySyncResult> {
  if (input.environment !== "sandbox") {
    return input.baseResult;
  }

  const targets = listingTargetsForSandboxFallback({
    productIds: input.productIds,
    importLimit: input.importLimit,
    migration: input.migration,
    inventorySkusImported: input.inventorySkusImported,
  });
  if (targets.length === 0) {
    return input.baseResult;
  }

  const result = { ...input.baseResult, errors: [...input.baseResult.errors] };
  const skusForLookup = targets.map((row) => row.sku?.trim() || generatedEbayListingSku(row.itemId));
  const existingAudits = await loadExistingEbayAudits(input.workspaceId, skusForLookup);

  for (const listing of targets) {
    let details: EbayTradingItemDetails;
    try {
      details = await fetchEbayTradingItemDetails({
        environment: input.environment,
        accessToken: input.accessToken,
        itemId: listing.itemId,
      });
    } catch (err) {
      result.errors.push({
        handle: listing.itemId,
        error: err instanceof Error ? err.message : "GetItem failed",
      });
      continue;
    }

    if (!details.sku.trim()) {
      details = {
        ...details,
        sku: listing.sku?.trim() || generatedEbayListingSku(listing.itemId),
      };
    }
    if (!details.title.trim() && listing.title) {
      details = { ...details, title: listing.title };
    }

    await upsertAuditFromTradingItem({
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdByUserId: input.createdByUserId,
      details,
      existingAudits,
      result,
    });
  }

  result.total = result.imported + result.skipped;
  result.auditsQueued = result.pendingAuditIds.length;

  if (result.imported > 0 || result.updated > 0) {
    result.errors = result.errors.filter((row) => row.handle !== "ebay-migrate");
  }

  return result;
}
