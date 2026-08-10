import { useQuery } from "@tanstack/react-query";
import {
  planIncludesWorkspacesFromPlan,
  workspacesUpgradeMessage,
  workspacesUpgradeShort,
  formatWorkspacesIncludedPlansLabel,
  WORKSPACES_UPGRADE_MESSAGE,
  WORKSPACES_UPGRADE_SHORT,
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

  const planName = data?.planName ?? null;
  const enabledFeatures = data?.enabledFeatures ?? null;
  const workspacesEnabled =
    data?.workspacesEnabled
    ?? planIncludesWorkspacesFromPlan({ planName, enabledFeatures });

  const upgradePlanNames = data?.workspacesUpgradePlanNames ?? [];
  const includedPlansLabel = upgradePlanNames.length > 0
    ? formatWorkspacesIncludedPlansLabel(upgradePlanNames)
    : WORKSPACES_INCLUDED_PLANS_LABEL;

  const upgradeMessage = upgradePlanNames.length > 0
    ? workspacesUpgradeMessage(upgradePlanNames)
    : WORKSPACES_UPGRADE_MESSAGE;

  const upgradeShort = upgradePlanNames.length > 0
    ? workspacesUpgradeShort(upgradePlanNames)
    : WORKSPACES_UPGRADE_SHORT;

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
