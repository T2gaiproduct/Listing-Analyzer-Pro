import { and, eq } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";
import { isRealAmazonAsin } from "./amazon-asin-utils.js";
import {
  listAmazonOrderItems,
  listAmazonOrders,
  type AmazonSpOrder,
  type AmazonSpOrderItem,
} from "./amazon-sp-api.js";
import { resolveSpMarketplaceId } from "./amazon-sp-settings.js";
import type { ResolvedAmazonConnection } from "./resolve-amazon-settings.js";
import { upsertProductOrderRow } from "./product-order-upsert.js";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const lastSyncByWorkspace = new Map<number, number>();

export type AmazonOrderSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  totalOrders: number;
  errors: string[];
};

function mapAmazonOrderStatus(status: string): ProductOrderStatus {
  const normalized = status.trim();
  if (normalized === "Canceled" || normalized === "Unfulfillable") return "returned";
  if (normalized === "Shipped" || normalized === "PartiallyShipped") return "shipped";
  return "processing";
}

function customerName(order: AmazonSpOrder): string {
  return order.BuyerInfo?.BuyerName?.trim() || "Amazon customer";
}

function lineItemAmountCents(lineItem: AmazonSpOrderItem): number {
  const amount = Number.parseFloat(lineItem.ItemPrice?.Amount ?? "");
  if (Number.isFinite(amount) && amount > 0) {
    return Math.round(amount * 100);
  }
  return 0;
}

function orderNumberForLineItem(orderId: string, orderItemId: string): string {
  return `${orderId} · ${orderItemId}`;
}

async function loadAmazonAuditMatchers(workspaceId: number): Promise<{
  byAsin: Map<string, number>;
  bySku: Map<string, number>;
}> {
  const rows = await db
    .select({
      auditId: auditsTable.id,
      asin: auditsTable.asin,
      profileSku: productProfilesTable.sku,
      listingSku: productMarketplaceListingsTable.sku,
    })
    .from(auditsTable)
    .leftJoin(productProfilesTable, eq(productProfilesTable.auditId, auditsTable.id))
    .leftJoin(
      productMarketplaceListingsTable,
      and(
        eq(productMarketplaceListingsTable.auditId, auditsTable.id),
        eq(productMarketplaceListingsTable.marketplace, "Amazon"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ),
    )
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
    ));

  const byAsin = new Map<string, number>();
  const bySku = new Map<string, number>();

  for (const row of rows) {
    if (isRealAmazonAsin(row.asin)) {
      byAsin.set(row.asin!.trim().toUpperCase(), row.auditId);
    }

    for (const sku of [row.profileSku, row.listingSku]) {
      const normalized = sku?.trim().toLowerCase();
      if (normalized) bySku.set(normalized, row.auditId);
    }

    bySku.set(`sl-${row.auditId}`, row.auditId);
  }

  return { byAsin, bySku };
}

function resolveAuditIdForOrderItem(
  lineItem: AmazonSpOrderItem,
  matchers: { byAsin: Map<string, number>; bySku: Map<string, number> },
): number | null {
  const asin = lineItem.ASIN?.trim().toUpperCase();
  if (asin && matchers.byAsin.has(asin)) {
    return matchers.byAsin.get(asin)!;
  }

  const sku = lineItem.SellerSKU?.trim().toLowerCase();
  if (sku && matchers.bySku.has(sku)) {
    return matchers.bySku.get(sku)!;
  }

  return null;
}

export async function syncAmazonOrders(input: {
  workspaceId: number;
  connection: ResolvedAmazonConnection;
}): Promise<AmazonOrderSyncResult> {
  const result: AmazonOrderSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    totalOrders: 0,
    errors: [],
  };

  const matchers = await loadAmazonAuditMatchers(input.workspaceId);
  if (matchers.byAsin.size === 0 && matchers.bySku.size === 0) {
    return result;
  }

  const marketplaceCode = input.connection.settings.defaultMarketplace || "US";
  const marketplaceId = input.connection.marketplaceIds[0]
    ?? resolveSpMarketplaceId(marketplaceCode);

  const createdAfter = new Date();
  createdAfter.setDate(createdAfter.getDate() - 365);

  const orders = await listAmazonOrders({
    settings: input.connection.settings,
    refreshToken: input.connection.refreshToken,
    marketplaceId,
    createdAfter: createdAfter.toISOString(),
    maxOrders: 100,
  });
  result.totalOrders = orders.length;

  for (const order of orders) {
    const status = mapAmazonOrderStatus(order.OrderStatus);
    const orderedAt = new Date(order.PurchaseDate);
    let items: AmazonSpOrderItem[] = [];

    try {
      items = await listAmazonOrderItems({
        settings: input.connection.settings,
        refreshToken: input.connection.refreshToken,
        orderId: order.AmazonOrderId,
      });
    } catch (err) {
      result.errors.push(
        err instanceof Error ? err.message : `Failed to load items for order ${order.AmazonOrderId}`,
      );
      continue;
    }

    for (const lineItem of items) {
      const auditId = resolveAuditIdForOrderItem(lineItem, matchers);
      if (!auditId) {
        result.skipped += 1;
        continue;
      }

      try {
        const outcome = await upsertProductOrderRow({
          auditId,
          workspaceId: input.workspaceId,
          marketplace: "Amazon",
          orderNumber: orderNumberForLineItem(order.AmazonOrderId, lineItem.OrderItemId),
          customerName: customerName(order),
          quantity: lineItem.QuantityOrdered ?? 1,
          amountCents: lineItemAmountCents(lineItem),
          currency: lineItem.ItemPrice?.CurrencyCode || order.OrderTotal?.CurrencyCode || "USD",
          status,
          orderedAt,
          trackingNumber: null,
        });
        if (outcome === "imported") result.imported += 1;
        else result.updated += 1;
      } catch (err) {
        result.errors.push(
          err instanceof Error ? err.message : `Failed to save Amazon order ${order.AmazonOrderId}`,
        );
      }
    }
  }

  lastSyncByWorkspace.set(input.workspaceId, Date.now());
  return result;
}

export async function maybeSyncAmazonOrdersForWorkspace(input: {
  workspaceId: number;
  connection: ResolvedAmazonConnection;
}): Promise<void> {
  const lastSync = lastSyncByWorkspace.get(input.workspaceId) ?? 0;
  if (Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

  try {
    await syncAmazonOrders(input);
  } catch (err) {
    console.error("Amazon order sync failed:", err);
  }
}
