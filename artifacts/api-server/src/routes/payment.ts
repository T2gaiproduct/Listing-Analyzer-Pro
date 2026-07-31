import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, settingsTable } from "@workspace/db";

import {
  fulfillGatewayPaymentIntent,
  recordPendingGatewayPayment,
  resolveGatewayOrder,
} from "../lib/gateway-payment";
import { isAllowedOrigin, isAllowedRedirectUrl } from "../lib/allowed-origins";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return row?.value ?? "";
}

export async function getGatewaySettings(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.category, "payment_gateway"));
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

function resolveAppBaseUrl(origin: string | undefined): string {
  if (origin && isAllowedOrigin(origin)) {
    return origin;
  }
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:3000";
}

// ─── GET /payment-config ──────────────────────────────────────────────────────
router.get("/payment-config", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.category, "payment_gateway"));
  const m: Record<string, string> = {};
  for (const r of rows) if (!r.isSecret) m[r.key] = r.value;

  res.json({
    defaultGateway: m.default_gateway ?? "stripe",
    currency: m.default_currency ?? "USD",
    stripe: {
      enabled: m.stripe_enabled === "true",
      publishableKey: m.stripe_publishable_key ?? "",
      mode: m.stripe_mode ?? "test",
    },
    razorpay: {
      enabled: m.razorpay_enabled === "true",
      keyId: m.razorpay_key_id ?? "",
    },
    paypal: {
      enabled: m.paypal_enabled === "true",
      clientId: m.paypal_client_id ?? "",
      mode: m.paypal_mode ?? "sandbox",
    },
  });
});

// ─── Razorpay ─────────────────────────────────────────────────────────────────

export async function razorpayFetch<T>(path: string, method: string, body?: unknown): Promise<T> {
  const keyId = await getSetting("razorpay_key_id");
  const keySecret = await getSetting("razorpay_key_secret");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json() as Promise<T>;
}

router.post("/razorpay/create-order", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;

  let resolved;
  try {
    resolved = await resolveGatewayOrder(userId, req.body as Record<string, unknown>);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const keyId = await getSetting("razorpay_key_id");
  if (!keyId) { res.status(400).json({ error: "Razorpay is not configured" }); return; }

  const order = await razorpayFetch<{ id: string; amount: number; currency: string; error?: { description: string } }>(
    "/orders", "POST",
    {
      amount: resolved.amountCents,
      currency: resolved.currency,
      receipt: `rcpt_${Date.now()}`,
    },
  );

  if (order.error) { res.status(400).json({ error: order.error.description }); return; }

  await recordPendingGatewayPayment({
    userId,
    gateway: "razorpay",
    gatewayOrderId: order.id,
    amountCents: resolved.amountCents,
    currency: resolved.currency,
    intent: resolved.intent,
    planId: resolved.planId,
  });

  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
});

router.post("/razorpay/verify-payment", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
  } = req.body as {
    razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment fields" }); return;
  }

  const keySecret = await getSetting("razorpay_key_secret");
  const hmac = crypto.createHmac("sha256", keySecret);
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  if (hmac.digest("hex") !== razorpay_signature) {
    res.status(400).json({ error: "Payment verification failed" }); return;
  }

  const payment = await razorpayFetch<{ amount: number; currency: string }>(
    `/payments/${razorpay_payment_id}`, "GET",
  );

  try {
    const result = await fulfillGatewayPaymentIntent({
      userId,
      gateway: "razorpay",
      gatewayPaymentId: razorpay_payment_id,
      gatewayOrderId: razorpay_order_id,
      paidAmountCents: payment.amount,
      currency: payment.currency,
    });

    res.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      ...(result.addedCredits !== undefined ? {
        addedCredits: result.addedCredits,
        newBalance: result.newBalance,
        creditType: result.creditType,
      } : {}),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── PayPal ───────────────────────────────────────────────────────────────────

export async function getPayPalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const s = await getGatewaySettings();
  const clientId = s.paypal_client_id ?? "";
  const secret = s.paypal_client_secret ?? "";
  const mode = s.paypal_mode ?? "sandbox";
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const r = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json() as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(`PayPal auth failed: ${d.error ?? "unknown"}`);
  return { token: d.access_token, baseUrl };
}

router.post("/paypal/create-order", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;
  const { origin, returnUrl, cancelUrl } = req.body as {
    origin?: string;
    returnUrl?: string;
    cancelUrl?: string;
  };

  let resolved;
  try {
    resolved = await resolveGatewayOrder(userId, req.body as Record<string, unknown>);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const s = await getGatewaySettings();
  const clientId = s.paypal_client_id ?? "";
  const base = resolveAppBaseUrl(origin);
  const defaultReturn = `${base}/checkout/paypal-success`;
  const defaultCancel = `${base}/checkout/cancel`;
  const finalReturnUrl = returnUrl && isAllowedRedirectUrl(returnUrl) ? returnUrl : defaultReturn;
  const finalCancelUrl = cancelUrl && isAllowedRedirectUrl(cancelUrl) ? cancelUrl : defaultCancel;

  let token: string, baseUrl: string;
  try {
    ({ token, baseUrl } = await getPayPalAccessToken());
  } catch (err) {
    res.status(400).json({ error: (err as Error).message }); return;
  }

  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: resolved.currency,
          value: resolved.amountDollars.toFixed(2),
        },
      }],
      application_context: {
        brand_name: "SellerLens",
        user_action: "PAY_NOW",
        return_url: finalReturnUrl,
        cancel_url: finalCancelUrl,
      },
    }),
  });
  const order = await orderRes.json() as {
    id: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
  };

  if (!order.id) { res.status(400).json({ error: order.message ?? "Failed to create PayPal order" }); return; }

  await recordPendingGatewayPayment({
    userId,
    gateway: "paypal",
    gatewayOrderId: order.id,
    amountCents: resolved.amountCents,
    currency: resolved.currency,
    intent: resolved.intent,
    planId: resolved.planId,
  });

  const approvalUrl = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ?? "";
  res.json({ orderId: order.id, approvalUrl, clientId });
});

router.post("/paypal/capture-order", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;
  const { orderId } = req.body as { orderId: string };
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  let token: string, baseUrl: string;
  try {
    ({ token, baseUrl } = await getPayPalAccessToken());
  } catch (err) {
    res.status(400).json({ error: (err as Error).message }); return;
  }

  const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const capture = await captureRes.json() as {
    status: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; amount: { value: string; currency_code: string } }> } }>;
    payer?: { email_address?: string };
    message?: string;
  };

  if (capture.status !== "COMPLETED") {
    res.status(400).json({ error: capture.message ?? `PayPal capture failed: ${capture.status}` }); return;
  }

  const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
  const paidAmountCents = Math.round(parseFloat(captureUnit?.amount?.value ?? "0") * 100);
  const currency = captureUnit?.amount?.currency_code ?? "USD";
  const payerEmail = capture.payer?.email_address ?? "";

  try {
    const result = await fulfillGatewayPaymentIntent({
      userId,
      gateway: "paypal",
      gatewayPaymentId: captureUnit?.id ?? orderId,
      gatewayOrderId: orderId,
      paidAmountCents,
      currency,
      payerEmail,
    });

    res.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      payer: payerEmail,
      ...(result.addedCredits !== undefined ? {
        addedCredits: result.addedCredits,
        newBalance: result.newBalance,
        creditType: result.creditType,
      } : {}),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
