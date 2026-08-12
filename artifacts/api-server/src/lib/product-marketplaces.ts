import { and, eq, inArray } from "drizzle-orm";
import { db, productMarketplaceListingsTable, productProfilesTable, auditsTable } from "@workspace/db";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export type MarketplaceListingStatus = "live" | "pending" | "not_listed";

export interface MarketplaceListingRow {
  id: number;
  marketplace: string;
  status: MarketplaceListingStatus;
  statusLabel: string;
  sku: string | null;
  price: number | null;
  currency: string;
  inventory: number | null;
  publishedAt: string | null;
  listingUrl: string | null;
}

const MARKETPLACE_ORDER = ["Amazon", "Flipkart", "Shopsy", "Shopify", "WooCommerce", "Meesho"] as const;

const STATUS_LABELS: Record<MarketplaceListingStatus, string> = {
  live: "Live",
  pending: "Pending",
  not_listed: "Not Listed",
};

function mapListingRow(row: typeof productMarketplaceListingsTable.$inferSelect): MarketplaceListingRow {
  const status = row.status as MarketplaceListingStatus;
  return {
    id: row.id,
    marketplace: row.marketplace,
    status,
    statusLabel: STATUS_LABELS[status] ?? row.status,
    sku: row.sku,
    price: row.priceCents != null ? row.priceCents / 100 : null,
    currency: row.currency,
    inventory: row.inventory,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    listingUrl: row.listingUrl,
  };
}

function isRealAmazonAsin(asin: string | null | undefined): boolean {
  const trimmed = asin?.trim();
  if (!trimmed) return false;
  return !isShopifyImportAsin(trimmed) && !isWooCommerceImportAsin(trimmed);
}

/** Pending rows created only for SKU/price storage should not show as listed. */
function resolveEffectiveListingStatus(opts: {
  row: typeof productMarketplaceListingsTable.$inferSelect;
  asin: string | null | undefined;
  targetMarketplaces: string[];
}): MarketplaceListingStatus {
  const stored = opts.row.status as MarketplaceListingStatus;
  if (stored === "not_listed") return stored;
  if (stored === "live") return stored;

  const marketplace = opts.row.marketplace;
  const targets = new Set(opts.targetMarketplaces);
  const hasPublishEvidence = Boolean(opts.row.listingUrl?.trim() || opts.row.publishedAt);

  if (marketplace === "Shopify" && isShopifyImportAsin(opts.asin)) return stored;
  if (marketplace === "WooCommerce" && isWooCommerceImportAsin(opts.asin)) return stored;
  if (marketplace === "Amazon" && isRealAmazonAsin(opts.asin)) return stored;
  if (targets.has(marketplace)) return stored;
  if (hasPublishEvidence) return stored;

  return "not_listed";
}

function normalizeListingRow(
  row: typeof productMarketplaceListingsTable.$inferSelect,
  asin: string | null | undefined,
  targetMarketplaces: string[],
): MarketplaceListingRow {
  const effectiveStatus = resolveEffectiveListingStatus({ row, asin, targetMarketplaces });
  if (effectiveStatus === "not_listed") {
    return {
      id: 0,
      marketplace: row.marketplace,
      status: "not_listed",
      statusLabel: STATUS_LABELS.not_listed,
      sku: null,
      price: null,
      currency: row.currency,
      inventory: null,
      publishedAt: null,
      listingUrl: null,
    };
  }
  return mapListingRow({ ...row, status: effectiveStatus });
}

const LISTING_PRICE_PRIORITY = ["Shopify", "WooCommerce", "Amazon", "Flipkart", "Shopsy", "Meesho"] as const;

export async function resolveAuditListingPriceCents(auditId: number): Promise<{
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

  const byMarketplace = new Map(rows.map((row) => [row.marketplace, row]));
  const chosen = LISTING_PRICE_PRIORITY
    .map((marketplace) => byMarketplace.get(marketplace))
    .find((row) => row?.priceCents != null && row.priceCents > 0)
    ?? rows.find((row) => row.priceCents != null && row.priceCents > 0);

  if (!chosen?.priceCents) {
    return { priceCents: null, currency: "USD" };
  }

  return {
    priceCents: chosen.priceCents,
    currency: chosen.currency?.trim() || "USD",
  };
}

function findRawPriceFallback(
  rows: Array<typeof productMarketplaceListingsTable.$inferSelect>,
): { priceCents: number; currency: string } | null {
  const byMarketplace = new Map(rows.map((row) => [row.marketplace, row]));
  for (const marketplace of LISTING_PRICE_PRIORITY) {
    const row = byMarketplace.get(marketplace);
    if (row?.priceCents != null && row.priceCents > 0) {
      return { priceCents: row.priceCents, currency: row.currency?.trim() || "USD" };
    }
  }

  const anyPriced = rows.find((row) => row.priceCents != null && row.priceCents > 0);
  if (!anyPriced?.priceCents) return null;
  return { priceCents: anyPriced.priceCents, currency: anyPriced.currency?.trim() || "USD" };
}

async function backfillMissingListingPrices(
  listings: MarketplaceListingRow[],
  rawFallback: { priceCents: number; currency: string } | null,
): Promise<void> {
  if (!rawFallback) return;

  const price = rawFallback.priceCents / 100;
  for (const listing of listings) {
    if (listing.status === "not_listed") continue;
    if (listing.price != null && listing.price > 0) continue;
    if (listing.id <= 0) continue;

    await db
      .update(productMarketplaceListingsTable)
      .set({
        priceCents: rawFallback.priceCents,
        currency: listing.currency || rawFallback.currency,
        updatedAt: new Date(),
      })
      .where(eq(productMarketplaceListingsTable.id, listing.id));

    listing.price = price;
    listing.currency = listing.currency || rawFallback.currency;
  }
}

export async function listProductMarketplaces(auditId: number): Promise<{
  listings: MarketplaceListingRow[];
  activeCount: number;
  listedCount: number;
  liveMarketplaces: string[];
  listedMarketplaces: string[];
}> {
  const [audit] = await db
    .select({ asin: auditsTable.asin })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);

  const [profile] = await db
    .select({ targetMarketplaces: productProfilesTable.targetMarketplaces })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, auditId))
    .limit(1);

  const targetMarketplaces = (profile?.targetMarketplaces ?? []).filter(
    (marketplace): marketplace is string => typeof marketplace === "string",
  );

  const rows = await db
    .select()
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  const byMarketplace = new Map(rows.map((row) => [row.marketplace, row]));
  const listings = MARKETPLACE_ORDER.map((marketplace) => {
    const row = byMarketplace.get(marketplace);
    if (row) {
      return normalizeListingRow(row, audit?.asin, targetMarketplaces);
    }
    return {
      id: 0,
      marketplace,
      status: "not_listed" as const,
      statusLabel: "Not Listed",
      sku: null,
      price: null,
      currency: "USD",
      inventory: null,
      publishedAt: null,
      listingUrl: null,
    };
  });

  await backfillMissingListingPrices(listings, findRawPriceFallback(rows));

  const listed = listings.filter((listing) => listing.status !== "not_listed");
  const liveMarketplaces = listed
    .filter((listing) => listing.status === "live")
    .map((listing) => listing.marketplace);
  const listedMarketplaces = listed.map((listing) => listing.marketplace);

  return {
    listings,
    activeCount: liveMarketplaces.length,
    listedCount: listed.length,
    liveMarketplaces,
    listedMarketplaces,
  };
}

/** Live marketplace names per audit id from stored listing rows only. */
export async function listLiveChannelsForAudits(
  auditIds: number[],
): Promise<Map<number, string[]>> {
  const uniqueIds = [...new Set(auditIds.filter((id) => id > 0))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select({
      auditId: productMarketplaceListingsTable.auditId,
      marketplace: productMarketplaceListingsTable.marketplace,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      inArray(productMarketplaceListingsTable.auditId, uniqueIds),
      eq(productMarketplaceListingsTable.status, "live"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  const channelsByAuditId = new Map<number, string[]>();
  for (const row of rows) {
    const current = channelsByAuditId.get(row.auditId) ?? [];
    current.push(row.marketplace);
    channelsByAuditId.set(row.auditId, current);
  }

  return channelsByAuditId;
}

export type AuditCatalogExtras = {
  sku: string | null;
  price: number | null;
  stock: number | null;
  inStock: boolean | null;
  currency: string;
  isLiveOnShopify: boolean;
  isShopifyImport: boolean;
  isWooCommerceImport: boolean;
  referenceUrl: string | null;
};

export async function loadAuditCatalogExtras(
  auditIds: number[],
): Promise<Map<number, AuditCatalogExtras>> {
  const uniqueIds = [...new Set(auditIds.filter((id) => id > 0))];
  const result = new Map<number, AuditCatalogExtras>();
  if (uniqueIds.length === 0) return result;

  for (const id of uniqueIds) {
    result.set(id, {
      sku: null,
      price: null,
      stock: null,
      inStock: null,
      currency: "INR",
      isLiveOnShopify: false,
      isShopifyImport: false,
      isWooCommerceImport: false,
      referenceUrl: null,
    });
  }

  const audits = await db
    .select({
      id: auditsTable.id,
      asin: auditsTable.asin,
    })
    .from(auditsTable)
    .where(inArray(auditsTable.id, uniqueIds));

  const profiles = await db
    .select({
      auditId: productProfilesTable.auditId,
      sku: productProfilesTable.sku,
      referenceLinks: productProfilesTable.referenceLinks,
    })
    .from(productProfilesTable)
    .where(inArray(productProfilesTable.auditId, uniqueIds));

  const listings = await db
    .select({
      auditId: productMarketplaceListingsTable.auditId,
      marketplace: productMarketplaceListingsTable.marketplace,
      status: productMarketplaceListingsTable.status,
      priceCents: productMarketplaceListingsTable.priceCents,
      inventory: productMarketplaceListingsTable.inventory,
      currency: productMarketplaceListingsTable.currency,
      listingUrl: productMarketplaceListingsTable.listingUrl,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      inArray(productMarketplaceListingsTable.auditId, uniqueIds),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  for (const profile of profiles) {
    const entry = result.get(profile.auditId);
    if (entry && profile.sku?.trim()) {
      entry.sku = profile.sku.trim();
    }
    if (entry && profile.referenceLinks?.trim()) {
      entry.referenceUrl = profile.referenceLinks.trim();
    }
  }

  for (const audit of audits) {
    const entry = result.get(audit.id);
    if (!entry) continue;
    entry.isShopifyImport = isShopifyImportAsin(audit.asin);
    entry.isWooCommerceImport = isWooCommerceImportAsin(audit.asin);
  }

  for (const id of uniqueIds) {
    const productListings = listings.filter((row) => row.auditId === id);
    const entry = result.get(id)!;
    const shopifyListing = productListings.find((row) => row.marketplace === "Shopify");

    if (shopifyListing) {
      if (shopifyListing.priceCents != null) {
        entry.price = shopifyListing.priceCents / 100;
        entry.currency = shopifyListing.currency?.trim() || "INR";
      }
      if (shopifyListing.listingUrl?.trim() && !entry.referenceUrl) {
        entry.referenceUrl = shopifyListing.listingUrl.trim();
      }
      if (shopifyListing.inventory != null) {
        entry.stock = shopifyListing.inventory;
        entry.inStock = shopifyListing.inventory > 0;
      } else if (shopifyListing.status === "live") {
        entry.inStock = true;
      }
      if (shopifyListing.status === "live") {
        entry.isLiveOnShopify = true;
      }
    }

    if (entry.price != null) continue;

    const chosen = LISTING_PRICE_PRIORITY
      .map((marketplace) => productListings.find((row) => (
        row.marketplace === marketplace
        && row.status === "live"
        && row.priceCents != null
      )))
      .find(Boolean)
      ?? productListings.find((row) => row.priceCents != null);

    if (!chosen || chosen.priceCents == null) continue;

    entry.price = chosen.priceCents / 100;
    entry.stock = chosen.inventory;
    entry.currency = chosen.currency?.trim() || "INR";
    if (chosen.marketplace === "Shopify" && chosen.status === "live") {
      entry.isLiveOnShopify = true;
      if (chosen.inventory == null) {
        entry.inStock = true;
      } else {
        entry.inStock = chosen.inventory > 0;
      }
    } else if (chosen.inventory != null) {
      entry.inStock = chosen.inventory > 0;
    }
  }

  return result;
}
