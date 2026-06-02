import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, plansTable, creditsTable, creditTransactionsTable, paymentsTable,
  userProfilesTable, subscriptionsTable, couponsTable,
} from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import type Stripe from "stripe";

const router: IRouter = Router();

interface AuthedRequest extends Request { userId: string; }

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as AuthedRequest).userId = userId;
  next();
}

// ─── POST /stripe/create-checkout ─────────────────────────────────────────────
// Creates a Stripe Checkout Session for a paid plan.
// The frontend redirects the user to the returned URL.
// Subscription is saved as "pending_payment" — never activated here.
router.post("/stripe/create-checkout", requireAuth, async (req, res): Promise<void> => {
  try {
  const userId = (req as AuthedRequest).userId;
  const {
    planId, billingCycle, couponCode, autoRenew,
    fullName, companyName, phone, country, gstNumber, websiteUrl, teamSize,
    successUrl, cancelUrl,
  } = req.body as {
    planId: number; billingCycle: "monthly" | "yearly";
    couponCode?: string; autoRenew?: boolean;
    fullName: string; companyName: string; phone: string; country: string;
    gstNumber?: string; websiteUrl?: string; teamSize?: number;
    successUrl: string; cancelUrl: string;
  };

  if (!planId || !billingCycle || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "planId, billingCycle, successUrl, and cancelUrl are required" });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }

  const priceId = billingCycle === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
  if (!priceId) {
    res.status(503).json({ error: "Payment configuration is not ready. Please contact support or try again shortly." });
    return;
  }

  // Upsert profile
  const [existingProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let stripeCustomerId = existingProfile?.stripeCustomerId ?? null;

  if (existingProfile) {
    await db.update(userProfilesTable)
      .set({ fullName, companyName, phone, country, gstNumber: gstNumber ?? null, websiteUrl: websiteUrl ?? null, teamSize: teamSize ?? null, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId));
  } else {
    await db.insert(userProfilesTable).values({ userId, fullName, companyName, phone, country, gstNumber: gstNumber ?? null, websiteUrl: websiteUrl ?? null, teamSize: teamSize ?? null });
  }

  // Validate coupon
  let discountAmount = 0;
  let stripeCouponId: string | null = null;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable)
      .where(and(eq(couponsTable.code, couponCode.toUpperCase()), eq(couponsTable.isActive, true)));
    if (coupon && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && (!coupon.expiryDate || new Date(coupon.expiryDate) >= new Date())) {
      const basePrice = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
      if (coupon.discountPercent) discountAmount = Math.round(basePrice * coupon.discountPercent / 100);
      else if (coupon.discountAmount) discountAmount = coupon.discountAmount;
      try {
        const stripe = await getUncachableStripeClient();
        const sc = await stripe.coupons.create({
          ...(coupon.discountPercent
            ? { percent_off: coupon.discountPercent }
            : { amount_off: Math.round(discountAmount * 100), currency: "usd" }),
          duration: "once",
          name: coupon.code,
        });
        stripeCouponId = sc.id;
      } catch { /* proceed without discount if coupon creation fails */ }
    }
  }

  // Create or reuse Stripe customer
  const stripe = await getUncachableStripeClient();
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    stripeCustomerId = customer.id;
    await db.update(userProfilesTable)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId));
  }

  // Mark subscription as pending
  const [existingSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existingSub) {
    await db.update(subscriptionsTable)
      .set({ planId: plan.id, billingCycle, status: "pending_payment", couponCode: couponCode ?? null, discountAmount, autoRenew: autoRenew ?? true, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, planId: plan.id, billingCycle, status: "pending_payment", couponCode: couponCode ?? null, discountAmount, autoRenew: autoRenew ?? true });
  }

  // Build session params
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, planId: String(planId), billingCycle, couponCode: couponCode ?? "" },
    subscription_data: { metadata: { userId, planId: String(planId), billingCycle } },
  };
  if (stripeCouponId) sessionParams.discounts = [{ coupon: stripeCouponId }];

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Persist session ID for idempotency check on activation
  await db.update(subscriptionsTable)
    .set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log?.error?.({ err }, "Stripe create-checkout failed");
    res.status(502).json({ error: "Unable to start checkout right now. Please try again shortly or contact support." });
  }
});

// ─── GET /stripe/session-status ───────────────────────────────────────────────
// Verifies a completed Stripe Checkout session and activates the subscription.
// Safe to call multiple times (idempotent).
router.get("/stripe/session-status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const sessionId = req.query.session_id as string;

  if (!sessionId) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  } catch {
    res.status(400).json({ error: "Invalid or expired checkout session" });
    return;
  }

  // Security: ensure session belongs to this user
  if (session.metadata?.userId && session.metadata.userId !== userId) {
    res.status(403).json({ error: "Session does not belong to this user" });
    return;
  }

  if (session.payment_status !== "paid") {
    res.json({ status: session.payment_status, activated: false });
    return;
  }

  // Idempotency: already activated?
  const [existingSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existingSub?.status === "active" && existingSub?.stripeCheckoutSessionId === sessionId) {
    res.json({ status: "paid", activated: true });
    return;
  }

  const planId = Number(session.metadata?.planId);
  const billingCycle = (session.metadata?.billingCycle ?? "monthly") as "monthly" | "yearly";
  if (!planId) { res.status(400).json({ error: "Missing plan in checkout session metadata" }); return; }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(400).json({ error: "Plan not found" }); return; }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Try to get card details from the Stripe subscription
  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  const stripeSub = session.subscription as Stripe.Subscription | null;
  if (stripeSub && typeof stripeSub === "object" && stripeSub.default_payment_method) {
    try {
      const pm = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method as string);
      cardLast4 = pm.card?.last4 ?? null;
      cardBrand = pm.card?.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : null;
    } catch { /* best effort */ }
  }

  const stripeSubId = stripeSub && typeof stripeSub === "object" ? stripeSub.id : null;

  // Activate subscription
  const subData = {
    planId: plan.id, billingCycle, status: "active" as const,
    trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: periodEnd,
    cardLast4, cardBrand,
    stripeCheckoutSessionId: sessionId,
    stripeSubscriptionId: stripeSubId,
    updatedAt: now,
  };

  if (existingSub) {
    await db.update(subscriptionsTable).set(subData).where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, ...subData });
  }

  // Set credits
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
    { userId, creditType: "ai", amount: plan.aiCredits, reason: `${plan.name} plan — payment confirmed`, featureType: "subscription" },
    { userId, creditType: "image", amount: plan.imageCredits, reason: `${plan.name} plan — payment confirmed`, featureType: "subscription" },
    { userId, creditType: "audit", amount: plan.auditCredits, reason: `${plan.name} plan — payment confirmed`, featureType: "subscription" },
  ]);

  // Record verified payment
  const amount = session.amount_total != null ? session.amount_total / 100 : (billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly);
  await db.insert(paymentsTable).values({
    userId, planId: plan.id, amount, status: "completed",
    gateway: "stripe", gatewayPaymentId: sessionId,
  });

  // Mark onboarding complete + persist Stripe customer ID
  const customerId = typeof session.customer === "string" ? session.customer : (session.customer as Stripe.Customer | null)?.id ?? null;
  const [profileRow] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (profileRow) {
    await db.update(userProfilesTable)
      .set({ onboardingCompleted: true, stripeCustomerId: customerId ?? profileRow.stripeCustomerId, updatedAt: now })
      .where(eq(userProfilesTable.userId, userId));
  }

  // Consume coupon usage counter
  const cc = session.metadata?.couponCode;
  if (cc) {
    const [coupon] = await db.select().from(couponsTable)
      .where(and(eq(couponsTable.code, cc.toUpperCase()), eq(couponsTable.isActive, true)));
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
  }

  res.json({ status: "paid", activated: true });
});

// ─── POST /stripe/portal ──────────────────────────────────────────────────────
// Opens the Stripe Billing Portal so users can manage their subscription,
// update payment method, download invoices, or cancel.
router.post("/stripe/portal", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { returnUrl } = req.body as { returnUrl?: string };

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile?.stripeCustomerId) {
    res.status(400).json({ error: "No payment method on file. Please subscribe to a paid plan first." });
    return;
  }

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const baseUrl = domain ? `https://${domain}` : "http://localhost:80";
  const stripe = await getUncachableStripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: returnUrl ?? `${baseUrl}/billing`,
  });

  res.json({ url: portalSession.url });
});

// ─── POST /stripe/setup-card ──────────────────────────────────────────────────
// Creates a Stripe Checkout Session (payment mode, $1 authorization hold) so the
// user can save a card without being charged. The hold is cancelled server-side
// in /stripe/setup-card-confirm after Stripe redirects back.
router.post("/stripe/setup-card", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { returnUrl } = req.body as { returnUrl?: string };

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const baseUrl = domain ? `https://${domain}` : "http://localhost:80";

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const stripe = await getUncachableStripeClient();

  let stripeCustomerId = profile?.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    stripeCustomerId = customer.id;
    if (profile) {
      await db.update(userProfilesTable)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId));
    } else {
      await db.insert(userProfilesTable).values({ userId, stripeCustomerId });
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: 100,
        product_data: { name: "Card Verification Hold", description: "A $1 authorization hold to verify your card — reversed immediately." },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      capture_method: "manual",
      setup_future_usage: "off_session",
      description: "Card verification — authorization hold, will be reversed",
    },
    success_url: `${baseUrl}/checkout/card-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl ?? `${baseUrl}/billing`,
    metadata: { userId, type: "card_setup" },
  });

  res.json({ url: session.url });
});

// ─── POST /stripe/setup-card-confirm ─────────────────────────────────────────
// Called from /checkout/card-success after Stripe redirects back.
// 1. Cancels the $1 PaymentIntent (releases the hold immediately).
// 2. Saves the card as the customer's default payment method.
// 3. Updates the user's subscription record with card details.
router.post("/stripe/setup-card-confirm", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { sessionId } = req.body as { sessionId: string };

  if (!sessionId) { res.status(400).json({ error: "sessionId is required" }); return; }

  const stripe = await getUncachableStripeClient();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  } catch {
    res.status(400).json({ error: "Invalid or expired session" });
    return;
  }

  if (session.metadata?.userId && session.metadata.userId !== userId) {
    res.status(403).json({ error: "Session does not belong to this user" });
    return;
  }

  if (session.metadata?.type !== "card_setup") {
    res.status(400).json({ error: "This session is not a card setup session" });
    return;
  }

  const pi = session.payment_intent as Stripe.PaymentIntent | null;

  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  let paymentMethodId: string | null = null;

  if (pi) {
    paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method as Stripe.PaymentMethod | null)?.id ?? null;

    if (paymentMethodId) {
      try {
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        cardLast4 = pm.card?.last4 ?? null;
        cardBrand = pm.card?.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : null;

        const customerId = typeof session.customer === "string" ? session.customer : null;
        if (customerId) {
          await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
        }
      } catch { /* best effort */ }
    }

    if (pi.status === "requires_capture") {
      try { await stripe.paymentIntents.cancel(pi.id); } catch { /* best effort */ }
    }
  }

  if (cardLast4 || cardBrand) {
    const [existingSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (existingSub) {
      await db.update(subscriptionsTable)
        .set({ cardLast4, cardBrand, updatedAt: new Date() })
        .where(eq(subscriptionsTable.userId, userId));
    }
  }

  res.json({ success: true, cardLast4, cardBrand });
});

export default router;
