/**
 * Idempotent: active $0 plan subscription + default workspace + plan credits for local dev users.
 *
 *   export DATABASE_URL=postgresql://...
 *   pnpm --filter @workspace/api-server exec tsx src/cli/seed-dev-customer-account.ts USER_ID
 */
import { and, asc, eq } from "drizzle-orm";
import { db, plansTable, subscriptionsTable } from "@workspace/db";
import { fulfillOnboardingPlan } from "../lib/subscription-fulfillment.js";
import { planRowToGrantCredits } from "../lib/plan-credits.js";
import { ensureSubscriberDefaultWorkspace } from "../lib/ensure-workspaces.js";

const userId = process.argv[2]?.trim();
if (!userId) {
  console.error("Usage: seed-dev-customer-account.ts USER_ID");
  process.exit(1);
}

const [freePlan] = await db
  .select()
  .from(plansTable)
  .where(and(eq(plansTable.isActive, true), eq(plansTable.priceMonthly, 0)))
  .orderBy(asc(plansTable.sortOrder), asc(plansTable.id))
  .limit(1);

if (!freePlan) {
  console.error("No active $0 plan in plans table — run DB seed/sync first.");
  process.exit(1);
}

const now = new Date();
const periodEnd = new Date(now);
periodEnd.setMonth(periodEnd.getMonth() + 1);

const [existing] = await db
  .select({ id: subscriptionsTable.id })
  .from(subscriptionsTable)
  .where(eq(subscriptionsTable.userId, userId))
  .limit(1);

const subPayload = {
  planId: freePlan.id,
  billingCycle: "monthly" as const,
  status: "active" as const,
  trialEndsAt: null as Date | null,
  currentPeriodStart: now,
  currentPeriodEnd: periodEnd,
  autoRenew: true,
  updatedAt: now,
};

if (existing) {
  await db.update(subscriptionsTable).set(subPayload).where(eq(subscriptionsTable.userId, userId));
} else {
  await db.insert(subscriptionsTable).values({ userId, ...subPayload });
}

const planCredits = await planRowToGrantCredits(freePlan);
await fulfillOnboardingPlan({
  userId,
  plan: planCredits,
  idempotencyKey: `onboarding:${userId}:${freePlan.id}`,
  reason: `${freePlan.name} plan — dev seed`,
});

const workspaceId = await ensureSubscriberDefaultWorkspace(userId);

console.log(
  JSON.stringify({
    ok: true,
    userId,
    planId: freePlan.id,
    planName: freePlan.name,
    workspaceId,
  }),
);
