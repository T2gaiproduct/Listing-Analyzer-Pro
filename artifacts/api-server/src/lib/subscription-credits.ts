import { eq, and, gt } from "drizzle-orm";
import {
  db,
  creditsTable,
  creditTransactionsTable,
  subscriptionsTable,
  plansTable,
} from "@workspace/db";
import { computePlanPoolsFromAllocations, planRowToGrantCredits } from "./plan-credits";

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

/** Grant a full plan allocation (used on each billing-period renewal). Unused balances roll over. */
export async function grantFullPlanCreditsForRenewal(
  userId: string,
  plan: PlanCredits,
  reason: string,
): Promise<boolean> {
  const toAdd: CreditBalances = {
    aiCredits: Math.max(0, Math.floor(plan.aiCredits)),
    imageCredits: Math.max(0, Math.floor(plan.imageCredits)),
    auditCredits: Math.max(0, Math.floor(plan.auditCredits)),
  };
  if (sumCredits(toAdd) <= 0) return false;

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

/**
 * When auto-renew is on and currentPeriodEnd is past, advance billing periods
 * (Cursor-style) and grant a fresh plan allocation per rolled period. Unused credits roll over.
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

  let rolled = 0;
  while (now.getTime() > periodEnd.getTime() && rolled < MAX_PERIOD_ROLLS_PER_CALL) {
    periodStart = new Date(periodEnd);
    periodEnd = addBillingCycle(periodEnd, sub.billingCycle || "monthly", 1);
    rolled += 1;
    const label = planCredits.name;
    await grantFullPlanCreditsForRenewal(
      userId,
      planCredits,
      `${label} — billing period renewal (${rolled})`,
    );
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
