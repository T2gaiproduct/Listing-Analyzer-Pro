import { and, eq, or } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";
import { upsertProductOrderRow } from "./product-order-upsert.js";
import { mapEbayPaymentStatus } from "./product-order-payment.js";
import { formatProductOrderSyncError } from "./product-order-sync-errors.js";
import { ensureProductOrdersSchemaMigrated } from "./ensure-product-orders-schema.js";
import {
  ebaySkuFromAsin,
  parseEbayItemIdFromListingUrl,
  parseEbayItemIdFromSku,
} from "./ebay-import-utils.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import { resolveEbayAccessToken } from "./ebay-inventory-client.js";
import {
  fetchEbayTradingOrderLines,
  type EbayTradingOrderLine,
} from "./ebay-trading-client.js";
import {
  listEbayFulfillmentOrders,
  type EbayFulfillmentLineItem,
  type EbayFulfillmentOrder,
} from "./ebay-fulfillment-client.js";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const lastSyncByWorkspace = new Map<number, number>();

export type EbayOrderSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  totalOrders: number;
  errors: string[];
};

function addSkuAlias(map: Map<string, number>, sku: string | null | undefined, auditId: number): void {
  const normalized = sku?.trim().toLowerCase();
  if (normalized) map.set(normalized, auditId);
}

function addItemIdAlias(map: Map<string, number>, itemId: string | null | undefined, auditId: number): void {
  const normalized = itemId?.trim();
  if (normalized) map.set(normalized, auditId);
}

async function loadEbayAuditMatchers(workspaceId: number): Promise<{
  bySku: Map<string, number>;
  byItemId: Map<string, number>;
}> {
  const rows = await db
    .select({
      auditId: auditsTable.id,
      asin: auditsTable.asin,
      profileSku: productProfilesTable.sku,
      listingSku: productMarketplaceListingsTable.sku,
      listingUrl: productMarketplaceListingsTable.listingUrl,
    })
    .from(auditsTable)
    .leftJoin(productProfilesTable, eq(productProfilesTable.auditId, auditsTable.id))
    .leftJoin(
      productMarketplaceListingsTable,
      and(
        eq(productMarketplaceListingsTable.auditId, auditsTable.id),
        eq(productMarketplaceListingsTable.marketplace, "eBay"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ),
    )
    .where(and(
      eq(auditsTable.isDeleted, 0),
      or(
        eq(auditsTable.workspaceId, workspaceId),
        eq(productMarketplaceListingsTable.workspaceId, workspaceId),
      ),
    ));

  const bySku = new Map<string, number>();
  const byItemId = new Map<string, number>();

  for (const row of rows) {
    const ebaySku = ebaySkuFromAsin(row.asin);
    if (ebaySku) {
      addSkuAlias(bySku, ebaySku, row.auditId);
    }

    for (const sku of [row.profileSku, row.listingSku, ebaySku]) {
      addSkuAlias(bySku, sku, row.auditId);
      addItemIdAlias(byItemId, parseEbayItemIdFromSku(sku), row.auditId);
    }

    addItemIdAlias(byItemId, parseEbayItemIdFromListingUrl(row.listingUrl), row.auditId);
  }

  return { bySku, byItemId };
}

function resolveAuditIdForIdentifiers(
  identifiers: { sku?: string | null; itemId?: string | null },
  matchers: { bySku: Map<string, number>; byItemId: Map<string, number> },
): number | null {
  const sku = identifiers.sku?.trim().toLowerCase();
  if (sku && matchers.bySku.has(sku)) {
    return matchers.bySku.get(sku)!;
  }

  const itemId = identifiers.itemId?.trim();
  if (itemId && matchers.byItemId.has(itemId)) {
    return matchers.byItemId.get(itemId)!;
  }

  const itemFromSku = parseEbayItemIdFromSku(identifiers.sku);
  if (itemFromSku && matchers.byItemId.has(itemFromSku)) {
    return matchers.byItemId.get(itemFromSku)!;
  }

  return null;
}

function resolveAuditIdForLineItem(
  lineItem: EbayFulfillmentLineItem,
  matchers: { bySku: Map<string, number>; byItemId: Map<string, number> },
): number | null {
  const legacyItemId = lineItem.legacyReference?.legacyItemId?.trim()
    || lineItem.legacyItemId?.trim();
  return resolveAuditIdForIdentifiers(
    { sku: lineItem.sku, itemId: legacyItemId ?? null },
    matchers,
  );
}

function resolveAuditIdForTradingLine(
  line: EbayTradingOrderLine,
  matchers: { bySku: Map<string, number>; byItemId: Map<string, number> },
): number | null {
  return resolveAuditIdForIdentifiers(
    { sku: line.sku, itemId: line.itemId },
    matchers,
  );
}

function mapTradingOrderStatus(orderStatus: string): ProductOrderStatus {
  const normalized = orderStatus.trim().toLowerCase();
  if (normalized.includes("cancel")) return "returned";
  if (normalized.includes("shipped") || normalized === "shipped") return "shipped";
  if (normalized === "completed" || normalized.includes("complete")) return "delivered";
  return "processing";
}

function mapEbayOrderStatus(order: EbayFulfillmentOrder, lineItem: EbayFulfillmentLineItem): ProductOrderStatus {
  const cancelState = order.cancelStatus?.cancelState?.trim().toUpperCase();
  if (cancelState && cancelState !== "NONE_REQUESTED") {
    return "returned";
  }

  const lineStatus = lineItem.lineItemFulfillmentStatus?.trim().toUpperCase();
  const orderStatus = order.orderFulfillmentStatus?.trim().toUpperCase();

  if (lineStatus === "FULFILLED" || orderStatus === "FULFILLED") {
    return "delivered";
  }
  if (lineStatus === "IN_PROGRESS" || orderStatus === "IN_PROGRESS") {
    return "shipped";
  }
  return "processing";
}

function customerName(order: EbayFulfillmentOrder): string {
  const fullName = order.buyer?.buyerRegistrationAddress?.fullName?.trim();
  if (fullName) return fullName;
  const username = order.buyer?.username?.trim();
  if (username) return username;
  return "eBay buyer";
}

function lineItemAmountCents(lineItem: EbayFulfillmentLineItem): number {
  const totalValue = Number.parseFloat(lineItem.lineItemCost?.value ?? "");
  if (!Number.isFinite(totalValue) || totalValue <= 0) return 0;
  return Math.round(totalValue * 100);
}

function orderNumberForLineItem(orderId: string, lineItemId: string): string {
  return `${orderId} · ${lineItemId}`;
}

function parseOrderDate(order: EbayFulfillmentOrder): Date {
  const raw = order.creationDate?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function lineItemCurrency(lineItem: EbayFulfillmentLineItem, order: EbayFulfillmentOrder): string {
  return lineItem.lineItemCost?.currency?.trim()
    || order.pricingSummary?.total?.currency?.trim()
    || "USD";
}

export async function syncEbayOrders(input: {
  workspaceId: number;
}): Promise<EbayOrderSyncResult> {
  const result: EbayOrderSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    totalOrders: 0,
    errors: [],
  };

  const matchers = await loadEbayAuditMatchers(input.workspaceId);
  if (matchers.bySku.size === 0 && matchers.byItemId.size === 0) {
    return result;
  }

  await ensureProductOrdersSchemaMigrated();

  let accessToken: string;
  let environment: "sandbox" | "production";
  try {
    const tokens = await resolveEbayAccessToken(input.workspaceId);
    accessToken = tokens.accessToken;
    environment = tokens.environment;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "eBay authorization failed");
    return result;
  }

  const createdAtMin = new Date();
  createdAtMin.setDate(createdAtMin.getDate() - 365);

  let orders: EbayFulfillmentOrder[] = [];
  try {
    orders = await listEbayFulfillmentOrders({
      environment,
      accessToken,
      creationDateMin: createdAtMin.toISOString(),
      maxOrders: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/scope|access|401|403|insufficient/i.test(message)) {
      result.errors.push(
        "eBay order sync needs the sell.fulfillment.readonly scope. Disconnect and reconnect eBay on Marketplaces, then open Orders again.",
      );
    } else {
      result.errors.push(`Could not fetch eBay orders: ${message}`);
    }
    return result;
  }

  result.totalOrders = orders.length;
  const importedKeys = new Set<string>();

  for (const order of orders) {
    const orderId = order.orderId?.trim();
    if (!orderId) continue;

    const paymentStatus = mapEbayPaymentStatus(order);
    const orderedAt = parseOrderDate(order);

    for (const lineItem of order.lineItems ?? []) {
      const lineRef = lineItem.lineItemId?.trim()
        || lineItem.legacyReference?.legacyTransactionId?.trim()
        || lineItem.legacyReference?.legacyItemId?.trim()
        || lineItem.legacyItemId?.trim();
      if (!lineRef) {
        result.skipped += 1;
        continue;
      }

      const auditId = resolveAuditIdForLineItem(lineItem, matchers);
      if (!auditId) {
        result.skipped += 1;
        continue;
      }

      const dedupeKey = `${auditId}|${orderId}|${lineRef}`;
      if (importedKeys.has(dedupeKey)) continue;
      importedKeys.add(dedupeKey);

      try {
        const outcome = await upsertProductOrderRow({
          auditId,
          workspaceId: input.workspaceId,
          marketplace: "eBay",
          orderNumber: orderNumberForLineItem(orderId, lineRef),
          customerName: customerName(order),
          quantity: lineItem.quantity ?? 1,
          amountCents: lineItemAmountCents(lineItem),
          currency: lineItemCurrency(lineItem, order),
          status: mapEbayOrderStatus(order, lineItem),
          paymentStatus,
          orderedAt,
          trackingNumber: null,
        });
        if (outcome === "imported") result.imported += 1;
        else result.updated += 1;
      } catch (err) {
        result.errors.push(formatProductOrderSyncError(err, orderId));
      }
    }
  }

  if (isEbayTradingApiConfigured(environment)) {
    try {
      const tradingLines = await fetchEbayTradingOrderLines({
        environment,
        accessToken,
        createTimeFrom: createdAtMin,
        createTimeTo: new Date(),
        maxOrders: 200,
      });
      result.totalOrders += tradingLines.length;

      for (const line of tradingLines) {
        const auditId = resolveAuditIdForTradingLine(line, matchers);
        if (!auditId) {
          result.skipped += 1;
          continue;
        }

        const dedupeKey = `${auditId}|${line.orderId}|${line.transactionId}`;
        if (importedKeys.has(dedupeKey)) continue;
        importedKeys.add(dedupeKey);

        try {
          const outcome = await upsertProductOrderRow({
            auditId,
            workspaceId: input.workspaceId,
            marketplace: "eBay",
            orderNumber: orderNumberForLineItem(line.orderId, line.transactionId),
            customerName: line.customerName,
            quantity: line.quantity,
            amountCents: line.amountCents,
            currency: line.currency,
            status: mapTradingOrderStatus(line.orderStatus),
            paymentStatus: line.paid ? "received" : "pending",
            orderedAt: line.orderedAt,
            trackingNumber: null,
          });
          if (outcome === "imported") result.imported += 1;
          else result.updated += 1;
        } catch (err) {
          result.errors.push(formatProductOrderSyncError(err, line.orderId));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (orders.length === 0) {
        result.errors.push(`Could not fetch eBay orders (Trading API): ${message}`);
      } else {
        reqLogTradingFallback(message);
      }
    }
  } else if (orders.length === 0 && result.imported === 0 && result.updated === 0) {
    result.errors.push(
      "No eBay orders returned from Fulfillment API. Configure Trading API keys (DEV_ID/CERT_ID) on the server for sandbox order sync, or reconnect eBay with fulfillment access.",
    );
  }

  if (
    result.totalOrders > 0
    && result.imported === 0
    && result.updated === 0
    && result.errors.length === 0
  ) {
    result.errors.push(
      "eBay returned orders but none matched this workspace's product SKUs or item IDs. Confirm the listing SKU (e.g. SL-{itemId}) matches SellerLens.",
    );
  }

  lastSyncByWorkspace.set(input.workspaceId, Date.now());
  return result;
}

function reqLogTradingFallback(message: string): void {
  console.warn("eBay Trading order sync fallback failed:", message);
}

export async function maybeSyncEbayOrdersForWorkspace(input: {
  workspaceId: number;
  force?: boolean;
}): Promise<EbayOrderSyncResult | null> {
  const lastSync = lastSyncByWorkspace.get(input.workspaceId) ?? 0;
  if (!input.force && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    return null;
  }

  try {
    return await syncEbayOrders({ workspaceId: input.workspaceId });
  } catch (err) {
    console.error("eBay order sync failed:", err);
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      totalOrders: 0,
      errors: [err instanceof Error ? err.message : "eBay order sync failed"],
    };
  }
}
