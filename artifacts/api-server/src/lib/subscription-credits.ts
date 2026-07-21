import { eq, and, gt } from "drizzle-orm";
import {
  db,
  creditsTable,
  creditTransactionsTable,
  subscriptionsTable,
  plansTable,
} from "@workspace/db";

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
export async function grantPlanCreditsDelta(
  userId: string,
  plan: PlanCredits,
  reason: string,
): Promise<boolean> {
  const granted = await subscriptionGrantsTotal(userId);
  const toAdd = {
    aiCredits: Math.max(0, plan.aiCredits - granted.aiCredits),
    imageCredits: Math.max(0, plan.imageCredits - granted.imageCredits),
    auditCredits: Math.max(0, plan.auditCredits - granted.auditCredits),
  };

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

/**
 * If a user has an active subscription but is missing plan credits
 * (never granted, or grant total below current plan allocation), top up once.
 * Does not re-grant credits the user already received and spent.
 */
export async function ensureSubscriptionCredits(userId: string): Promise<CreditBalances> {
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const current = credits ?? EMPTY_CREDITS;

  const [sub] = await db
    .select({
      status: subscriptionsTable.status,
      planAiCredits: plansTable.aiCredits,
      planImageCredits: plansTable.imageCredits,
      planAuditCredits: plansTable.auditCredits,
      planName: plansTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub || !["active", "trial"].includes(sub.status)) return current;

  const planAi = sub.planAiCredits ?? 0;
  const planImage = sub.planImageCredits ?? 0;
  const planAudit = sub.planAuditCredits ?? 0;
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
