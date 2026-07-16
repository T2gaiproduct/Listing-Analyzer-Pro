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

const EMPTY_CREDITS: CreditBalances = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

function sumCredits(c: CreditBalances): number {
  return c.aiCredits + c.imageCredits + c.auditCredits;
}

/**
 * If a user has an active subscription but never received their plan credits
 * (e.g. signed in before completing onboarding), grant them once.
 * Does not re-grant when the user spent credits to zero — subscription grant txs exist.
 */
export async function ensureSubscriptionCredits(userId: string): Promise<CreditBalances> {
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const current = credits ?? EMPTY_CREDITS;
  if (sumCredits(current) > 0) return current;

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

  const ai = sub.planAiCredits ?? 0;
  const image = sub.planImageCredits ?? 0;
  const audit = sub.planAuditCredits ?? 0;
  if (ai + image + audit <= 0) return current;

  const [priorGrant] = await db
    .select({ id: creditTransactionsTable.id })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, userId),
        eq(creditTransactionsTable.featureType, "subscription"),
        gt(creditTransactionsTable.amount, 0),
      ),
    )
    .limit(1);

  if (priorGrant) return current;

  const now = new Date();
  const planLabel = sub.planName ?? "plan";

  if (credits) {
    await db
      .update(creditsTable)
      .set({ aiCredits: ai, imageCredits: image, auditCredits: audit, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, aiCredits: ai, imageCredits: image, auditCredits: audit });
  }

  await db.insert(creditTransactionsTable).values([
    { userId, creditType: "ai", amount: ai, reason: `${planLabel} — subscription credits synced`, featureType: "subscription" },
    { userId, creditType: "image", amount: image, reason: `${planLabel} — subscription credits synced`, featureType: "subscription" },
    { userId, creditType: "audit", amount: audit, reason: `${planLabel} — subscription credits synced`, featureType: "subscription" },
  ]);

  return { aiCredits: ai, imageCredits: image, auditCredits: audit };
}
