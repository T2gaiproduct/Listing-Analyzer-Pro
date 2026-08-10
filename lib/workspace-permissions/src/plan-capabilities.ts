import { normalizePlanName } from "./plan-workspaces.js";

/** Functional plan capabilities (admin toggles — not pricing-page marketing bullets). */
export const PLAN_CAPABILITY_CATALOG = [
  {
    key: "workspaces",
    label: "Multiple workspaces",
    description:
      "Workspaces hub, extra client workspaces, per-workspace credit pools, and member invites.",
  },
  {
    key: "api_access",
    label: "API access",
    description: "Programmatic API access for integrations (enforced when API routes add gating).",
  },
] as const;

export type PlanCapabilityKey = (typeof PLAN_CAPABILITY_CATALOG)[number]["key"];

export type PlanEnabledFeatures = Partial<Record<PlanCapabilityKey, boolean>>;

/** Legacy name-based entitlements used when enabledFeatures is not configured on a plan. */
const LEGACY_WORKSPACE_PLAN_NAMES = new Set([
  "growth",
  "pro",
  "enterprise",
  "agencies",
  "agency",
]);

function legacyPlanIncludesWorkspaces(planName: string | null | undefined): boolean {
  const normalized = normalizePlanName(planName);
  if (!normalized) return false;
  return LEGACY_WORKSPACE_PLAN_NAMES.has(normalized);
}

function hasExplicitEnabledFeatures(
  enabledFeatures: PlanEnabledFeatures | null | undefined,
): enabledFeatures is PlanEnabledFeatures {
  return enabledFeatures != null && typeof enabledFeatures === "object" && !Array.isArray(enabledFeatures);
}

/**
 * Resolve whether a plan includes a functional capability.
 * When enabledFeatures is set on the plan (admin dashboard), that config wins.
 * Otherwise falls back to legacy plan-name rules so existing subscriptions keep working.
 */
export function planHasCapability(
  enabledFeatures: PlanEnabledFeatures | null | undefined,
  planName: string | null | undefined,
  capability: PlanCapabilityKey,
): boolean {
  if (hasExplicitEnabledFeatures(enabledFeatures)) {
    return Boolean(enabledFeatures[capability]);
  }

  if (capability === "workspaces") {
    return legacyPlanIncludesWorkspaces(planName);
  }

  return false;
}

export function planIncludesWorkspacesFromPlan(opts: {
  planName?: string | null;
  enabledFeatures?: PlanEnabledFeatures | null;
}): boolean {
  return planHasCapability(opts.enabledFeatures, opts.planName, "workspaces");
}

/** Default enabledFeatures for seeding / migration from legacy plan names. */
export function defaultEnabledFeaturesForPlanName(planName: string): PlanEnabledFeatures {
  return {
    workspaces: legacyPlanIncludesWorkspaces(planName),
    api_access: ["pro", "enterprise", "agencies", "agency"].includes(normalizePlanName(planName)),
  };
}

export const WORKSPACES_UPGRADE_MESSAGE_GENERIC =
  "Multiple workspaces and client credit pools are available on select plans. Upgrade to manage workspaces, fund pools, and invite members per client.";

export const WORKSPACES_UPGRADE_SHORT_GENERIC =
  "Upgrade your plan to unlock workspaces.";

export function formatWorkspacesIncludedPlansLabel(planNames: string[]): string {
  const unique = [...new Set(planNames.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "select";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

export function workspacesUpgradeMessage(planNames: string[]): string {
  if (planNames.length === 0) return WORKSPACES_UPGRADE_MESSAGE_GENERIC;
  const label = formatWorkspacesIncludedPlansLabel(planNames);
  return `Multiple workspaces and client credit pools are available on ${label} plans. Upgrade to manage workspaces, fund pools, and invite members per client.`;
}

export function workspacesUpgradeShort(planNames: string[]): string {
  if (planNames.length === 0) return WORKSPACES_UPGRADE_SHORT_GENERIC;
  const label = formatWorkspacesIncludedPlansLabel(planNames);
  return `Upgrade to ${label} to unlock workspaces.`;
}

export function workspacesPlanGateBody(planNames: string[] = []) {
  return {
    error: workspacesUpgradeMessage(planNames),
    code: "WORKSPACES_PLAN_REQUIRED",
  } as const;
}
