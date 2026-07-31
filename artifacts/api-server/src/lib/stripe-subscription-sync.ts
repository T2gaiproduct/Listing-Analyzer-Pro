import { and, desc, eq } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  userProfilesTable,
} from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { fulfillStripeSubscriptionCheckout } from "./subscription-fulfillment";
import { upsertUserProfile } from "./user-profile";

const ACTIVE_STATUSES = new Set(["active", "trial", "trialing"]);

/**
 * Stripe checkout can complete while the app never runs fulfillment
 * (closed tab, auth cookie gap on redirect, webhook delay). Reconcile from
 * stored session id, payment rows, or the Stripe customer when status is
 * still pending_payment.
 */
export async function reconcilePendingStripeSubscription(userId: string): Promise<boolean> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) return false;
  if (ACTIVE_STATUSES.has(sub.status)) return true;
  if (sub.status !== "pending_payment") return false;

  const stripe = await getUncachableStripeClient();

  if (sub.stripeCheckoutSessionId) {
    const activated = await tryFulfillCheckoutSession(stripe, sub.stripeCheckoutSessionId);
    if (activated) return true;
  }

  const completedPayments = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.status, "completed"),
        eq(paymentsTable.gateway, "stripe"),
      ),
    )
    .orderBy(desc(paymentsTable.createdAt))
    .limit(5);

  for (const payment of completedPayments) {
    const sessionId = payment.gatewayPaymentId;
    if (!sessionId) continue;
    const meta = payment.metadata as { type?: string } | null;
    if (meta?.type && meta.type !== "subscription_checkout") continue;
    const activated = await tryFulfillCheckoutSession(stripe, sessionId);
    if (activated) return true;
  }

  if (sub.stripeSubscriptionId) {
    const activated = await tryActivateFromStripeSubscription(stripe, userId, sub.stripeSubscriptionId);
    if (activated) return true;
  }

  const [profile] = await db
    .select({ stripeCustomerId: userProfilesTable.stripeCustomerId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  if (profile?.stripeCustomerId) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        customer: profile.stripeCustomerId,
        limit: 10,
      });
      for (const session of sessions.data) {
        if (session.mode !== "subscription" || session.payment_status !== "paid") continue;
        if (session.metadata?.userId && session.metadata.userId !== userId) continue;
        const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ["subscription"] });
        const result = await fulfillStripeSubscriptionCheckout(expanded);
        if (result?.activated) return true;
      }
    } catch {
      /* best effort */
    }
  }

  return false;
}

async function tryFulfillCheckoutSession(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  sessionId: string,
): Promise<boolean> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.payment_status !== "paid") return false;
    const result = await fulfillStripeSubscriptionCheckout(session);
    return result?.activated ?? false;
  } catch {
    return false;
  }
}

async function tryActivateFromStripeSubscription(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  userId: string,
  stripeSubscriptionId: string,
): Promise<boolean> {
  try {
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (stripeSub.status !== "active" && stripeSub.status !== "trialing") return false;

    const now = new Date();
    const localStatus = stripeSub.status === "trialing" ? "trial" : "active";
    await db
      .update(subscriptionsTable)
      .set({
        status: localStatus,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        stripeSubscriptionId,
        updatedAt: now,
      })
      .where(eq(subscriptionsTable.userId, userId));
    await upsertUserProfile(userId, { onboardingCompleted: true });
    return true;
  } catch {
    return false;
  }
}
