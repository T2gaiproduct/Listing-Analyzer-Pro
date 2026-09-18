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

/** Plans that must never include workspaces (product policy — not overridable in admin). */
export const WORKSPACES_EXCLUDED_PLAN_NAMES = new Set(["free", "starter"]);

/** Legacy name-based entitlements when enabledFeatures is not configured on a plan. */
const LEGACY_WORKSPACE_PLAN_NAMES = new Set(["pro", "agencies", "agency"]);

function legacyPlanIncludesWorkspaces(planName: string | null | undefined): boolean {
  const normalized = normalizePlanName(planName);
  if (!normalized) return false;
  if (WORKSPACES_EXCLUDED_PLAN_NAMES.has(normalized)) return false;
  return LEGACY_WORKSPACE_PLAN_NAMES.has(normalized);
}

function hasExplicitEnabledFeatures(
  enabledFeatures: PlanEnabledFeatures | null | undefined,
): enabledFeatures is PlanEnabledFeatures {
  return enabledFeatures != null && typeof enabledFeatures === "object" && !Array.isArray(enabledFeatures);
}

export function planBlocksWorkspacesCapability(planName: string | null | undefined): boolean {
  const normalized = normalizePlanName(planName);
  return normalized !== "" && WORKSPACES_EXCLUDED_PLAN_NAMES.has(normalized);
}

/** Whether Super Admin may turn a capability on for this plan in Plans & Packages. */
export function adminCanEnableCapability(
  planName: string | null | undefined,
  capability: PlanCapabilityKey,
): boolean {
  if (capability === "workspaces" && planBlocksWorkspacesCapability(planName)) {
    return false;
  }
  return true;
}

/** Normalize admin/API enabled_features for a plan name (enforces product policy). */
export function sanitizeEnabledFeaturesForPlan(
  planName: string | null | undefined,
  enabledFeatures: PlanEnabledFeatures | null | undefined,
): PlanEnabledFeatures | null {
  if (enabledFeatures == null) return null;
  const out: PlanEnabledFeatures = { ...enabledFeatures };
  if (planBlocksWorkspacesCapability(planName)) {
    out.workspaces = false;
  }
  return out;
}

/**
 * Resolve whether a plan includes a functional capability.
 * When enabledFeatures is set on the plan (admin dashboard), that config wins (except workspaces on Free/Starter).
 * Otherwise falls back to legacy plan-name rules so existing subscriptions keep working.
 */
export function planHasCapability(
  enabledFeatures: PlanEnabledFeatures | null | undefined,
  planName: string | null | undefined,
  capability: PlanCapabilityKey,
): boolean {
  if (capability === "workspaces" && planBlocksWorkspacesCapability(planName)) {
    return false;
  }

  if (hasExplicitEnabledFeatures(enabledFeatures)) {
    const explicit = enabledFeatures[capability];
    if (explicit !== undefined) {
      return Boolean(explicit);
    }
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

/** Customer-facing copy when the subscription plan does not include workspaces. */
export function workspacesUpgradeMessageForCurrentPlan(
  currentPlanName: string | null | undefined,
  upgradePlanNames: string[],
): string {
  const current = (currentPlanName ?? "").trim();
  const targetLabel = upgradePlanNames.length > 0
    ? formatWorkspacesIncludedPlansLabel(upgradePlanNames)
    : "Pro or Agencies";
  if (!current) return workspacesUpgradeMessage(upgradePlanNames);
  return `Your ${current} plan does not include multiple workspaces. Upgrade to ${targetLabel} to unlock workspaces, client credit pools, and member invites.`;
}

export function workspacesUpgradeShortForCurrentPlan(
  currentPlanName: string | null | undefined,
  upgradePlanNames: string[],
): string {
  const current = (currentPlanName ?? "").trim();
  const targetLabel = upgradePlanNames.length > 0
    ? formatWorkspacesIncludedPlansLabel(upgradePlanNames)
    : "Pro or Agencies";
  if (!current) return workspacesUpgradeShort(upgradePlanNames);
  return `Upgrade your current plan (${current}) to ${targetLabel} to unlock workspaces.`;
}

export function workspacesPlanGateBody(planNames: string[] = []) {
  return {
    error: workspacesUpgradeMessage(planNames),
    code: "WORKSPACES_PLAN_REQUIRED",
  } as const;
}
