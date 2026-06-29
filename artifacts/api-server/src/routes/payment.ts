import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, settingsTable, subscriptionsTable, paymentsTable, plansTable, creditsTable, creditPacksTable, creditTransactionsTable, userProfilesTable } from "@workspace/db";

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

// ─── GET /payment-config ──────────────────────────────────────────────────────
// Public: returns active gateway + public keys only (no secrets)
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

// POST /razorpay/create-order — creates a Razorpay order for ₹1 card setup or plan purchase
router.post("/razorpay/create-order", requireAuth, async (req, res): Promise<void> => {
  const { amount, currency } = req.body as { amount?: number; currency?: string };
  if (!amount) { res.status(400).json({ error: "amount is required" }); return; }

  const keyId = await getSetting("razorpay_key_id");
  if (!keyId) { res.status(400).json({ error: "Razorpay is not configured" }); return; }

  const order = await razorpayFetch<{ id: string; amount: number; currency: string; error?: { description: string } }>(
    "/orders", "POST",
    { amount: Math.round(amount * 100), currency: currency ?? "INR", receipt: `rcpt_${Date.now()}` },
  );

  if (order.error) { res.status(400).json({ error: order.error.description }); return; }
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
});

// POST /razorpay/verify-payment — verifies HMAC signature, records payment, updates subscription
router.post("/razorpay/verify-payment", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    planId, billingCycle, creditType, creditAmount, packId,
  } = req.body as {
    razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
    planId?: number; billingCycle?: string;
    creditType?: "ai" | "image" | "audit"; creditAmount?: number; packId?: number;
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

  const payment = await razorpayFetch<{ amount: number; currency: string; contact?: string }>(
    `/payments/${razorpay_payment_id}`, "GET",
  );

  const amount = payment.amount / 100;
  await db.insert(paymentsTable).values({
    userId, amount, currency: payment.currency, status: "completed",
    gateway: "razorpay", gatewayPaymentId: razorpay_payment_id,
    ...(planId ? { planId } : {}),
  });

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existing) {
    const now = new Date();
    if (planId) {
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "yearly" ? 12 : 1));
      await db.update(subscriptionsTable)
        .set({ planId, billingCycle: billingCycle ?? "monthly", status: "active", trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: periodEnd, autoRenew: true, cardLast4: "rzpy", cardBrand: "Razorpay", updatedAt: now })
        .where(eq(subscriptionsTable.userId, userId));
    } else {
      await db.update(subscriptionsTable)
        .set({ cardBrand: "Razorpay", cardLast4: "rzpy", updatedAt: now })
        .where(eq(subscriptionsTable.userId, userId));
    }
  }

  // Credit purchase
  if (creditType && creditAmount) {
    const { addCredits } = await import("../lib/credits");
    const newBalance = await addCredits(
      userId, creditType, creditAmount,
      `Purchased ${creditAmount} ${creditType} credits via Razorpay`,
      "custom_credit_purchase",
      { razorpay_payment_id, gateway: "razorpay" },
    );
    await db.insert(paymentsTable).values({
      userId, amount: payment.amount / 100, currency: payment.currency, status: "completed",
      gateway: "razorpay", gatewayPaymentId: razorpay_payment_id,
      metadata: { type: "custom_credit", credits: creditAmount, creditType },
    });
    res.json({ success: true, addedCredits: creditAmount, newBalance, creditType });
    return;
  }

  if (packId) {
    const { addCredits } = await import("../lib/credits");
    const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, packId));
    if (pack) {
      const creditType = pack.creditType as "ai" | "image" | "audit";
      const newBalance = await addCredits(
        userId, creditType, pack.quantity,
        `Purchased ${pack.quantity} ${pack.creditType} credits (${pack.label ?? `Pack #${pack.id}`}) via Razorpay`,
        "credit_pack_purchase",
        { packId: pack.id, priceCents: pack.priceCents },
      );
      await db.insert(paymentsTable).values({
        userId, amount: payment.amount / 100, currency: payment.currency, status: "completed",
        gateway: "razorpay", gatewayPaymentId: razorpay_payment_id,
        metadata: { type: "credit_pack", packId: pack.id, credits: pack.quantity, creditType: pack.creditType },
      });
      res.json({ success: true, addedCredits: pack.quantity, newBalance, creditType });
      return;
    }
  }

  res.json({ success: true });
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

// POST /paypal/create-order — creates a PayPal order and returns the approval URL
router.post("/paypal/create-order", requireAuth, async (req, res): Promise<void> => {
  const { amount, currency, origin } = req.body as { amount?: number; currency?: string; origin?: string };
  if (!amount) { res.status(400).json({ error: "amount is required" }); return; }

  const s = await getGatewaySettings();
  const clientId = s.paypal_client_id ?? "";

  const domain = origin ?? process.env.REPLIT_DOMAINS?.split(",")[0];
  const base = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:80";

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
      purchase_units: [{ amount: { currency_code: currency ?? "USD", value: amount.toFixed(2) } }],
      application_context: {
        brand_name: "ListingAuditor",
        user_action: "PAY_NOW",
        return_url: `${base}/billing?paypal_captured=1`,
        cancel_url: `${base}/billing?paypal_cancelled=1`,
      },
    }),
  });
  const order = await orderRes.json() as {
    id: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
  };

  if (!order.id) { res.status(400).json({ error: order.message ?? "Failed to create PayPal order" }); return; }

  const approvalUrl = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ?? "";
  res.json({ orderId: order.id, approvalUrl, clientId });
});

// POST /paypal/capture-order — captures an approved PayPal order, records payment, updates subscription
router.post("/paypal/capture-order", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth!.userId!;
  const { orderId, planId, billingCycle, creditType, creditAmount, packId } = req.body as {
    orderId: string; planId?: number; billingCycle?: string;
    creditType?: "ai" | "image" | "audit"; creditAmount?: number; packId?: number;
  };
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
  const amount = parseFloat(captureUnit?.amount?.value ?? "0");
  const currency = captureUnit?.amount?.currency_code ?? "USD";
  const payerEmail = capture.payer?.email_address ?? "";

  await db.insert(paymentsTable).values({
    userId, amount, currency, status: "completed",
    gateway: "paypal", gatewayPaymentId: captureUnit?.id ?? orderId,
    ...(planId ? { planId } : {}),
  });

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const now = new Date();
  if (planId) {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "yearly" ? 12 : 1));
    const subData = {
      planId,
      billingCycle: billingCycle ?? "monthly",
      status: "active" as const,
      trialEndsAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
      cardBrand: "PayPal",
      cardLast4: payerEmail.slice(-4) || "ppal",
      updatedAt: now,
    };
    if (existing) {
      await db.update(subscriptionsTable).set(subData).where(eq(subscriptionsTable.userId, userId));
    } else {
      await db.insert(subscriptionsTable).values({ userId, ...subData });
    }

    // Set credits
    if (plan) {
      const [existingCredits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
      if (existingCredits) {
        await db.update(creditsTable)
          .set({
            aiCredits: existingCredits.aiCredits + plan.aiCredits,
            imageCredits: existingCredits.imageCredits + plan.imageCredits,
            auditCredits: existingCredits.auditCredits + plan.auditCredits,
            updatedAt: now,
          })
          .where(eq(creditsTable.userId, userId));
      } else {
        await db.insert(creditsTable).values({ userId, aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits });
      }
      await db.insert(creditTransactionsTable).values([
        { userId, creditType: "ai", amount: plan.aiCredits, reason: `${plan.name} plan — PayPal payment confirmed`, featureType: "subscription" },
        { userId, creditType: "image", amount: plan.imageCredits, reason: `${plan.name} plan — PayPal payment confirmed`, featureType: "subscription" },
        { userId, creditType: "audit", amount: plan.auditCredits, reason: `${plan.name} plan — PayPal payment confirmed`, featureType: "subscription" },
      ]);
    }

    // Mark onboarding complete
    const [profileRow] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    if (profileRow) {
      await db.update(userProfilesTable)
        .set({ onboardingCompleted: true, updatedAt: now })
        .where(eq(userProfilesTable.userId, userId));
    } else {
      await db.insert(userProfilesTable).values({ userId, onboardingCompleted: true });
    }
  } else if (existing) {
    await db.update(subscriptionsTable)
      .set({ cardBrand: "PayPal", cardLast4: payerEmail.slice(-4) || "ppal", updatedAt: now })
      .where(eq(subscriptionsTable.userId, userId));
  }

  // Credit purchase (no plan)
  if (creditType && creditAmount) {
    const { addCredits } = await import("../lib/credits");
    const newBalance = await addCredits(
      userId, creditType, creditAmount,
      `Purchased ${creditAmount} ${creditType} credits via PayPal`,
      "custom_credit_purchase",
      { orderId, gateway: "paypal" },
    );
    await db.insert(paymentsTable).values({
      userId, amount, currency, status: "completed",
      gateway: "paypal", gatewayPaymentId: captureUnit?.id ?? orderId,
      metadata: { type: "custom_credit", credits: creditAmount, creditType },
    });
    res.json({ success: true, payer: payerEmail, addedCredits: creditAmount, newBalance, creditType });
    return;
  }

  // Credit pack purchase
  if (packId) {
    const { addCredits } = await import("../lib/credits");
    const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, packId));
    if (pack) {
      const creditType = pack.creditType as "ai" | "image" | "audit";
      const newBalance = await addCredits(
        userId, creditType, pack.quantity,
        `Purchased ${pack.quantity} ${pack.creditType} credits (${pack.label ?? `Pack #${pack.id}`}) via PayPal`,
        "credit_pack_purchase",
        { packId: pack.id, priceCents: pack.priceCents },
      );
      await db.insert(paymentsTable).values({
        userId, amount, currency, status: "completed",
        gateway: "paypal", gatewayPaymentId: captureUnit?.id ?? orderId,
        metadata: { type: "credit_pack", packId: pack.id, credits: pack.quantity, creditType: pack.creditType },
      });
      res.json({ success: true, payer: payerEmail, addedCredits: pack.quantity, newBalance, creditType });
      return;
    }
  }

  res.json({ success: true, payer: payerEmail });
});

export default router;
