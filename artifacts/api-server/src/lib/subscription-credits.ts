import { eq, and, gt } from "drizzle-orm";
import {
  db,
  creditsTable,
  creditTransactionsTable,
  subscriptionsTable,
  plansTable,
  paymentsTable,
} from "@workspace/db";
import { computePlanPoolsFromAllocations, planRowToGrantCredits } from "./plan-credits";
import { zeroAllWorkspaceCreditsForOwner } from "./workspace-credits.js";

export interface CreditBalances {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

export interface PlanCredits {
  id: number;
  name: string;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

const EMPTY_CREDITS: CreditBalances = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

function sumCredits(c: CreditBalances): number {
  return c.aiCredits + c.imageCredits + c.auditCredits;
}

export async function subscriptionGrantsTotal(userId: string): Promise<CreditBalances> {
  const grants = await db
    .select({
      creditType: creditTransactionsTable.creditType,
      amount: creditTransactionsTable.amount,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, userId),
        eq(creditTransactionsTable.featureType, "subscription"),
        gt(creditTransactionsTable.amount, 0),
      ),
    );

  const totals = { ...EMPTY_CREDITS };
  for (const g of grants) {
    if (g.creditType === "ai") totals.aiCredits += g.amount;
    else if (g.creditType === "image") totals.imageCredits += g.amount;
    else if (g.creditType === "audit") totals.auditCredits += g.amount;
  }
  return totals;
}

/**
 * Grant only the plan credits the user has not already received via subscription grants.
 * Returns true when any credits were added.
 */
function planUpgradeBump(
  previousPlan: PlanCredits,
  plan: PlanCredits,
): CreditBalances {
  return {
    aiCredits: Math.max(0, plan.aiCredits - previousPlan.aiCredits),
    imageCredits: Math.max(0, plan.imageCredits - previousPlan.imageCredits),
    auditCredits: Math.max(0, plan.auditCredits - previousPlan.auditCredits),
  };
}

export async function grantPlanCreditsDelta(
  userId: string,
  plan: PlanCredits,
  reason: string,
  options?: { previousPlan?: PlanCredits | null },
): Promise<boolean> {
  const granted = await subscriptionGrantsTotal(userId);
  const lifetimeDelta: CreditBalances = {
    aiCredits: Math.max(0, plan.aiCredits - granted.aiCredits),
    imageCredits: Math.max(0, plan.imageCredits - granted.imageCredits),
    auditCredits: Math.max(0, plan.auditCredits - granted.auditCredits),
  };

  const toAdd = { ...lifetimeDelta };
  if (options?.previousPlan) {
    const upgradeBump = planUpgradeBump(options.previousPlan, plan);
    toAdd.aiCredits = Math.max(toAdd.aiCredits, upgradeBump.aiCredits);
    toAdd.imageCredits = Math.max(toAdd.imageCredits, upgradeBump.imageCredits);
    toAdd.auditCredits = Math.max(toAdd.auditCredits, upgradeBump.auditCredits);
  }

  if (toAdd.aiCredits + toAdd.imageCredits + toAdd.auditCredits <= 0) {
    return false;
  }

  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const current = credits ?? EMPTY_CREDITS;
  const now = new Date();
  const next = {
    aiCredits: current.aiCredits + toAdd.aiCredits,
    imageCredits: current.imageCredits + toAdd.imageCredits,
    auditCredits: current.auditCredits + toAdd.auditCredits,
  };

  if (credits) {
    await db
      .update(creditsTable)
      .set({ ...next, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, ...next });
  }

  await db.insert(creditTransactionsTable).values([
    ...(toAdd.aiCredits > 0
      ? [{ userId, creditType: "ai" as const, amount: toAdd.aiCredits, reason, featureType: "subscription" }]
      : []),
    ...(toAdd.imageCredits > 0
      ? [{ userId, creditType: "image" as const, amount: toAdd.imageCredits, reason, featureType: "subscription" }]
      : []),
    ...(toAdd.auditCredits > 0
      ? [{ userId, creditType: "audit" as const, amount: toAdd.auditCredits, reason, featureType: "subscription" }]
      : []),
  ]);

  return true;
}

const MAX_PERIOD_ROLLS_PER_CALL = 12;

export function addBillingCycle(date: Date, billingCycle: string, direction: 1 | -1 = 1): Date {
  const next = new Date(date.getTime());
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + direction);
  } else {
    next.setMonth(next.getMonth() + direction);
  }
  return next;
}

/**
 * Expire all unused credits (plan + packs) and zero workspace/member pools.
 * Does not grant new credits — call setAccountCreditsToPlanAllocation after.
 */
export async function expireAllCreditsForPeriodEnd(
  userId: string,
  reason = "Billing period ended — unused credits expired",
): Promise<CreditBalances> {
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const current = credits ?? EMPTY_CREDITS;
  const now = new Date();

  await zeroAllWorkspaceCreditsForOwner(userId);

  if (credits && sumCredits(current) > 0) {
    const txs = [
      ...(current.aiCredits > 0
        ? [{
            userId,
            creditType: "ai" as const,
            amount: -current.aiCredits,
            reason,
            featureType: "subscription_expiry",
          }]
        : []),
      ...(current.imageCredits > 0
        ? [{
            userId,
            creditType: "image" as const,
            amount: -current.imageCredits,
            reason,
            featureType: "subscription_expiry",
          }]
        : []),
      ...(current.auditCredits > 0
        ? [{
            userId,
            creditType: "audit" as const,
            amount: -current.auditCredits,
            reason,
            featureType: "subscription_expiry",
          }]
        : []),
    ];
    if (txs.length > 0) {
      await db.insert(creditTransactionsTable).values(txs);
    }
  }

  if (credits) {
    await db
      .update(creditsTable)
      .set({ aiCredits: 0, imageCredits: 0, auditCredits: 0, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, ...EMPTY_CREDITS });
  }

  return { ...EMPTY_CREDITS };
}

/** Set account credit balances to exactly the new plan allocation (after expiry). */
export async function setAccountCreditsToPlanAllocation(
  userId: string,
  plan: PlanCredits,
  reason: string,
): Promise<boolean> {
  const next: CreditBalances = {
    aiCredits: Math.max(0, Math.floor(plan.aiCredits)),
    imageCredits: Math.max(0, Math.floor(plan.imageCredits)),
    auditCredits: Math.max(0, Math.floor(plan.auditCredits)),
  };
  const now = new Date();
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));

  if (credits) {
    await db
      .update(creditsTable)
      .set({ ...next, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, ...next });
  }

  if (sumCredits(next) <= 0) return false;

  await db.insert(creditTransactionsTable).values([
    ...(next.aiCredits > 0
      ? [{ userId, creditType: "ai" as const, amount: next.aiCredits, reason, featureType: "subscription" }]
      : []),
    ...(next.imageCredits > 0
      ? [{ userId, creditType: "image" as const, amount: next.imageCredits, reason, featureType: "subscription" }]
      : []),
    ...(next.auditCredits > 0
      ? [{ userId, creditType: "audit" as const, amount: next.auditCredits, reason, featureType: "subscription" }]
      : []),
  ]);

  return true;
}

/** Expire leftover credits (incl. packs + workspaces), then grant only the new plan allocation. */
export async function renewPlanCreditsWithExpiry(
  userId: string,
  plan: PlanCredits,
  reason: string,
): Promise<void> {
  await expireAllCreditsForPeriodEnd(userId);
  await setAccountCreditsToPlanAllocation(userId, plan, reason);
}

async function recordPlanRenewalInBillingHistory(options: {
  userId: string;
  planId: number | null;
  planName: string;
  billingCycle: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  gateway: string;
  gatewayPaymentId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const gatewayPaymentId =
    options.gatewayPaymentId
    ?? `renewal:${options.userId}:${options.periodStart.toISOString()}:${options.periodEnd.toISOString()}`;

  const existing = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(eq(paymentsTable.gatewayPaymentId, gatewayPaymentId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(paymentsTable).values({
    userId: options.userId,
    planId: options.planId ?? undefined,
    amount: options.amount,
    status: "completed",
    gateway: options.gateway,
    gatewayPaymentId,
    metadata: {
      type: "subscription_renewal",
      planName: options.planName,
      billingCycle: options.billingCycle,
      periodStart: options.periodStart.toISOString(),
      periodEnd: options.periodEnd.toISOString(),
      ...(options.metadata ?? {}),
    },
  });
}

/**
 * When auto-renew is on and currentPeriodEnd is past, advance billing periods,
 * expire unused credits (no rollover), grant only the new plan allocation, and
 * record each renewal in Billing History.
 */
export async function advanceSubscriptionBillingPeriodIfNeeded(userId: string): Promise<{
  rolled: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}> {
  const [sub] = await db
    .select({
      status: subscriptionsTable.status,
      autoRenew: subscriptionsTable.autoRenew,
      billingCycle: subscriptionsTable.billingCycle,
      currentPeriodStart: subscriptionsTable.currentPeriodStart,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      planAiCredits: plansTable.aiCredits,
      planImageCredits: plansTable.imageCredits,
      planAuditCredits: plansTable.auditCredits,
      creditAllocations: plansTable.creditAllocations,
      planName: plansTable.name,
      planId: plansTable.id,
      priceMonthly: plansTable.priceMonthly,
      priceYearly: plansTable.priceYearly,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub || !["active", "trial"].includes(sub.status) || !sub.autoRenew) {
    return {
      rolled: 0,
      currentPeriodStart: sub?.currentPeriodStart ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }
  if (!sub.currentPeriodEnd) {
    return { rolled: 0, currentPeriodStart: sub.currentPeriodStart ?? null, currentPeriodEnd: null };
  }

  const now = new Date();
  let periodStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : new Date(sub.currentPeriodEnd);
  let periodEnd = new Date(sub.currentPeriodEnd);
  if (now.getTime() <= periodEnd.getTime()) {
    return { rolled: 0, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd };
  }

  const alloc = (sub.creditAllocations ?? {}) as Record<string, number>;
  const hasAllocations = Object.keys(alloc).length > 0;
  const pools = hasAllocations
    ? await computePlanPoolsFromAllocations(alloc)
    : await planRowToGrantCredits({
        id: sub.planId ?? 0,
        name: sub.planName ?? "plan",
        aiCredits: sub.planAiCredits ?? 0,
        imageCredits: sub.planImageCredits ?? 0,
        auditCredits: sub.planAuditCredits ?? 0,
      });
  const planCredits: PlanCredits = {
    id: sub.planId ?? 0,
    name: sub.planName ?? "plan",
    aiCredits: pools.aiCredits,
    imageCredits: pools.imageCredits,
    auditCredits: pools.auditCredits,
  };

  const cycle = sub.billingCycle || "monthly";
  const renewAmount = cycle === "yearly"
    ? Number(sub.priceYearly ?? 0) * 12
    : Number(sub.priceMonthly ?? 0);

  const rolledPeriods: Array<{ start: Date; end: Date }> = [];
  let rolled = 0;
  while (now.getTime() > periodEnd.getTime() && rolled < MAX_PERIOD_ROLLS_PER_CALL) {
    periodStart = new Date(periodEnd);
    periodEnd = addBillingCycle(periodEnd, cycle, 1);
    rolled += 1;
    rolledPeriods.push({ start: new Date(periodStart), end: new Date(periodEnd) });
  }

  // Expire leftover (plan + packs + workspace pools), then grant only the new plan once.
  await renewPlanCreditsWithExpiry(
    userId,
    planCredits,
    `${planCredits.name} — billing period renewal`,
  );

  for (const p of rolledPeriods) {
    await recordPlanRenewalInBillingHistory({
      userId,
      planId: sub.planId ?? null,
      planName: planCredits.name,
      billingCycle: cycle,
      periodStart: p.start,
      periodEnd: p.end,
      amount: renewAmount,
      gateway: "subscription",
      metadata: { source: "local_auto_renew", catchUpRolls: rolled },
    });
  }

  await db
    .update(subscriptionsTable)
    .set({
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: now,
    })
    .where(eq(subscriptionsTable.userId, userId));

  return { rolled, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd };
}

/**
 * If a user has an active subscription but is missing plan credits
 * (never granted, or grant total below current plan allocation), top up once.
 * Does not re-grant credits the user already received and spent.
 * Also advances the billing period when auto-renew is due.
 */
export async function ensureSubscriptionCredits(userId: string): Promise<CreditBalances> {
  await advanceSubscriptionBillingPeriodIfNeeded(userId);

  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const current = credits ?? EMPTY_CREDITS;

  const [sub] = await db
    .select({
      status: subscriptionsTable.status,
      planAiCredits: plansTable.aiCredits,
      planImageCredits: plansTable.imageCredits,
      planAuditCredits: plansTable.auditCredits,
      creditAllocations: plansTable.creditAllocations,
      planName: plansTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub || !["active", "trial"].includes(sub.status)) return current;

  const alloc = (sub.creditAllocations ?? {}) as Record<string, number>;
  const hasAllocations = Object.keys(alloc).length > 0;
  const pools = hasAllocations
    ? await computePlanPoolsFromAllocations(alloc)
    : await planRowToGrantCredits({
        id: 0,
        name: sub.planName ?? "plan",
        aiCredits: sub.planAiCredits ?? 0,
        imageCredits: sub.planImageCredits ?? 0,
        auditCredits: sub.planAuditCredits ?? 0,
      });
  const planAi = pools.aiCredits;
  const planImage = pools.imageCredits;
  const planAudit = pools.auditCredits;
  if (planAi + planImage + planAudit <= 0) return current;

  const planLabel = sub.planName ?? "plan";
  await grantPlanCreditsDelta(
    userId,
    {
      id: 0,
      name: planLabel,
      aiCredits: planAi,
      imageCredits: planImage,
      auditCredits: planAudit,
    },
    `${planLabel} — subscription credits synced`,
  );

  const [updated] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  return updated ?? current;
}
