import type { ProductOrderPaymentStatus } from "./product-orders.js";
import type { ShopifyRestOrder } from "./shopify-admin-client.js";
import type { WooCommerceRestOrder } from "./woocommerce-admin-client.js";

export function mapShopifyPaymentStatus(order: ShopifyRestOrder): ProductOrderPaymentStatus {
  if (order.cancelled_at) return "refunded";

  const financialStatus = order.financial_status?.trim().toLowerCase() ?? "";
  if (financialStatus === "refunded" || financialStatus === "voided") {
    return "refunded";
  }
  if (financialStatus === "paid" || financialStatus === "partially_paid") {
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
