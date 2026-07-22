import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  plansTable,
  creditTransactionsTable,
  paymentsTable,
  subscriptionsTable,
  userProfilesTable,
} from "@workspace/db";
import { grantPlanCreditsDelta, subscriptionGrantsTotal, type PlanCredits } from "./subscription-credits";
import { planRowToGrantCredits } from "./plan-credits";
import { hasRequiredProfileFields, upsertUserProfile } from "./user-profile";
import { incrementCouponUsage, loadActiveCoupon } from "./coupon-validation.js";

export interface SubscriptionFulfillmentResult {
  activated: boolean;
  alreadyProcessed: boolean;
  userId: string;
}

export async function isGatewayPaymentProcessed(gatewayPaymentId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(eq(paymentsTable.gatewayPaymentId, gatewayPaymentId))
    .limit(1);
  return !!existing;
}

export async function hasPlanCreditsGranted(userId: string, plan: PlanCredits): Promise<boolean> {
  const granted = await subscriptionGrantsTotal(userId);
  return (
    granted.aiCredits >= plan.aiCredits
    && granted.imageCredits >= plan.imageCredits
    && granted.auditCredits >= plan.auditCredits
  );
}

/**
 * Idempotent onboarding / free-plan activation.
 * Safe to retry — only tops up missing plan credits.
 */
export async function fulfillOnboardingPlan(params: {
  userId: string;
  plan: PlanCredits;
  idempotencyKey: string;
  reason: string;
}): Promise<{ alreadyProcessed: boolean; creditsGranted: boolean }> {
  if (await isGatewayPaymentProcessed(params.idempotencyKey)) {
    return { alreadyProcessed: true, creditsGranted: false };
  }

  const creditsGranted = await grantPlanCreditsDelta(
    params.userId,
    await planRowToGrantCredits(params.plan),
    params.reason,
  );

  await db.insert(paymentsTable).values({
    userId: params.userId,
    planId: params.plan.id,
    amount: 0,
    status: "completed",
    gateway: "onboarding",
    gatewayPaymentId: params.idempotencyKey,
    metadata: { type: "onboarding", planId: params.plan.id },
  });

  return { alreadyProcessed: false, creditsGranted };
}

/**
 * Activate a paid Stripe Checkout subscription session.
 * Idempotent — safe from client polling and overlapping invoice webhooks.
 */
export async function fulfillStripeSubscriptionCheckout(
  session: Stripe.Checkout.Session,
): Promise<SubscriptionFulfillmentResult | null> {
  if (session.mode !== "subscription") return null;

  const userId = session.metadata?.userId;
  if (!userId || typeof userId !== "string") return null;

  if (session.payment_status !== "paid") return null;

  const sessionId = session.id;
  const planId = Number(session.metadata?.planId);
  const billingCycle = (session.metadata?.billingCycle ?? "monthly") as "monthly" | "yearly";
  if (!planId) return null;

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) return null;

  if (await isGatewayPaymentProcessed(sessionId)) {
    return { activated: true, alreadyProcessed: true, userId };
  }

  const [existingSub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (
    existingSub?.status === "active"
    && existingSub.planId === plan.id
    && (existingSub.stripeCheckoutSessionId === sessionId || await hasPlanCreditsGranted(userId, await planRowToGrantCredits(plan)))
  ) {
    const customerId = typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ?? null;
    const meta = session.metadata ?? {};
    const profileFromMeta = {
      fullName: meta.fullName || undefined,
      companyName: meta.companyName || undefined,
      phone: meta.phone || undefined,
      country: meta.country || undefined,
      gstNumber: meta.gstNumber || undefined,
      websiteUrl: meta.websiteUrl || undefined,
      teamSize: meta.teamSize ? Number(meta.teamSize) : undefined,
    };
    const [profileRow] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    const needsProfileBackfill = !profileRow?.fullName && hasRequiredProfileFields(profileFromMeta);

    await upsertUserProfile(userId, {
      onboardingCompleted: true,
      stripeCustomerId: customerId ?? profileRow?.stripeCustomerId ?? null,
      ...(needsProfileBackfill ? profileFromMeta : {}),
    });

    if (existingSub.stripeCheckoutSessionId !== sessionId || !existingSub.stripeSubscriptionId) {
      const stripeSub = session.subscription as Stripe.Subscription | null;
      const stripeSubId = stripeSub && typeof stripeSub === "object" ? stripeSub.id : null;
      await db.update(subscriptionsTable)
        .set({
          stripeCheckoutSessionId: sessionId,
          ...(stripeSubId ? { stripeSubscriptionId: stripeSubId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.userId, userId));
    }
    return { activated: true, alreadyProcessed: true, userId };
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  const stripeSub = session.subscription as Stripe.Subscription | null;
  if (stripeSub && typeof stripeSub === "object" && stripeSub.default_payment_method) {
    try {
      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const pm = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method as string);
      cardLast4 = pm.card?.last4 ?? null;
      cardBrand = pm.card?.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : null;
    } catch { /* best effort */ }
  }

  const stripeSubId = stripeSub && typeof stripeSub === "object" ? stripeSub.id : null;

  const subData = {
    planId: plan.id,
    billingCycle,
    status: "active" as const,
    trialEndsAt: null,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cardLast4,
    cardBrand,
    stripeCheckoutSessionId: sessionId,
    stripeSubscriptionId: stripeSubId,
    updatedAt: now,
  };

  if (existingSub) {
    await db.update(subscriptionsTable).set(subData).where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, ...subData });
  }

  await grantPlanCreditsDelta(userId, await planRowToGrantCredits(plan), `${plan.name} plan — payment confirmed`);

  const amount = session.amount_total != null
    ? session.amount_total / 100
    : (billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly);

  await db.insert(paymentsTable).values({
    userId,
    planId: plan.id,
    amount,
    status: "completed",
    gateway: "stripe",
    gatewayPaymentId: sessionId,
    metadata: { type: "subscription_checkout", billingCycle, stripeSubscriptionId: stripeSubId },
  });

  const customerId = typeof session.customer === "string"
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id ?? null;
  const meta = session.metadata ?? {};
  const profileFromMeta = {
    fullName: meta.fullName || undefined,
    companyName: meta.companyName || undefined,
    phone: meta.phone || undefined,
    country: meta.country || undefined,
    gstNumber: meta.gstNumber || undefined,
    websiteUrl: meta.websiteUrl || undefined,
    teamSize: meta.teamSize ? Number(meta.teamSize) : undefined,
  };
  const hasMetaProfile = hasRequiredProfileFields(profileFromMeta);

  const [profileRow] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const needsProfileBackfill = !profileRow?.fullName && hasMetaProfile;

  await upsertUserProfile(userId, {
    onboardingCompleted: true,
    stripeCustomerId: customerId ?? profileRow?.stripeCustomerId ?? null,
    ...(needsProfileBackfill ? profileFromMeta : {}),
  });

  const cc = session.metadata?.couponCode;
  if (cc) {
    const coupon = await loadActiveCoupon(cc);
    if (coupon) {
      await incrementCouponUsage(coupon.id, coupon.usedCount);
    }
  }

  return { activated: true, alreadyProcessed: false, userId };
}
