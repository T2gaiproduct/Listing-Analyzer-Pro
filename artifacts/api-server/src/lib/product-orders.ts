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

const SAMPLE_ORDER_TEMPLATES: Array<{
  marketplace: string;
  customer: string;
  quantity: number;
  amountCents: number;
  status: ProductOrderStatus;
  daysAgo: number;
  tracking: string | null;
}> = [
  { marketplace: "Amazon", customer: "Vikram Patel", quantity: 2, amountCents: 13198, status: "delivered", daysAgo: 10, tracking: "AMZN1239842" },
  { marketplace: "Flipkart", customer: "Priya Sharma", quantity: 1, amountCents: 6599, status: "shipped", daysAgo: 8, tracking: "FKRT8821901" },
  { marketplace: "Shopify", customer: "Arjun Mehta", quantity: 3, amountCents: 19797, status: "processing", daysAgo: 5, tracking: null },
  { marketplace: "WooCommerce", customer: "Ananya Reddy", quantity: 1, amountCents: 6599, status: "delivered", daysAgo: 14, tracking: "WOO4459012" },
  { marketplace: "Amazon", customer: "Rahul Singh", quantity: 2, amountCents: 13198, status: "returned", daysAgo: 18, tracking: "AMZN9981204" },
  { marketplace: "Flipkart", customer: "Sneha Iyer", quantity: 1, amountCents: 6599, status: "delivered", daysAgo: 21, tracking: "FKRT7710234" },
  { marketplace: "Shopify", customer: "Karan Desai", quantity: 2, amountCents: 13198, status: "shipped", daysAgo: 3, tracking: "SHP3321987" },
  { marketplace: "Amazon", customer: "Meera Nair", quantity: 1, amountCents: 6599, status: "processing", daysAgo: 1, tracking: null },
];

function daysAgoDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Seed demo marketplace orders once per product when none exist yet. */
export async function ensureSampleProductOrders(auditId: number, workspaceId: number | null): Promise<void> {
  const [existing] = await db
    .select({ id: productOrdersTable.id })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.auditId, auditId), eq(productOrdersTable.isDeleted, 0)))
    .limit(1);

  if (existing) return;

  const base = 8800 + auditId * 10;
  await db.insert(productOrdersTable).values(
    SAMPLE_ORDER_TEMPLATES.map((template, index) => ({
      auditId,
      workspaceId,
      orderNumber: `ORD-${base + index}`,
      marketplace: template.marketplace,
      customerName: template.customer,
      quantity: template.quantity,
      amountCents: template.amountCents,
      currency: "USD",
      status: template.status,
      orderedAt: daysAgoDate(template.daysAgo),
      trackingNumber: template.tracking,
    })),
  );
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
