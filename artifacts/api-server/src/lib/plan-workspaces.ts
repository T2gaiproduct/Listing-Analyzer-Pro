import { eq, desc } from "drizzle-orm";
import { db, subscriptionsTable, plansTable } from "@workspace/db";
import {
  planIncludesWorkspaces,
  WORKSPACES_UPGRADE_MESSAGE,
} from "@workspace/workspace-permissions";

export async function resolveAccountOwnerPlanName(accountOwnerId: string): Promise<string | null> {
  const subRows = await db
    .select({
      planName: plansTable.name,
      status: subscriptionsTable.status,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, accountOwnerId))
    .orderBy(desc(subscriptionsTable.id));

  const subRow =
    subRows.find((s) => s.status === "active" || s.status === "trialing" || s.status === "trial")
    ?? subRows[0];
  return subRow?.planName ?? null;
}

export function isWorkspacesPlanEntitled(planName: string | null | undefined): boolean {
  return planIncludesWorkspaces(planName);
}

export async function accountWorkspacesEnabled(accountOwnerId: string): Promise<boolean> {
  const planName = await resolveAccountOwnerPlanName(accountOwnerId);
  return isWorkspacesPlanEntitled(planName);
}

export function workspacesPlanGateBody() {
  return {
    error: WORKSPACES_UPGRADE_MESSAGE,
    code: "WORKSPACES_PLAN_REQUIRED",
  };
}
