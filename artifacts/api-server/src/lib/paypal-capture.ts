import { and, eq } from "drizzle-orm";
import { db, paymentsTable } from "@workspace/db";
import { getPayPalAccessToken } from "./paypal-client";
import { fulfillGatewayPaymentIntent } from "./gateway-payment";
import { logger } from "./logger";

type PayPalCaptureUnit = {
  id: string;
  amount: { value: string; currency_code: string };
};

type PayPalOrder = {
  status: string;
  purchase_units?: Array<{
    payments?: { captures?: PayPalCaptureUnit[] };
  }>;
  payer?: { email_address?: string };
  message?: string;
};

async function fetchPayPalOrder(token: string, baseUrl: string, orderId: string): Promise<PayPalOrder> {
  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.json() as PayPalOrder;
}

/** Capture an approved PayPal order or return details when already completed. */
export async function resolvePayPalOrderCapture(
  token: string,
  baseUrl: string,
  orderId: string,
): Promise<PayPalOrder> {
  const order = await fetchPayPalOrder(token, baseUrl, orderId);

  if (order.status === "COMPLETED") {
    return order;
  }

  if (order.status === "VOIDED" || order.status === "SAVED") {
    throw new Error(`PayPal order not payable: ${order.status}`);
  }

  if (order.status === "CREATED") {
    throw new Error("PayPal payment was not approved yet");
  }

  const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const capture = await captureRes.json() as PayPalOrder;

  if (capture.status === "COMPLETED") {
    return capture;
  }

  // Order may already be captured — refresh from PayPal
  const refreshed = await fetchPayPalOrder(token, baseUrl, orderId);
  if (refreshed.status === "COMPLETED") {
    return refreshed;
  }

  throw new Error(capture.message ?? `PayPal capture failed: ${capture.status}`);
}

export async function fulfillPayPalOrderForUser(
  userId: string,
  orderId: string,
): Promise<Awaited<ReturnType<typeof fulfillGatewayPaymentIntent>> | null> {
  try {
    const { token, baseUrl } = await getPayPalAccessToken();
    const capture = await resolvePayPalOrderCapture(token, baseUrl, orderId);

    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    let paidAmountCents = Math.round(parseFloat(captureUnit?.amount?.value ?? "0") * 100);
    const currency = captureUnit?.amount?.currency_code ?? "USD";
    const payerEmail = capture.payer?.email_address ?? "";
    const gatewayPaymentId = captureUnit?.id ?? orderId;

    if (paidAmountCents === 0) {
      const [pending] = await db
        .select({ amount: paymentsTable.amount })
        .from(paymentsTable)
        .where(and(
          eq(paymentsTable.gateway, "paypal"),
          eq(paymentsTable.gatewayPaymentId, orderId),
          eq(paymentsTable.userId, userId),
        ))
        .limit(1);
      if (pending) {
        paidAmountCents = Math.round(Number(pending.amount) * 100);
      }
    }

    return await fulfillGatewayPaymentIntent({
      userId,
      gateway: "paypal",
      gatewayPaymentId,
      gatewayOrderId: orderId,
      paidAmountCents,
      currency,
      payerEmail,
    });
  } catch (err) {
    logger.warn({ err, userId, orderId }, "PayPal order fulfillment failed");
    return null;
  }
}

/** Retry capture + fulfillment for pending PayPal rows (e.g. user paid but never hit success page). */
export async function reconcileUserPendingPayPalPayments(userId: string): Promise<void> {
  const pendingRows = await db
    .select({ gatewayPaymentId: paymentsTable.gatewayPaymentId })
    .from(paymentsTable)
    .where(and(
      eq(paymentsTable.userId, userId),
      eq(paymentsTable.gateway, "paypal"),
      eq(paymentsTable.status, "pending"),
    ));

  for (const row of pendingRows) {
    const orderId = row.gatewayPaymentId;
    if (!orderId) continue;
    await fulfillPayPalOrderForUser(userId, orderId);
  }
}
