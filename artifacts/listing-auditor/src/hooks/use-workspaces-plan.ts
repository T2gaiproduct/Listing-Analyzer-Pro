import { useQuery } from "@tanstack/react-query";
import {
  planIncludesWorkspacesFromPlan,
  workspacesUpgradeMessage,
  workspacesUpgradeShort,
  workspacesUpgradeMessageForCurrentPlan,
  workspacesUpgradeShortForCurrentPlan,
  formatWorkspacesIncludedPlansLabel,
  WORKSPACES_INCLUDED_PLANS_LABEL,
  type PlanEnabledFeatures,
} from "@workspace/workspace-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface UserSubscriptionPlan {
  planName: string | null;
  enabledFeatures?: PlanEnabledFeatures | null;
  workspacesEnabled?: boolean;
  workspacesUpgradePlanNames?: string[];
  status?: string;
  planAiCredits?: number;
  planImageCredits?: number;
  planAuditCredits?: number;
  creditAllocations?: Record<string, number> | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}

export function useWorkspacesPlan() {
  const { data, isLoading } = useQuery<UserSubscriptionPlan | null>({
    queryKey: ["user-subscription"],
    queryFn: () =>
      fetch(`${basePath}/api/subscription`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: teamAccountPerms } = useQuery<{ workspacesEnabled?: boolean } | null>({
    queryKey: ["team-account-permissions"],
    queryFn: () =>
      fetch(`${basePath}/api/team/account-permissions`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    staleTime: 30_000,
  });

  const planName = data?.planName ?? null;
  const enabledFeatures = data?.enabledFeatures ?? null;
  const workspacesEnabled =
    teamAccountPerms?.workspacesEnabled
    ?? data?.workspacesEnabled
    ?? planIncludesWorkspacesFromPlan({ planName, enabledFeatures });

  const upgradePlanNames = data?.workspacesUpgradePlanNames ?? [];
  const includedPlansLabel = upgradePlanNames.length > 0
    ? formatWorkspacesIncludedPlansLabel(upgradePlanNames)
    : WORKSPACES_INCLUDED_PLANS_LABEL;

  const upgradeMessage = workspacesEnabled
    ? ""
    : workspacesUpgradeMessageForCurrentPlan(planName, upgradePlanNames);

  const upgradeShort = workspacesEnabled
    ? ""
    : workspacesUpgradeShortForCurrentPlan(planName, upgradePlanNames);

  return {
    isLoading,
    planName,
    enabledFeatures,
    workspacesEnabled,
    workspacesPlanLocked: !workspacesEnabled,
    upgradeMessage,
    upgradeShort,
    includedPlansLabel,
  };
}
