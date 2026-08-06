import { and, eq, inArray } from "drizzle-orm";
import { db, productMarketplaceListingsTable, productProfilesTable, auditsTable } from "@workspace/db";
import { isShopifyImportAsin } from "./shopify-import-utils.js";

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

export async function listProductMarketplaces(auditId: number): Promise<{
  listings: MarketplaceListingRow[];
  activeCount: number;
}> {
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
    if (row) return mapListingRow(row);
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

  const activeCount = listings.filter((l) => l.status === "live").length;

  return { listings, activeCount };
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
  referenceUrl: string | null;
};

const LISTING_PRICE_PRIORITY = ["Shopify", "Amazon", "WooCommerce", "Flipkart", "Shopsy", "Meesho"];

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
