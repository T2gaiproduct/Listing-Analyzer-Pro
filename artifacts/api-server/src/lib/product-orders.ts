import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";
import { normalizeStoreCurrency } from "./store-currency.js";

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

export async function getProductOrderStats(auditId: number): Promise<{
  totalOrders: number;
  revenue: number;
  currency: string;
}> {
  const [stats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(case when ${productOrdersTable.status} != 'returned' then ${productOrdersTable.amountCents} else 0 end), 0)::int`,
    })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.auditId, auditId), eq(productOrdersTable.isDeleted, 0)));

  const [latestOrder] = await db
    .select({ currency: productOrdersTable.currency })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.auditId, auditId), eq(productOrdersTable.isDeleted, 0)))
    .orderBy(desc(productOrdersTable.orderedAt))
    .limit(1);

  return {
    totalOrders: stats?.totalOrders ?? 0,
    revenue: (stats?.revenue ?? 0) / 100,
    currency: normalizeStoreCurrency(latestOrder?.currency),
  };
}

export function resolveRevenueCurrency(opts: {
  orderCurrency?: string | null;
  listingCurrencies?: Array<string | null | undefined>;
}): string {
  const orderCurrency = opts.orderCurrency?.trim();
  if (orderCurrency) return normalizeStoreCurrency(orderCurrency);

  for (const raw of opts.listingCurrencies ?? []) {
    const currency = raw?.trim();
    if (currency) return normalizeStoreCurrency(currency);
  }

  return "USD";
}
