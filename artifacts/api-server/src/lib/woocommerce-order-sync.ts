import { and, eq } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";
import { upsertProductOrderRow } from "./product-order-upsert.js";
import { woocommerceSlugFromAsin } from "./woocommerce-import-utils.js";
import {
  fetchWooCommerceCatalog,
  listWooCommerceOrders,
  type WooCommerceRestOrder,
  type WooCommerceRestOrderLineItem,
} from "./woocommerce-admin-client.js";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const lastSyncByWorkspace = new Map<number, number>();

export type WooCommerceOrderSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  totalOrders: number;
  errors: string[];
};

function mapWooCommerceOrderStatus(status: string): ProductOrderStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return "delivered";
  if (normalized === "cancelled" || normalized === "refunded" || normalized === "failed" || normalized === "trash") {
    return "returned";
  }
  return "processing";
}

function customerName(order: WooCommerceRestOrder): string {
  const billing = order.billing;
  const name = [billing?.first_name, billing?.last_name]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .trim();
  if (name) return name;
  const email = billing?.email?.trim();
  return email || "WooCommerce customer";
}

function lineItemAmountCents(lineItem: WooCommerceRestOrderLineItem): number {
  const total = Number.parseFloat(lineItem.total ?? "");
  if (Number.isFinite(total) && total > 0) {
    return Math.round(total * 100);
  }
  const unitPrice = Number(lineItem.price ?? 0);
  const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  return Math.round(safePrice * lineItem.quantity * 100);
}

function orderNumberForLineItem(order: WooCommerceRestOrder, lineItemId: number): string {
  const label = order.number?.trim() || `#${order.id}`;
  return `${label} · ${lineItemId}`;
}

async function loadWooCommerceAuditMatchers(workspaceId: number): Promise<{
  bySlug: Map<string, number>;
  bySku: Map<string, number>;
  byProductId: Map<number, number>;
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
        eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ),
    )
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
    ));

  const bySlug = new Map<string, number>();
  const bySku = new Map<string, number>();

  for (const row of rows) {
    const slug = woocommerceSlugFromAsin(row.asin);
    if (slug) bySlug.set(slug, row.auditId);

    for (const sku of [row.profileSku, row.listingSku]) {
      const normalized = sku?.trim().toLowerCase();
      if (normalized) bySku.set(normalized, row.auditId);
    }
  }

  return { bySlug, bySku, byProductId: new Map() };
}

async function buildProductIdMap(opts: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  bySlug: Map<string, number>;
}): Promise<Map<number, number>> {
  const byProductId = new Map<number, number>();
  const products = await fetchWooCommerceCatalog({
    storeUrl: opts.storeUrl,
    consumerKey: opts.consumerKey,
    consumerSecret: opts.consumerSecret,
    maxProducts: 500,
  });

  for (const product of products) {
    const slug = product.slug?.trim();
    if (!slug) continue;
    const auditId = opts.bySlug.get(slug);
    if (auditId) byProductId.set(product.id, auditId);
  }

  return byProductId;
}

function resolveAuditIdForLineItem(
  lineItem: WooCommerceRestOrderLineItem,
  matchers: {
    bySlug: Map<string, number>;
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

export async function syncWooCommerceOrders(input: {
  workspaceId: number;
  storeUrl: string;
  consumerKey?: string;
  consumerSecret?: string;
}): Promise<WooCommerceOrderSyncResult> {
  const result: WooCommerceOrderSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    totalOrders: 0,
    errors: [],
  };

  if (!input.consumerKey?.trim() || !input.consumerSecret?.trim()) {
    result.errors.push("WooCommerce REST API credentials are required to sync orders.");
    return result;
  }

  const matchers = await loadWooCommerceAuditMatchers(input.workspaceId);
  if (matchers.bySlug.size === 0 && matchers.bySku.size === 0) {
    return result;
  }

  matchers.byProductId = await buildProductIdMap({
    storeUrl: input.storeUrl,
    consumerKey: input.consumerKey.trim(),
    consumerSecret: input.consumerSecret.trim(),
    bySlug: matchers.bySlug,
  });

  const createdAfter = new Date();
  createdAfter.setDate(createdAfter.getDate() - 365);

  const orders = await listWooCommerceOrders({
    storeUrl: input.storeUrl,
    consumerKey: input.consumerKey.trim(),
    consumerSecret: input.consumerSecret.trim(),
    createdAfter: createdAfter.toISOString(),
    maxOrders: 500,
  });
  result.totalOrders = orders.length;

  for (const order of orders) {
    const status = mapWooCommerceOrderStatus(order.status);
    const orderedAt = new Date(order.date_created);
    for (const lineItem of order.line_items ?? []) {
      const auditId = resolveAuditIdForLineItem(lineItem, matchers);
      if (!auditId) {
        result.skipped += 1;
        continue;
      }

      try {
        const outcome = await upsertProductOrderRow({
          auditId,
          workspaceId: input.workspaceId,
          marketplace: "WooCommerce",
          orderNumber: orderNumberForLineItem(order, lineItem.id),
          customerName: customerName(order),
          quantity: lineItem.quantity,
          amountCents: lineItemAmountCents(lineItem),
          currency: order.currency || "USD",
          status,
          orderedAt,
          trackingNumber: null,
        });
        if (outcome === "imported") result.imported += 1;
        else result.updated += 1;
      } catch (err) {
        result.errors.push(
          err instanceof Error ? err.message : `Failed to save WooCommerce order ${order.number}`,
        );
      }
    }
  }

  lastSyncByWorkspace.set(input.workspaceId, Date.now());
  return result;
}

export async function maybeSyncWooCommerceOrdersForWorkspace(input: {
  workspaceId: number;
  storeUrl: string;
  consumerKey?: string;
  consumerSecret?: string;
}): Promise<void> {
  const lastSync = lastSyncByWorkspace.get(input.workspaceId) ?? 0;
  if (Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

  try {
    await syncWooCommerceOrders(input);
  } catch (err) {
    console.error("WooCommerce order sync failed:", err);
  }
}
