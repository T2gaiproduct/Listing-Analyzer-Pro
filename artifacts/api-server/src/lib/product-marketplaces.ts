import { and, eq, inArray } from "drizzle-orm";
import { db, productMarketplaceListingsTable } from "@workspace/db";

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
