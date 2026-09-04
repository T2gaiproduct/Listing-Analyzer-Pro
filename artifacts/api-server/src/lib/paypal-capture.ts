import { and, eq } from "drizzle-orm";
import { db, paymentsTable } from "@workspace/db";
import { getGatewaySettings, requestPayPalAccessToken } from "./paypal-client";
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
  name?: string;
  details?: Array<{ issue?: string; description?: string }>;
};

export type PayPalReconcileRow = {
  orderId: string;
  success: boolean;
  error?: string;
  paypalStatus?: string;
  alreadyProcessed?: boolean;
};

async function fetchPayPalOrder(token: string, baseUrl: string, orderId: string): Promise<PayPalOrder> {
  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as PayPalOrder;
  if (!res.ok) {
    const detail = data.details?.[0]?.description ?? data.message ?? data.name;
    throw new Error(detail ?? `PayPal API error (${res.status})`);
  }
  return data;
}

function formatPayPalError(order: PayPalOrder, fallback: string): string {
  const detail = order.details?.[0]?.description ?? order.details?.[0]?.issue;
  return detail ?? order.message ?? order.name ?? fallback;
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
    throw new Error(`PayPal order not payable (${order.status})`);
  }

  if (order.status === "CREATED" || order.status === "PAYER_ACTION_REQUIRED") {
    throw new Error(
      "PayPal checkout was not completed — the customer must approve payment on PayPal before capture.",
    );
  }

  const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const capture = await captureRes.json() as PayPalOrder;

  if (capture.status === "COMPLETED") {
    return capture;
  }

  if (!captureRes.ok) {
    throw new Error(formatPayPalError(capture, `PayPal capture failed (${captureRes.status})`));
  }

  const refreshed = await fetchPayPalOrder(token, baseUrl, orderId);
  if (refreshed.status === "COMPLETED") {
    return refreshed;
  }

  throw new Error(formatPayPalError(capture, `PayPal capture failed: ${capture.status}`));
}

export async function fulfillPayPalOrderForUser(
  userId: string,
  orderId: string,
): Promise<Awaited<ReturnType<typeof fulfillGatewayPaymentIntent>> | null> {
  const outcome = await tryFulfillPayPalOrder(userId, orderId);
  return outcome.success ? outcome.result ?? null : null;
}

export async function tryFulfillPayPalOrder(
  userId: string,
  orderId: string,
): Promise<PayPalReconcileRow & { result?: Awaited<ReturnType<typeof fulfillGatewayPaymentIntent>> }> {
  try {
    const s = await getGatewaySettings();
    const { token, baseUrl } = await requestPayPalAccessToken({
      clientId: s.paypal_client_id ?? "",
      clientSecret: s.paypal_client_secret ?? "",
      mode: s.paypal_mode,
    });
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

    const result = await fulfillGatewayPaymentIntent({
      userId,
      gateway: "paypal",
      gatewayPaymentId,
      gatewayOrderId: orderId,
      paidAmountCents,
      currency,
      payerEmail,
    });

    return {
      orderId,
      success: true,
      paypalStatus: capture.status,
      alreadyProcessed: result.alreadyProcessed,
      result,
    };
  } catch (err) {
    let paypalStatus: string | undefined;
    try {
      const s = await getGatewaySettings();
      const { token, baseUrl } = await requestPayPalAccessToken({
        clientId: s.paypal_client_id ?? "",
        clientSecret: s.paypal_client_secret ?? "",
        mode: s.paypal_mode,
      });
      const order = await fetchPayPalOrder(token, baseUrl, orderId);
      paypalStatus = order.status;
    } catch {
      /* ignore status probe errors */
    }

    const message = err instanceof Error ? err.message : "PayPal fulfillment failed";
    logger.warn({ err, userId, orderId, paypalStatus }, "PayPal order fulfillment failed");
    return { orderId, success: false, error: message, paypalStatus };
  }
}

/** Retry capture + fulfillment for pending PayPal rows (e.g. user paid but never hit success page). */
export async function reconcileUserPendingPayPalPayments(userId: string): Promise<PayPalReconcileRow[]> {
  const pendingRows = await db
    .select({ gatewayPaymentId: paymentsTable.gatewayPaymentId })
    .from(paymentsTable)
    .where(and(
      eq(paymentsTable.userId, userId),
      eq(paymentsTable.gateway, "paypal"),
      eq(paymentsTable.status, "pending"),
    ));

  const results: PayPalReconcileRow[] = [];
  for (const row of pendingRows) {
    const orderId = row.gatewayPaymentId;
    if (!orderId) continue;
    const outcome = await tryFulfillPayPalOrder(userId, orderId);
    results.push({
      orderId: outcome.orderId,
      success: outcome.success,
      error: outcome.error,
      paypalStatus: outcome.paypalStatus,
      alreadyProcessed: outcome.alreadyProcessed,
    });
  }
  return results;
}

/** Verify PayPal client id + secret can obtain an access token (saved settings or explicit overrides). */
export async function testPayPalCredentials(overrides?: {
  clientId?: string;
  clientSecret?: string;
  mode?: string;
}): Promise<{ ok: true; mode: string }> {
  const s = await getGatewaySettings();
  const mode = overrides?.mode?.trim() || s.paypal_mode || "sandbox";
  const clientId = overrides?.clientId?.trim() || s.paypal_client_id?.trim() || "";
  const clientSecret = overrides?.clientSecret?.trim() || s.paypal_client_secret?.trim() || "";

  if (!overrides && s.paypal_enabled !== "true") {
    throw new Error("PayPal is not enabled in payment gateway settings");
  }
  if (!clientId || !clientSecret) {
    throw new Error("PayPal Client ID and Client Secret are required. Paste the secret and save, or enter it before testing.");
  }

  const result = await requestPayPalAccessToken({ clientId, clientSecret, mode });
  return { ok: true, mode: result.mode };
}
