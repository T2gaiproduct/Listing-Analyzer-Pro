import { planIncludesWorkspacesFromPlan } from "./plan-capabilities.js";
import type { PlanEnabledFeatures } from "./plan-capabilities.js";

export function normalizePlanName(planName: string | null | undefined): string {
  return (planName ?? "").trim().toLowerCase();
}

/** @deprecated Prefer planIncludesWorkspacesFromPlan with enabledFeatures from the plan row. */
export function planIncludesWorkspaces(planName: string | null | undefined): boolean {
  return planIncludesWorkspacesFromPlan({ planName });
}

export const WORKSPACES_INCLUDED_PLANS_LABEL = "Growth, Pro, and Enterprise";

export const WORKSPACES_UPGRADE_MESSAGE =
  `Multiple workspaces and client credit pools are available on ${WORKSPACES_INCLUDED_PLANS_LABEL} plans. Upgrade to manage workspaces, fund pools, and invite members per client.`;

export const WORKSPACES_UPGRADE_SHORT =
  `Upgrade to ${WORKSPACES_INCLUDED_PLANS_LABEL} to unlock workspaces.`;

export type { PlanCapabilityKey, PlanEnabledFeatures } from "./plan-capabilities.js";
