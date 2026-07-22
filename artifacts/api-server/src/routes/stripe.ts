import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, plansTable,
  userProfilesTable, subscriptionsTable,
} from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { hasRequiredProfileFields, upsertUserProfile } from "../lib/user-profile";
import { fulfillStripeSubscriptionCheckout } from "../lib/subscription-fulfillment";
import {
  resolveCoupon,
  couponErrorMessage,
  computeCouponDiscountAmount,
} from "../lib/coupon-validation.js";
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
    fullName?: string; companyName?: string; phone?: string; country?: string;
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

  // Upsert profile (phone is optional — matches onboarding form)
  const [existingProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let stripeCustomerId = existingProfile?.stripeCustomerId ?? null;

  if (hasRequiredProfileFields({ fullName, companyName, country })) {
    await upsertUserProfile(userId, {
      fullName,
      companyName,
      phone,
      country,
      gstNumber,
      websiteUrl,
      teamSize,
    });
  }

  // Validate coupon
  let discountAmount = 0;
  let stripeCouponId: string | null = null;
  let appliedCouponCode: string | null = null;
  if (couponCode) {
    const couponResult = await resolveCoupon(couponCode);
    if (!couponResult.ok) {
      res.status(400).json({ error: couponErrorMessage(couponResult.error) });
      return;
    }
    const { coupon } = couponResult;
    appliedCouponCode = coupon.code;
    const basePrice = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
    discountAmount = computeCouponDiscountAmount(coupon, basePrice);
    try {
      const stripeClient = await getUncachableStripeClient();
      const sc = await stripeClient.coupons.create({
        ...(coupon.discountPercent
          ? { percent_off: coupon.discountPercent, duration: "once", name: coupon.code }
          : {
            amount_off: Math.round((coupon.discountAmount ?? 0) * 100),
            currency: "usd",
            duration: "once",
            name: coupon.code,
          }),
      });
      stripeCouponId = sc.id;
    } catch (stripeCouponErr) {
      req.log?.error?.({ stripeCouponErr, couponCode: coupon.code }, "Stripe coupon creation failed");
      res.status(502).json({ error: "Could not apply this coupon to checkout. Please try again or contact support." });
      return;
    }
  }

  // Create or reuse Stripe customer
  const stripe = await getUncachableStripeClient();
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    stripeCustomerId = customer.id;
    await upsertUserProfile(userId, { stripeCustomerId });
  }

  // Mark subscription as pending (skip if already active on this plan)
  const [existingSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existingSub?.status === "active" && existingSub.planId === plan.id) {
    res.status(409).json({ error: "You already have an active subscription for this plan." });
    return;
  }

  if (existingSub) {
    await db.update(subscriptionsTable)
      .set({ planId: plan.id, billingCycle, status: "pending_payment", couponCode: appliedCouponCode, discountAmount, autoRenew: autoRenew ?? true, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, planId: plan.id, billingCycle, status: "pending_payment", couponCode: appliedCouponCode, discountAmount, autoRenew: autoRenew ?? true });
  }

  // Build session params
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      planId: String(planId),
      billingCycle,
      couponCode: appliedCouponCode ?? "",
      fullName: fullName ?? "",
      companyName: companyName ?? "",
      phone: phone ?? "",
      country: country ?? "",
      gstNumber: gstNumber ?? "",
      websiteUrl: websiteUrl ?? "",
      teamSize: teamSize != null ? String(teamSize) : "",
    },
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

  if (session.metadata?.userId && session.metadata.userId !== userId) {
    res.status(403).json({ error: "Session does not belong to this user" });
    return;
  }

  if (session.payment_status !== "paid") {
    res.json({ status: session.payment_status, activated: false });
    return;
  }

  const result = await fulfillStripeSubscriptionCheckout(session);
  if (!result) {
    res.status(400).json({ error: "Unable to activate subscription for this checkout session" });
    return;
  }

  res.json({ status: "paid", activated: result.activated, alreadyProcessed: result.alreadyProcessed });
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
