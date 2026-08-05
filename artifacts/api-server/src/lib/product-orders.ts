import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";

export type ProductOrderStatus = "delivered" | "shipped" | "processing" | "returned";

export interface ProductOrderRow {
  id: number;
  orderId: string;
  marketplace: string;
  customer: string;
  quantity: number;
  amount: number;
  currency: string;
  status: ProductOrderStatus;
  statusLabel: string;
  date: string;
  tracking: string | null;
}

const STATUS_LABELS: Record<ProductOrderStatus, string> = {
  delivered: "Delivered",
  shipped: "Shipped",
  processing: "Processing",
  returned: "Returned",
};

const SAMPLE_CUSTOMERS = [
  "Vikram Patel", "Priya Sharma", "Arjun Mehta", "Ananya Reddy",
  "Rahul Singh", "Sneha Iyer", "Karan Desai", "Meera Nair",
  "Aisha Khan", "Rohan Gupta", "Divya Joshi", "Nikhil Verma",
];

const MARKETPLACE_WEIGHTS: Array<{ name: string; weight: number }> = [
  { name: "Amazon", weight: 44 },
  { name: "Flipkart", weight: 28 },
  { name: "Shopify", weight: 18 },
  { name: "WooCommerce", weight: 10 },
];

const SAMPLE_STATUSES: ProductOrderStatus[] = ["delivered", "shipped", "processing", "returned"];

function pseudoRandom(seed: number): number {
  return Math.abs(Math.sin(seed) * 10000) % 1;
}

function pickMarketplace(seed: number): string {
  const roll = (pseudoRandom(seed) * 100) % 100;
  let cumulative = 0;
  for (const mp of MARKETPLACE_WEIGHTS) {
    cumulative += mp.weight;
    if (roll < cumulative) return mp.name;
  }
  return "Amazon";
}

function pickStatus(seed: number): ProductOrderStatus {
  const roll = pseudoRandom(seed);
  if (roll < 0.55) return "delivered";
  if (roll < 0.78) return "shipped";
  if (roll < 0.92) return "processing";
  return "returned";
}

function daysAgoDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date;
}

function generateHistoricalOrders(auditId: number, workspaceId: number | null) {
  const orders: Array<typeof productOrdersTable.$inferInsert> = [];
  const base = 8800 + auditId * 100;
  let orderIndex = 0;

  for (let day = 0; day < 60; day++) {
    const seed = auditId * 1000 + day;
    const ordersToday = 1 + Math.floor(pseudoRandom(seed) * 3);
    for (let j = 0; j < ordersToday; j++) {
      const itemSeed = seed + j * 17;
      const quantity = 1 + Math.floor(pseudoRandom(itemSeed) * 3);
      const amountCents = Math.round((2499 + pseudoRandom(itemSeed + 3) * 12000)) * quantity;
      const status = pickStatus(itemSeed + 5);
      const marketplace = pickMarketplace(itemSeed + 7);
      const customer = SAMPLE_CUSTOMERS[Math.floor(pseudoRandom(itemSeed + 11) * SAMPLE_CUSTOMERS.length)]!;
      const hasTracking = status === "delivered" || status === "shipped";
      const trackingPrefix = marketplace.slice(0, 4).toUpperCase();

      const orderedAt = daysAgoDate(day);
      orderedAt.setHours(9 + Math.floor(pseudoRandom(itemSeed + 13) * 10));

      orders.push({
        auditId,
        workspaceId,
        orderNumber: `ORD-${base + orderIndex}`,
        marketplace,
        customerName: customer,
        quantity,
        amountCents,
        currency: "USD",
        status,
        orderedAt,
        trackingNumber: hasTracking ? `${trackingPrefix}${Math.floor(1000000 + pseudoRandom(itemSeed + 19) * 8999999)}` : null,
      });
      orderIndex += 1;
    }
  }

  return orders;
}

/** Seed demo marketplace orders once per product when none exist yet. Backfills sparse legacy seeds. */
export async function ensureSampleProductOrders(auditId: number, workspaceId: number | null): Promise<void> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.auditId, auditId), eq(productOrdersTable.isDeleted, 0)));

  const count = countRow?.count ?? 0;
  if (count >= 40) return;

  if (count === 0) {
    await db.insert(productOrdersTable).values(generateHistoricalOrders(auditId, workspaceId));
    return;
  }

  const supplemental = generateHistoricalOrders(auditId, workspaceId).slice(0, 50 - count);
  if (supplemental.length > 0) {
    await db.insert(productOrdersTable).values(supplemental);
  }
}

export interface ListProductOrdersQuery {
  search?: string;
  marketplace?: string;
  status?: string;
  dateRange?: string;
}

function dateRangeStart(dateRange: string | undefined): Date | null {
  if (!dateRange || dateRange === "all") return null;
  const now = new Date();
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 0;
  if (days === 0) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

function mapOrderRow(row: typeof productOrdersTable.$inferSelect): ProductOrderRow {
  const status = row.status as ProductOrderStatus;
  return {
    id: row.id,
    orderId: row.orderNumber,
    marketplace: row.marketplace,
    customer: row.customerName,
    quantity: row.quantity,
    amount: row.amountCents / 100,
    currency: row.currency,
    status,
    statusLabel: STATUS_LABELS[status] ?? row.status,
    date: row.orderedAt.toISOString(),
    tracking: row.trackingNumber,
  };
}

export async function listProductOrders(
  auditId: number,
  query: ListProductOrdersQuery,
): Promise<{ orders: ProductOrderRow[]; total: number; revenue: number }> {
  const conditions = [
    eq(productOrdersTable.auditId, auditId),
    eq(productOrdersTable.isDeleted, 0),
  ];

  const search = query.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      ilike(productOrdersTable.orderNumber, pattern),
      ilike(productOrdersTable.customerName, pattern),
      ilike(productOrdersTable.trackingNumber, pattern),
    )!);
  }

  if (query.marketplace && query.marketplace !== "all") {
    conditions.push(ilike(productOrdersTable.marketplace, query.marketplace));
  }

  if (query.status && query.status !== "all") {
    conditions.push(eq(productOrdersTable.status, query.status));
  }

  const rangeStart = dateRangeStart(query.dateRange);
  if (rangeStart) {
    conditions.push(gte(productOrdersTable.orderedAt, rangeStart));
  }

  const rows = await db
    .select()
    .from(productOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(productOrdersTable.orderedAt));

  const orders = rows.map(mapOrderRow);
  const revenue = orders
    .filter((o) => o.status !== "returned")
    .reduce((sum, o) => sum + o.amount, 0);

  return { orders, total: orders.length, revenue };
}

export async function getProductOrderStats(auditId: number): Promise<{ totalOrders: number; revenue: number }> {
  const [stats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(case when ${productOrdersTable.status} != 'returned' then ${productOrdersTable.amountCents} else 0 end), 0)::int`,
    })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.auditId, auditId), eq(productOrdersTable.isDeleted, 0)));

  return {
    totalOrders: stats?.totalOrders ?? 0,
    revenue: (stats?.revenue ?? 0) / 100,
  };
}
