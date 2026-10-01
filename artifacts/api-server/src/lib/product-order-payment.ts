import type { ProductOrderPaymentStatus } from "./product-orders.js";
import type { ShopifyRestOrder, ShopifyRestOrderTransaction } from "./shopify-admin-client.js";
import type { WooCommerceRestOrder } from "./woocommerce-admin-client.js";

function parseShopifyMoney(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSuccessfulPaymentTransaction(tx: ShopifyRestOrderTransaction): boolean {
  const kind = tx.kind?.trim().toLowerCase() ?? "";
  const status = tx.status?.trim().toLowerCase() ?? "";
  if (status !== "success") return false;
  return kind === "sale" || kind === "capture";
}

function sumSuccessfulPayments(transactions: ShopifyRestOrderTransaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (!isSuccessfulPaymentTransaction(tx)) return sum;
    const amount = parseShopifyMoney(tx.amount);
    return amount == null ? sum : sum + amount;
  }, 0);
}

function shopifyOrderTotal(order: ShopifyRestOrder): number | null {
  return parseShopifyMoney(order.current_total_price ?? order.total_price);
}

function shopifyOrderIsFullyPaid(order: ShopifyRestOrder): boolean {
  const outstanding = parseShopifyMoney(order.total_outstanding);
  const total = shopifyOrderTotal(order);
  if (outstanding !== null && outstanding <= 0 && total !== null && total > 0) {
    return true;
  }

  const transactions = order.transactions ?? [];
  if (transactions.length === 0 || total == null || total <= 0) {
    return false;
  }

  const paid = sumSuccessfulPayments(transactions);
  return paid >= total - 0.01;
}

export function mapShopifyPaymentStatus(order: ShopifyRestOrder): ProductOrderPaymentStatus {
  if (order.cancelled_at) return "refunded";

  const financialStatus = order.financial_status?.trim().toLowerCase() ?? "";
  if (
    financialStatus === "refunded"
    || financialStatus === "partially_refunded"
    || financialStatus === "voided"
  ) {
    return "refunded";
  }
  if (
    financialStatus === "paid"
    || financialStatus === "partially_paid"
    || shopifyOrderIsFullyPaid(order)
  ) {
    return "received";
  }
  return "pending";
}

export function mapWooCommercePaymentStatus(order: WooCommerceRestOrder): ProductOrderPaymentStatus {
  const status = order.status.trim().toLowerCase();
  if (status === "refunded" || status === "cancelled" || status === "failed" || status === "trash") {
    return "refunded";
  }
  if (status === "completed" || status === "processing") {
    return "received";
  }
  return "pending";
}

export function mapAmazonPaymentStatus(orderStatus: string): ProductOrderPaymentStatus {
  const normalized = orderStatus.trim();
  if (normalized === "Canceled") return "refunded";
  if (normalized === "Pending") return "pending";
  return "received";
}

type EbayPaymentOrder = {
  cancelStatus?: { cancelState?: string };
  paymentSummary?: { paymentStatus?: string };
};

export function mapEbayPaymentStatus(order: EbayPaymentOrder): ProductOrderPaymentStatus {
  const cancelState = order.cancelStatus?.cancelState?.trim().toUpperCase();
  if (cancelState && cancelState !== "NONE_REQUESTED") {
    return "refunded";
  }

  const paymentStatus = order.paymentSummary?.paymentStatus?.trim().toUpperCase();
  if (paymentStatus === "FAILED" || paymentStatus === "FULLY_REFUNDED" || paymentStatus === "PARTIALLY_REFUNDED") {
    return "refunded";
  }
  if (paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID") {
    return "received";
  }
  return "pending";
}
