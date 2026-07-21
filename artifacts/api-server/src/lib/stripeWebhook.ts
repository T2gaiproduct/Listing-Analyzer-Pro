import Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db, plansTable, creditsTable, creditTransactionsTable,
  paymentsTable, subscriptionsTable, userProfilesTable,
} from "@workspace/db";
import { logger } from "./logger";
import { fulfillStripeCreditCheckout } from "./stripe-credit-checkout";
import { grantPlanCreditsDelta } from "./subscription-credits";
import { fulfillStripeSubscriptionCheckout } from "./subscription-fulfillment";

/**
 * App-specific Stripe webhook handling.
 * Called *after* stripe-replit-sync has processed and synced the event
 * to the stripe schema. We use the synced data to update our app tables.
 */

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const type = event.type;
  logger.info({ type, id: event.id }, "Stripe webhook event");

  switch (type) {
    case "invoice.paid": {
      await handleInvoicePaid(event.data.object as unknown as Parameters<typeof handleInvoicePaid>[0]);
      break;
    }
    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(event.data.object as unknown as Parameters<typeof handleSubscriptionDeleted>[0]);
      break;
    }
    case "customer.subscription.updated": {
      await handleSubscriptionUpdated(event.data.object as unknown as Parameters<typeof handleSubscriptionUpdated>[0]);
      break;
    }
    case "checkout.session.completed": {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    }
    default:
      // Other events are handled by stripe-replit-sync syncing to stripe schema
      break;
  }
}

async function handleInvoicePaid(invoice: Record<string, unknown> & { id: string; customer: string | unknown; subscription?: string | unknown; amount_paid?: number; period_start?: number; period_end?: number; billing_reason?: string }): Promise<void> {
  // Skip if not a subscription invoice or already recorded
  if (!invoice.subscription) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customerId) return;

  // Find user by Stripe customer ID
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.stripeCustomerId, customerId));
  if (!profile) {
    logger.warn({ customerId }, "No user found for Stripe customer");
    return;
  }

  const userId = profile.userId;

  // Check if already recorded (idempotency)
  const existing = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.gatewayPaymentId, invoice.id));
  if (existing.length > 0) {
    logger.info({ invoiceId: invoice.id }, "Invoice already recorded");
    return;
  }

  // Find the subscription to get the plan
  const [appSub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  if (!appSub || !appSub.planId) {
    logger.warn({ userId }, "No subscription found for invoice payment");
    return;
  }

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, appSub.planId));
  if (!plan) {
    logger.warn({ planId: appSub.planId }, "Plan not found for invoice payment");
    return;
  }

  const amount = (invoice.amount_paid ?? 0) / 100;
  const billingReason = invoice.billing_reason ?? "subscription_cycle";
  const isInitialSubscription = billingReason === "subscription_create";

  // Persist coupon info from subscription record
  const couponCode = appSub.couponCode ?? null;
  const discountAmount = appSub.discountAmount ? Number(appSub.discountAmount) : null;

  // Record payment
  await db.insert(paymentsTable).values({
    userId,
    planId: plan.id,
    amount,
    status: "completed",
    gateway: "stripe",
    gatewayPaymentId: invoice.id,
    couponCode,
    discountAmount,
    metadata: { type: isInitialSubscription ? "subscription_initial" : "subscription_renewal", billingReason },
  });

  const now = new Date();
  if (isInitialSubscription) {
    await grantPlanCreditsDelta(userId, plan, `${plan.name} plan — initial subscription`);
  } else {
    const [existingCredits] = await db
      .select()
      .from(creditsTable)
      .where(eq(creditsTable.userId, userId));

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
      await db.insert(creditsTable).values({
        userId,
        aiCredits: plan.aiCredits,
        imageCredits: plan.imageCredits,
        auditCredits: plan.auditCredits,
      });
    }

    await db.insert(creditTransactionsTable).values([
      { userId, creditType: "ai", amount: plan.aiCredits, reason: `Renewal — ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "image", amount: plan.imageCredits, reason: `Renewal — ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "audit", amount: plan.auditCredits, reason: `Renewal — ${plan.name}`, featureType: "subscription" },
    ]);
  }

  // Update subscription period dates from the invoice
  const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : now;
  const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(now);
  if (!invoice.period_end) {
    if (appSub.billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const stripeSubId = typeof invoice.subscription === "string" ? invoice.subscription : null;

  await db.update(subscriptionsTable)
    .set({
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      ...(stripeSubId ? { stripeSubscriptionId: stripeSubId } : {}),
      updatedAt: now,
    })
    .where(eq(subscriptionsTable.userId, userId));

  logger.info({ userId, planId: plan.id, amount, billingReason }, "Invoice paid — subscription updated");
}

async function handleSubscriptionDeleted(sub: Record<string, unknown> & { id: string; customer: string | unknown; status: string }): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) return;

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.stripeCustomerId, customerId));
  if (!profile) return;

  await db.update(subscriptionsTable)
    .set({ status: "cancelled", autoRenew: false, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, profile.userId));

  logger.info({ userId: profile.userId }, "Subscription cancelled via Stripe");
}

async function handleSubscriptionUpdated(sub: Record<string, unknown> & { id: string; customer: string | unknown; status: string; current_period_start?: number; current_period_end?: number; items?: Array<{ price?: { id: string } }> }): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) return;

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.stripeCustomerId, customerId));
  if (!profile) return;

  const userId = profile.userId;
  const statusMap: Record<string, string> = {
    active: "active",
    canceled: "cancelled",
    incomplete: "pending_payment",
    incomplete_expired: "cancelled",
    past_due: "past_due",
    paused: "paused",
    trialing: "trial",
    unpaid: "unpaid",
  };

  const newStatus = statusMap[sub.status] ?? sub.status;
  const currentPeriodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : undefined;
  const currentPeriodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : undefined;

  // Sync planId + billingCycle from Stripe price IDs
  const stripePriceId = sub.items?.[0]?.price?.id;
  let planId: number | undefined;
  let billingCycle: "monthly" | "yearly" | undefined;
  if (stripePriceId) {
    const plans = await db.select().from(plansTable);
    const matchedPlan = plans.find((p) => p.stripePriceIdMonthly === stripePriceId || p.stripePriceIdYearly === stripePriceId);
    if (matchedPlan) {
      planId = matchedPlan.id;
      billingCycle = matchedPlan.stripePriceIdYearly === stripePriceId ? "yearly" : "monthly";
    }
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    stripeSubscriptionId: sub.id,
    updatedAt: new Date(),
  };
  if (currentPeriodStart) updateData.currentPeriodStart = currentPeriodStart;
  if (currentPeriodEnd) updateData.currentPeriodEnd = currentPeriodEnd;
  if (planId) updateData.planId = planId;
  if (billingCycle) updateData.billingCycle = billingCycle;

  await db.update(subscriptionsTable)
    .set(updateData)
    .where(eq(subscriptionsTable.userId, userId));

  logger.info({ userId, status: newStatus, planId, billingCycle }, "Subscription updated from Stripe");
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode === "subscription") {
    const result = await fulfillStripeSubscriptionCheckout(session);
    if (result) {
      logger.info(
        { userId: result.userId, sessionId: session.id, alreadyProcessed: result.alreadyProcessed },
        "Subscription checkout fulfilled via checkout.session.completed",
      );
    }
    return;
  }

  if (session.mode !== "payment") return;

  const result = await fulfillStripeCreditCheckout(session);
  if (!result) return;

  logger.info(
    {
      userId: result.userId,
      addedCredits: result.addedCredits,
      creditType: result.creditType,
      alreadyProcessed: result.alreadyProcessed,
      sessionId: session.id,
    },
    "Credit purchase fulfilled via Stripe checkout.session.completed",
  );
}
