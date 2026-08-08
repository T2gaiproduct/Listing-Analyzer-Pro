import { and, eq, like } from "drizzle-orm";
import {
  auditsTable,
  db,
  productOrdersTable,
  productProfilesTable,
} from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";
import { shopifyHandleFromAsin } from "./shopify-import-utils.js";
import {
  getShopifyAccessToken,
  listShopifyOrders,
  listShopifyProducts,
  parseShopifyShopHost,
  type ShopifyRestOrder,
} from "./shopify-admin-client.js";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const lastSyncByWorkspace = new Map<number, number>();

export type ShopifyOrderSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  totalOrders: number;
  errors: string[];
};

function mapShopifyOrderStatus(order: ShopifyRestOrder): ProductOrderStatus {
  if (order.cancelled_at || order.financial_status === "refunded") {
    return "returned";
  }
  if (order.fulfillment_status === "fulfilled") {
    return "delivered";
  }
  if (order.fulfillment_status === "partial") {
    return "shipped";
  }
  return "processing";
}

function customerName(order: ShopifyRestOrder): string {
  const customer = order.customer;
  const name = [customer?.first_name, customer?.last_name]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .trim();
  if (name) return name;
  const email = customer?.email?.trim() || order.email?.trim();
  return email || "Shopify customer";
}

function trackingNumber(order: ShopifyRestOrder): string | null {
  for (const fulfillment of order.fulfillments ?? []) {
    const number = fulfillment.tracking_number?.trim()
      || fulfillment.tracking_numbers?.find((value) => value?.trim())?.trim();
    if (number) return number;
  }
  return null;
}

function lineItemAmountCents(lineItem: ShopifyRestOrder["line_items"][number]): number {
  const unitPrice = Number.parseFloat(lineItem.price);
  const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  return Math.round(safePrice * lineItem.quantity * 100);
}

async function loadShopifyAuditMatchers(workspaceId: number): Promise<{
  byHandle: Map<string, number>;
  bySku: Map<string, number>;
  byProductId: Map<number, number>;
}> {
  const rows = await db
    .select({
      auditId: auditsTable.id,
      asin: auditsTable.asin,
      sku: productProfilesTable.sku,
    })
    .from(auditsTable)
    .leftJoin(productProfilesTable, eq(productProfilesTable.auditId, auditsTable.id))
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
      like(auditsTable.asin, "shopify:%"),
    ));

  const byHandle = new Map<string, number>();
  const bySku = new Map<string, number>();
  for (const row of rows) {
    const handle = shopifyHandleFromAsin(row.asin);
    if (handle) byHandle.set(handle, row.auditId);
    const sku = row.sku?.trim();
    if (sku) bySku.set(sku.toLowerCase(), row.auditId);
  }

  return { byHandle, bySku, byProductId: new Map() };
}

async function buildProductIdMap(opts: {
  shopHost: string;
  accessToken: string;
  byHandle: Map<string, number>;
}): Promise<Map<number, number>> {
  const byProductId = new Map<number, number>();
  const products = await listShopifyProducts({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    limit: 500,
  });

  for (const product of products) {
    const auditId = opts.byHandle.get(product.handle);
    if (auditId) byProductId.set(product.id, auditId);
  }

  return byProductId;
}

function resolveAuditIdForLineItem(
  lineItem: ShopifyRestOrder["line_items"][number],
  matchers: {
    byHandle: Map<string, number>;
    bySku: Map<string, number>;
    byProductId: Map<number, number>;
  },
): number | null {
  const sku = lineItem.sku?.trim().toLowerCase();
  if (sku && matchers.bySku.has(sku)) {
    return matchers.bySku.get(sku)!;
  }

  if (lineItem.product_id && matchers.byProductId.has(lineItem.product_id)) {
    return matchers.byProductId.get(lineItem.product_id)!;
  }

  return null;
}

function orderNumberForLineItem(order: ShopifyRestOrder, lineItemId: number): string {
  const label = order.name?.trim() || `#${order.order_number}`;
  return `${label} · ${lineItemId}`;
}

async function upsertShopifyOrderRow(input: {
  auditId: number;
  workspaceId: number;
  order: ShopifyRestOrder;
  lineItem: ShopifyRestOrder["line_items"][number];
}): Promise<"imported" | "updated" | "skipped"> {
  const orderNumber = orderNumberForLineItem(input.order, input.lineItem.id);
  const amountCents = lineItemAmountCents(input.lineItem);
  const orderedAt = new Date(input.order.created_at);
  const status = mapShopifyOrderStatus(input.order);
  const values = {
    auditId: input.auditId,
    workspaceId: input.workspaceId,
    orderNumber,
    marketplace: "Shopify",
    customerName: customerName(input.order),
    quantity: input.lineItem.quantity,
    amountCents,
    currency: input.order.currency || "USD",
    status,
    orderedAt,
    trackingNumber: trackingNumber(input.order),
  };

  const [existing] = await db
    .select({ id: productOrdersTable.id })
    .from(productOrdersTable)
    .where(and(
      eq(productOrdersTable.auditId, input.auditId),
      eq(productOrdersTable.marketplace, "Shopify"),
      eq(productOrdersTable.orderNumber, orderNumber),
      eq(productOrdersTable.isDeleted, 0),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(productOrdersTable)
      .set({
        customerName: values.customerName,
        quantity: values.quantity,
        amountCents: values.amountCents,
        currency: values.currency,
        status: values.status,
        orderedAt: values.orderedAt,
        trackingNumber: values.trackingNumber,
      })
      .where(eq(productOrdersTable.id, existing.id));
    return "updated";
  }

  await db.insert(productOrdersTable).values(values);
  return "imported";
}

export async function syncShopifyOrders(input: {
  workspaceId: number;
  storeUrl: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<ShopifyOrderSyncResult> {
  const result: ShopifyOrderSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    totalOrders: 0,
    errors: [],
  };

  if (!input.clientId?.trim() || !input.clientSecret?.trim()) {
    result.errors.push("Shopify API credentials are required to sync orders.");
    return result;
  }

  const matchers = await loadShopifyAuditMatchers(input.workspaceId);
  if (matchers.byHandle.size === 0) {
    return result;
  }

  const shopHost = parseShopifyShopHost(input.storeUrl);
  const accessToken = await getShopifyAccessToken({
    shopHost,
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
  });

  matchers.byProductId = await buildProductIdMap({
    shopHost,
    accessToken,
    byHandle: matchers.byHandle,
  });

  const createdAtMin = new Date();
  createdAtMin.setDate(createdAtMin.getDate() - 365);

  const orders = await listShopifyOrders({
    shopHost,
    accessToken,
    createdAtMin: createdAtMin.toISOString(),
    maxOrders: 500,
  });
  result.totalOrders = orders.length;

  for (const order of orders) {
    for (const lineItem of order.line_items ?? []) {
      const auditId = resolveAuditIdForLineItem(lineItem, matchers);
      if (!auditId) {
        result.skipped += 1;
        continue;
      }

      try {
        const outcome = await upsertShopifyOrderRow({
          auditId,
          workspaceId: input.workspaceId,
          order,
          lineItem,
        });
        if (outcome === "imported") result.imported += 1;
        else if (outcome === "updated") result.updated += 1;
      } catch (err) {
        result.errors.push(
          err instanceof Error ? err.message : `Failed to save order ${order.name}`,
        );
      }
    }
  }

  lastSyncByWorkspace.set(input.workspaceId, Date.now());
  return result;
}

export async function maybeSyncShopifyOrdersForWorkspace(input: {
  workspaceId: number;
  storeUrl: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<void> {
  const lastSync = lastSyncByWorkspace.get(input.workspaceId) ?? 0;
  if (Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

  try {
    await syncShopifyOrders(input);
  } catch (err) {
    console.error("Shopify order sync failed:", err);
  }
}
