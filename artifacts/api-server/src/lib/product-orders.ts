import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";
import { isMissingProductOrdersColumnError } from "./product-order-sync-errors.js";
import { normalizeStoreCurrency } from "./store-currency.js";

export type ProductOrderStatus = "delivered" | "shipped" | "processing" | "returned";

export type ProductOrderPaymentStatus = "pending" | "received" | "refunded";

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
  paymentStatus: ProductOrderPaymentStatus;
  paymentStatusLabel: string;
  date: string;
  tracking: string | null;
}

const STATUS_LABELS: Record<ProductOrderStatus, string> = {
  delivered: "Delivered",
  shipped: "Shipped",
  processing: "Processing",
  returned: "Returned",
};

const PAYMENT_STATUS_LABELS: Record<ProductOrderPaymentStatus, string> = {
  pending: "Pending",
  received: "Paid",
  refunded: "Refunded",
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

type ProductOrderDbRow = {
  id: number;
  orderNumber: string;
  marketplace: string;
  customerName: string;
  quantity: number;
  amountCents: number;
  currency: string;
  status: string;
  paymentStatus?: string | null;
  orderedAt: Date;
  trackingNumber: string | null;
};

function mapOrderRow(row: ProductOrderDbRow): ProductOrderRow {
  const status = row.status as ProductOrderStatus;
  const paymentStatus = (row.paymentStatus ?? "pending") as ProductOrderPaymentStatus;
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
    paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus,
    date: row.orderedAt.toISOString(),
    tracking: row.trackingNumber,
  };
}

async function selectProductOrderRows(
  auditId: number,
  query: ListProductOrdersQuery,
): Promise<ProductOrderDbRow[]> {
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

  try {
    const rows = await db
      .select()
      .from(productOrdersTable)
      .where(and(...conditions))
      .orderBy(desc(productOrdersTable.orderedAt));
    return rows;
  } catch (err) {
    if (!isMissingProductOrdersColumnError(err, "payment_status")) {
      throw err;
    }
    return selectLegacyProductOrderRows(auditId, query);
  }
}

async function selectLegacyProductOrderRows(
  auditId: number,
  query: ListProductOrdersQuery,
): Promise<ProductOrderDbRow[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      order_number,
      marketplace,
      customer_name,
      quantity,
      amount_cents,
      currency,
      status,
      ordered_at,
      tracking_number
    FROM product_orders
    WHERE audit_id = ${auditId}
      AND is_deleted = 0
    ORDER BY ordered_at DESC
  `);

  const rows = (Array.isArray(result) ? result : result.rows) as Array<Record<string, unknown>>;
  let mapped = rows.map((row) => ({
    id: Number(row.id),
    orderNumber: String(row.order_number),
    marketplace: String(row.marketplace),
    customerName: String(row.customer_name),
    quantity: Number(row.quantity),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    status: String(row.status),
    orderedAt: row.ordered_at instanceof Date ? row.ordered_at : new Date(String(row.ordered_at)),
    trackingNumber: row.tracking_number == null ? null : String(row.tracking_number),
  }));

  const search = query.search?.trim().toLowerCase();
  if (search) {
    mapped = mapped.filter((row) =>
      row.orderNumber.toLowerCase().includes(search)
      || row.customerName.toLowerCase().includes(search)
      || (row.trackingNumber?.toLowerCase().includes(search) ?? false),
    );
  }

  if (query.marketplace && query.marketplace !== "all") {
    const marketplace = query.marketplace.toLowerCase();
    mapped = mapped.filter((row) => row.marketplace.toLowerCase() === marketplace);
  }

  if (query.status && query.status !== "all") {
    mapped = mapped.filter((row) => row.status === query.status);
  }

  const rangeStart = dateRangeStart(query.dateRange);
  if (rangeStart) {
    mapped = mapped.filter((row) => row.orderedAt >= rangeStart);
  }

  return mapped;
}

export async function listProductOrders(
  auditId: number,
  query: ListProductOrdersQuery,
): Promise<{ orders: ProductOrderRow[]; total: number; revenue: number }> {
  const rows = await selectProductOrderRows(auditId, query);
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
  try {
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
  } catch (err) {
    if (!isMissingProductOrdersColumnError(err, "payment_status")) {
      throw err;
    }

    const { orders, revenue } = await listProductOrders(auditId, {});
    const latestOrder = orders[0];
    return {
      totalOrders: orders.length,
      revenue,
      currency: normalizeStoreCurrency(latestOrder?.currency),
    };
  }
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
