import { eq, desc } from "drizzle-orm";
import { db, subscriptionsTable, plansTable } from "@workspace/db";
import {
  planIncludesWorkspacesFromPlan,
  workspacesPlanGateBody,
  type PlanEnabledFeatures,
} from "@workspace/workspace-permissions";

export type AccountOwnerPlan = {
  planName: string | null;
  enabledFeatures: PlanEnabledFeatures | null;
};

export async function resolveAccountOwnerPlan(accountOwnerId: string): Promise<AccountOwnerPlan> {
  const subRows = await db
    .select({
      planName: plansTable.name,
      enabledFeatures: plansTable.enabledFeatures,
      status: subscriptionsTable.status,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, accountOwnerId))
    .orderBy(desc(subscriptionsTable.id));

  const subRow =
    subRows.find((s) => s.status === "active" || s.status === "trialing" || s.status === "trial")
    ?? subRows[0];

  return {
    planName: subRow?.planName ?? null,
    enabledFeatures: (subRow?.enabledFeatures as PlanEnabledFeatures | null) ?? null,
  };
}

export async function resolveAccountOwnerPlanName(accountOwnerId: string): Promise<string | null> {
  const plan = await resolveAccountOwnerPlan(accountOwnerId);
  return plan.planName;
}

export function isWorkspacesPlanEntitled(plan: AccountOwnerPlan): boolean {
  return planIncludesWorkspacesFromPlan(plan);
}

export async function accountWorkspacesEnabled(accountOwnerId: string): Promise<boolean> {
  const plan = await resolveAccountOwnerPlan(accountOwnerId);
  return isWorkspacesPlanEntitled(plan);
}

export async function listWorkspaceEntitledPlanNames(): Promise<string[]> {
  const rows = await db
    .select({ name: plansTable.name, enabledFeatures: plansTable.enabledFeatures })
    .from(plansTable)
    .where(eq(plansTable.isActive, true));

  return rows
    .filter((row) => planIncludesWorkspacesFromPlan({
      planName: row.name,
      enabledFeatures: (row.enabledFeatures as PlanEnabledFeatures | null) ?? null,
    }))
    .map((row) => row.name);
}

export async function workspacesPlanGateBodyForAccount(accountOwnerId: string) {
  const planNames = await listWorkspaceEntitledPlanNames();
  return workspacesPlanGateBody(planNames);
}

export { workspacesPlanGateBody };
