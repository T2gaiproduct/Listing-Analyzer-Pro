import { and, eq, inArray, sql } from "drizzle-orm";
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

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

function buildListingTemplates(
  auditId: number,
  productName: string,
  _baseSku: string,
): Array<typeof productMarketplaceListingsTable.$inferInsert> {
  const slug = slugify(productName).slice(0, 12) || `PRD-${auditId}`;
  const published = new Date();
  published.setDate(published.getDate() - 14);

  const templates: Array<{
    marketplace: string;
    status: MarketplaceListingStatus;
    sku?: string;
    priceCents?: number;
    inventory?: number;
    publishedAt?: Date;
    listingUrl?: string;
  }> = [
    {
      marketplace: "Amazon",
      status: "live",
      sku: `B0C${String(4000000 + auditId).slice(-7)}`,
      priceCents: 6599,
      inventory: 200 + (auditId % 80),
      publishedAt: published,
      listingUrl: `https://www.amazon.in/dp/B0C${String(4000000 + auditId).slice(-7)}`,
    },
    {
      marketplace: "Flipkart",
      status: "live",
      sku: `FK-${slug.slice(0, 6)}-${auditId}`,
      priceCents: 5999,
      inventory: 150 + (auditId % 60),
      publishedAt: published,
      listingUrl: `https://www.flipkart.com/p/${slug.toLowerCase()}-p-${auditId}`,
    },
    {
      marketplace: "Shopsy",
      status: "pending",
    },
    {
      marketplace: "Shopify",
      status: "live",
      sku: `SHF-${slug.slice(0, 8)}`,
      priceCents: 6999,
      inventory: 80 + (auditId % 40),
      publishedAt: published,
      listingUrl: `https://store.example.com/products/${slug.toLowerCase()}`,
    },
    {
      marketplace: "WooCommerce",
      status: "live",
      sku: `WOO-${slug.slice(0, 8)}`,
      priceCents: 6750,
      inventory: 60 + (auditId % 30),
      publishedAt: published,
      listingUrl: `https://shop.example.com/product/${slug.toLowerCase()}`,
    },
    {
      marketplace: "Meesho",
      status: "not_listed",
    },
  ];

  return templates.map((template, index) => ({
    auditId,
    workspaceId: null,
    marketplace: template.marketplace,
    status: template.status,
    sku: template.sku ?? null,
    priceCents: template.priceCents ?? null,
    currency: "USD",
    inventory: template.inventory ?? null,
    publishedAt: template.publishedAt ?? null,
    listingUrl: template.listingUrl ?? null,
  }));
}

export async function ensureSampleMarketplaceListings(
  auditId: number,
  workspaceId: number | null,
  productName: string,
  baseSku: string,
): Promise<void> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  if ((countRow?.count ?? 0) > 0) return;

  const rows = buildListingTemplates(auditId, productName, baseSku).map((row) => ({
    ...row,
    workspaceId,
  }));

  await db.insert(productMarketplaceListingsTable).values(rows);
}

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

/** Live marketplace names per audit id (seeds sample listings when missing). */
export async function listLiveChannelsForAudits(
  auditIds: number[],
  workspaceId: number | null,
  namesByAuditId: Map<number, string>,
  skusByAuditId: Map<number, string>,
): Promise<Map<number, string[]>> {
  const uniqueIds = [...new Set(auditIds.filter((id) => id > 0))];
  if (uniqueIds.length === 0) return new Map();

  const existing = await db
    .select({ auditId: productMarketplaceListingsTable.auditId })
    .from(productMarketplaceListingsTable)
    .where(and(
      inArray(productMarketplaceListingsTable.auditId, uniqueIds),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  const seeded = new Set(existing.map((row) => row.auditId));
  await Promise.all(
    uniqueIds
      .filter((id) => !seeded.has(id))
      .map((id) => ensureSampleMarketplaceListings(
        id,
        workspaceId,
        namesByAuditId.get(id) ?? "Product",
        skusByAuditId.get(id) ?? `PRD-${id}`,
      )),
  );

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
