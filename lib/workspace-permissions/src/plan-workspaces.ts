/** Plans that include multi-workspace hub (pools, members, agency hub). */
const WORKSPACE_INCLUDED_PLAN_NAMES = new Set([
  "growth",
  "pro",
  "enterprise",
]);

export function normalizePlanName(planName: string | null | undefined): string {
  return (planName ?? "").trim().toLowerCase();
}

export function planIncludesWorkspaces(planName: string | null | undefined): boolean {
  const normalized = normalizePlanName(planName);
  if (!normalized) return false;
  return WORKSPACE_INCLUDED_PLAN_NAMES.has(normalized);
}

export const WORKSPACES_INCLUDED_PLANS_LABEL = "Growth, Pro, and Enterprise";

export const WORKSPACES_UPGRADE_MESSAGE =
  `Multiple workspaces and client credit pools are available on ${WORKSPACES_INCLUDED_PLANS_LABEL} plans. Upgrade to manage workspaces, fund pools, and invite members per client.`;

export const WORKSPACES_UPGRADE_SHORT =
  `Upgrade to ${WORKSPACES_INCLUDED_PLANS_LABEL} to unlock workspaces.`;
