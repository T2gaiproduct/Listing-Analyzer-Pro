import { and, eq, gte } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";

export interface SalesKpi {
  value: number;
  changePercent: number;
  direction: "up" | "down";
}

export interface ProductSalesData {
  currency: string;
  kpis: {
    totalRevenue: SalesKpi;
    totalOrders: SalesKpi;
    unitsSold: SalesKpi;
    avgOrderValue: SalesKpi;
  };
  trend: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
    units: number;
  }>;
  revenueSplit: Array<{
    marketplace: string;
    revenue: number;
    percent: number;
    color: string;
  }>;
  marketplaceRevenue: Array<{
    marketplace: string;
    revenue: number;
    color: string;
    changePercent: number;
    direction: "up" | "down";
    sharePercent: number;
  }>;
}

const MARKETPLACE_COLORS: Record<string, string> = {
  Amazon: "#f59e0b",
  Flipkart: "#3b82f6",
  Shopify: "#0ea5e9",
  WooCommerce: "#22c55e",
};

const MARKETPLACE_ORDER = ["Amazon", "Flipkart", "Shopify", "WooCommerce"];

function normalizeMarketplace(name: string): string {
  const trimmed = name.trim();
  const match = MARKETPLACE_ORDER.find((mp) => mp.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildKpi(current: number, previous: number): SalesKpi {
  const changePercent = pctChange(current, previous);
  return {
    value: current,
    changePercent: Math.abs(changePercent),
    direction: changePercent >= 0 ? "up" : "down",
  };
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getProductSales(auditId: number): Promise<ProductSalesData> {
  const now = new Date();
  const currentStart = startOfDay(new Date(now));
  currentStart.setDate(currentStart.getDate() - 29);
  const previousStart = startOfDay(new Date(currentStart));
  previousStart.setDate(previousStart.getDate() - 30);

  const rows = await db
    .select({
      orderedAt: productOrdersTable.orderedAt,
      marketplace: productOrdersTable.marketplace,
      quantity: productOrdersTable.quantity,
      amountCents: productOrdersTable.amountCents,
      status: productOrdersTable.status,
      currency: productOrdersTable.currency,
    })
    .from(productOrdersTable)
    .where(and(
      eq(productOrdersTable.auditId, auditId),
      eq(productOrdersTable.isDeleted, 0),
      gte(productOrdersTable.orderedAt, previousStart),
    ));

  const currency = rows[0]?.currency ?? "USD";

  type Bucket = { revenue: number; orders: number; units: number };
  const emptyBucket = (): Bucket => ({ revenue: 0, orders: 0, units: 0 });

  const current = emptyBucket();
  const previous = emptyBucket();
  const daily = new Map<string, Bucket>();
  const marketplaceTotals = new Map<string, number>();
  const marketplacePreviousTotals = new Map<string, number>();

  for (const row of rows) {
    const orderedAt = row.orderedAt instanceof Date ? row.orderedAt : new Date(row.orderedAt);
    const isReturned = row.status === "returned";
    const revenue = isReturned ? 0 : row.amountCents / 100;
    const dayKey = startOfDay(orderedAt).toISOString().slice(0, 10);
    const mp = normalizeMarketplace(row.marketplace);

    const bucket = daily.get(dayKey) ?? emptyBucket();
    bucket.orders += 1;
    bucket.units += row.quantity;
    bucket.revenue += revenue;
    daily.set(dayKey, bucket);

    if (orderedAt >= currentStart) {
      current.orders += 1;
      current.units += row.quantity;
      current.revenue += revenue;
      if (!isReturned) {
        marketplaceTotals.set(mp, (marketplaceTotals.get(mp) ?? 0) + revenue);
      }
    } else if (orderedAt >= previousStart) {
      previous.orders += 1;
      previous.units += row.quantity;
      previous.revenue += revenue;
      if (!isReturned) {
        marketplacePreviousTotals.set(mp, (marketplacePreviousTotals.get(mp) ?? 0) + revenue);
      }
    }
  }

  const trend: ProductSalesData["trend"] = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(currentStart);
    day.setDate(day.getDate() + i);
    const key = startOfDay(day).toISOString().slice(0, 10);
    const bucket = daily.get(key) ?? emptyBucket();
    trend.push({
      date: key,
      label: formatDayLabel(day),
      revenue: Number(bucket.revenue.toFixed(2)),
      orders: bucket.orders,
      units: bucket.units,
    });
  }

  const totalMarketplaceRevenue = MARKETPLACE_ORDER
    .reduce((sum, mp) => sum + (marketplaceTotals.get(mp) ?? 0), 0);

  const revenueSplit = MARKETPLACE_ORDER.map((marketplace) => {
    const revenue = marketplaceTotals.get(marketplace) ?? 0;
    const percent = totalMarketplaceRevenue > 0
      ? Math.round((revenue / totalMarketplaceRevenue) * 100)
      : 0;
    return {
      marketplace,
      revenue: Number(revenue.toFixed(2)),
      percent,
      color: MARKETPLACE_COLORS[marketplace] ?? "#94a3b8",
    };
  });

  const marketplaceRevenue = MARKETPLACE_ORDER.map((marketplace) => {
    const revenue = marketplaceTotals.get(marketplace) ?? 0;
    const prevRevenue = marketplacePreviousTotals.get(marketplace) ?? 0;
    const change = pctChange(revenue, prevRevenue);
    return {
      marketplace,
      revenue: Number(revenue.toFixed(2)),
      color: MARKETPLACE_COLORS[marketplace] ?? "#94a3b8",
      changePercent: Math.abs(change),
      direction: change >= 0 ? "up" as const : "down" as const,
      sharePercent: totalMarketplaceRevenue > 0
        ? Math.round((revenue / totalMarketplaceRevenue) * 100)
        : 0,
    };
  });

  const currentAov = current.orders > 0 ? current.revenue / current.orders : 0;
  const previousAov = previous.orders > 0 ? previous.revenue / previous.orders : 0;

  return {
    currency,
    kpis: {
      totalRevenue: buildKpi(Number(current.revenue.toFixed(2)), Number(previous.revenue.toFixed(2))),
      totalOrders: buildKpi(current.orders, previous.orders),
      unitsSold: buildKpi(current.units, previous.units),
      avgOrderValue: buildKpi(Number(currentAov.toFixed(2)), Number(previousAov.toFixed(2))),
    },
    trend,
    revenueSplit,
    marketplaceRevenue,
  };
}
