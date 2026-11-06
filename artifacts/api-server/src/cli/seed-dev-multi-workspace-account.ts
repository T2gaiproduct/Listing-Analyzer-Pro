/**
 * Idempotent: Pro (multi-workspace) subscription + default + extra client workspaces.
 *
 *   export DATABASE_URL=postgresql://...
 *   pnpm --filter @workspace/api-server exec tsx src/cli/seed-dev-multi-workspace-account.ts USER_ID
 *
 * Optional env:
 *   SEED_MULTI_WS_EMAIL — stored on user_profiles.login_email (display only)
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  plansTable,
  subscriptionsTable,
  workspacesTable,
  userProfilesTable,
} from "@workspace/db";
import { fulfillOnboardingPlan } from "../lib/subscription-fulfillment.js";
import { planRowToGrantCredits } from "../lib/plan-credits.js";
import { ensureSubscriberDefaultWorkspace } from "../lib/ensure-workspaces.js";
import { upsertUserProfile } from "../lib/user-profile.js";

const userId = process.argv[2]?.trim();
if (!userId) {
  console.error("Usage: seed-dev-multi-workspace-account.ts USER_ID");
  process.exit(1);
}

const EXTRA_WORKSPACES = [
  { name: "Client — Brand A", clientLabel: "Brand A" },
  { name: "Client — Brand B", clientLabel: "Brand B" },
] as const;

const [proPlan] = await db
  .select()
  .from(plansTable)
  .where(and(eq(plansTable.isActive, true), eq(plansTable.name, "Pro")))
  .limit(1);

if (!proPlan) {
  console.error("Pro plan not found — run DB seed/sync first.");
  process.exit(1);
}

// Ensure Growth also advertises workspaces capability in admin DB (optional consistency).
await db
  .update(plansTable)
  .set({
    enabledFeatures: { workspaces: true, api_access: false },
    updatedAt: new Date(),
  })
  .where(eq(plansTable.name, "Growth"));

const now = new Date();
const periodEnd = new Date(now);
periodEnd.setMonth(periodEnd.getMonth() + 1);

const subPayload = {
  planId: proPlan.id,
  billingCycle: "monthly" as const,
  status: "active" as const,
  trialEndsAt: null as Date | null,
  currentPeriodStart: now,
  currentPeriodEnd: periodEnd,
  autoRenew: true,
  updatedAt: now,
};

const [existingSub] = await db
  .select({ id: subscriptionsTable.id })
  .from(subscriptionsTable)
  .where(eq(subscriptionsTable.userId, userId))
  .limit(1);

if (existingSub) {
  await db.update(subscriptionsTable).set(subPayload).where(eq(subscriptionsTable.userId, userId));
} else {
  await db.insert(subscriptionsTable).values({ userId, ...subPayload });
}

const planCredits = await planRowToGrantCredits(proPlan);
await fulfillOnboardingPlan({
  userId,
  plan: planCredits,
  idempotencyKey: `dev-multi-ws:${userId}:${proPlan.id}`,
  reason: `${proPlan.name} plan — multi-workspace dev seed`,
});

const defaultWorkspaceId = await ensureSubscriberDefaultWorkspace(userId);

const createdExtra: number[] = [];
for (const spec of EXTRA_WORKSPACES) {
  const [existing] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.accountOwnerId, userId),
        eq(workspacesTable.name, spec.name),
        eq(workspacesTable.isDeleted, 0),
      ),
    )
    .limit(1);
  if (existing) {
    createdExtra.push(existing.id);
    continue;
  }
  const [ws] = await db
    .insert(workspacesTable)
    .values({
      accountOwnerId: userId,
      name: spec.name,
      clientLabel: spec.clientLabel,
      description: "Dev seed client workspace",
      isDefault: false,
      preserveLegacyPermissions: true,
    })
    .returning({ id: workspacesTable.id });
  if (ws) {
    const { ensureWorkspaceDefaultAgents } = await import("../lib/workspace-agents.js");
    await ensureWorkspaceDefaultAgents(ws.id);
    createdExtra.push(ws.id);
  }
}

const seedEmail = process.env.SEED_MULTI_WS_EMAIL?.trim();
await upsertUserProfile(userId, {
  onboardingCompleted: true,
  fullName: "Multi Workspace Demo",
  companyName: "Demo Agency",
  ...(seedEmail ? { loginEmail: seedEmail } : {}),
});

const workspaceRows = await db
  .select({ id: workspacesTable.id, name: workspacesTable.name, isDefault: workspacesTable.isDefault })
  .from(workspacesTable)
  .where(and(eq(workspacesTable.accountOwnerId, userId), eq(workspacesTable.isDeleted, 0)));

console.log(
  JSON.stringify(
    {
      ok: true,
      userId,
      planId: proPlan.id,
      planName: proPlan.name,
      workspacesEnabled: true,
      defaultWorkspaceId,
      extraWorkspaceIds: createdExtra,
      workspaces: workspaceRows,
      signInHint: seedEmail
        ? `Sign in with ${seedEmail} (native auth password or Clerk, depending on deployment).`
        : "Sign in with the account email linked to this user id.",
    },
    null,
    2,
  ),
);
