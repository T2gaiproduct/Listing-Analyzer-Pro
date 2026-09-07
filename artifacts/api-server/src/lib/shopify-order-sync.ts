import { and, eq } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";
import { upsertProductOrderRow } from "./product-order-upsert.js";
import { shopifyHandleFromAsin } from "./shopify-import-utils.js";
import {
  clearShopifyAccessTokenCache,
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

function addSkuAlias(map: Map<string, number>, sku: string | null | undefined, auditId: number): void {
  const normalized = sku?.trim().toLowerCase();
  if (normalized) map.set(normalized, auditId);
}

async function loadShopifyAuditMatchers(workspaceId: number): Promise<{
  byHandle: Map<string, number>;
  bySku: Map<string, number>;
  byProductId: Map<number, number>;
  byVariantId: Map<number, number>;
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
        eq(productMarketplaceListingsTable.marketplace, "Shopify"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ),
    )
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
    ));

  const byHandle = new Map<string, number>();
  const bySku = new Map<string, number>();

  for (const row of rows) {
    const handle = shopifyHandleFromAsin(row.asin);
    if (handle) {
      byHandle.set(handle, row.auditId);
      addSkuAlias(bySku, handle, row.auditId);
      addSkuAlias(bySku, handle.toUpperCase(), row.auditId);
    }

    for (const sku of [row.profileSku, row.listingSku]) {
      addSkuAlias(bySku, sku, row.auditId);
    }

    addSkuAlias(bySku, `sl-${row.auditId}`, row.auditId);
  }

  return {
    byHandle,
    bySku,
    byProductId: new Map(),
    byVariantId: new Map(),
  };
}

async function buildShopifyCatalogMatchers(opts: {
  shopHost: string;
  accessToken: string;
  byHandle: Map<string, number>;
  bySku: Map<string, number>;
}): Promise<{
  byProductId: Map<number, number>;
  byVariantId: Map<number, number>;
}> {
  const byProductId = new Map<number, number>();
  const byVariantId = new Map<number, number>();
  const products = await listShopifyProducts({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    limit: 500,
  });

  for (const product of products) {
    let auditId = opts.byHandle.get(product.handle) ?? null;

    for (const variant of product.variants ?? []) {
      const sku = variant.sku?.trim().toLowerCase();
      if (!auditId && sku && opts.bySku.has(sku)) {
        auditId = opts.bySku.get(sku)!;
      }
    }

    if (!auditId) continue;

    byProductId.set(product.id, auditId);
    for (const variant of product.variants ?? []) {
      if (variant.id) byVariantId.set(variant.id, auditId);
    }
  }

  return { byProductId, byVariantId };
}

function resolveAuditIdForLineItem(
  lineItem: ShopifyRestOrder["line_items"][number],
  matchers: {
    byHandle: Map<string, number>;
    bySku: Map<string, number>;
    byProductId: Map<number, number>;
    byVariantId: Map<number, number>;
  },
): number | null {
  const sku = lineItem.sku?.trim().toLowerCase();
  if (sku && matchers.bySku.has(sku)) {
    return matchers.bySku.get(sku)!;
  }

  if (lineItem.variant_id && matchers.byVariantId.has(lineItem.variant_id)) {
    return matchers.byVariantId.get(lineItem.variant_id)!;
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

  const outcome = await upsertProductOrderRow({
    auditId: input.auditId,
    workspaceId: input.workspaceId,
    marketplace: "Shopify",
    orderNumber,
    customerName: customerName(input.order),
    quantity: input.lineItem.quantity,
    amountCents,
    currency: input.order.currency || "USD",
    status,
    orderedAt,
    trackingNumber: trackingNumber(input.order),
  });

  return outcome;
}

function shopifyOrdersScopeMessage(): string {
  return "Shopify app needs read_orders API scope. Add it in Shopify Dev Dashboard → API credentials, release the app version, reinstall on your store, then reconnect on Marketplaces.";
}

export async function syncShopifyOrders(input: {
  workspaceId: number;
  storeUrl: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: boolean;
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
  if (matchers.byHandle.size === 0 && matchers.bySku.size === 0) {
    return result;
  }

  const shopHost = parseShopifyShopHost(input.storeUrl);
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (input.refreshToken) {
    clearShopifyAccessTokenCache({ shopHost, clientId });
  }

  const fetchAccessToken = () => getShopifyAccessToken({
    shopHost,
    clientId,
    clientSecret,
  });

  let accessToken = await fetchAccessToken();

  const catalogMatchers = await buildShopifyCatalogMatchers({
    shopHost,
    accessToken,
    byHandle: matchers.byHandle,
    bySku: matchers.bySku,
  });
  matchers.byProductId = catalogMatchers.byProductId;
  matchers.byVariantId = catalogMatchers.byVariantId;

  const createdAtMin = new Date();
  createdAtMin.setDate(createdAtMin.getDate() - 365);

  let orders: ShopifyRestOrder[] = [];
  try {
    orders = await listShopifyOrders({
      shopHost,
      accessToken,
      createdAtMin: createdAtMin.toISOString(),
      maxOrders: 500,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/access|scope|permission|read_orders|unauthorized/i.test(message)) {
      clearShopifyAccessTokenCache({ shopHost, clientId });
      try {
        accessToken = await fetchAccessToken();
        orders = await listShopifyOrders({
          shopHost,
          accessToken,
          createdAtMin: createdAtMin.toISOString(),
          maxOrders: 500,
        });
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        result.errors.push(
          /access|scope|permission|read_orders|unauthorized/i.test(retryMessage)
            ? shopifyOrdersScopeMessage()
            : `Could not fetch Shopify orders: ${retryMessage}`,
        );
        return result;
      }
    } else {
      result.errors.push(`Could not fetch Shopify orders: ${message}`);
      return result;
    }
  }
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
  force?: boolean;
}): Promise<ShopifyOrderSyncResult | null> {
  const lastSync = lastSyncByWorkspace.get(input.workspaceId) ?? 0;
  if (!input.force && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    return null;
  }

  try {
    return await syncShopifyOrders({
      ...input,
      refreshToken: input.force === true,
    });
  } catch (err) {
    console.error("Shopify order sync failed:", err);
    return null;
  }
}
