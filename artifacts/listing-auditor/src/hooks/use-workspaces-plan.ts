import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
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

function subscriptionFromProfileSummary(
  summary: unknown,
): UserSubscriptionPlan | null | undefined {
  if (!summary || typeof summary !== "object") return undefined;
  const sub = (summary as { subscription?: UserSubscriptionPlan | null }).subscription;
  if (sub == null) return sub === null ? null : undefined;
  return {
    planName: sub.planName ?? null,
    enabledFeatures: sub.enabledFeatures ?? null,
    workspacesEnabled: sub.workspacesEnabled,
    workspacesUpgradePlanNames: sub.workspacesUpgradePlanNames,
    status: sub.status,
  };
}

export function useWorkspacesPlan() {
  const { isLoaded, user } = useUser();
  const qc = useQueryClient();

  const { data, isLoading, isFetched } = useQuery<UserSubscriptionPlan | null>({
    queryKey: ["user-subscription"],
    queryFn: () =>
      fetch(`${basePath}/api/subscription`, { credentials: "include" }).then((r) => r.json()),
    enabled: isLoaded && !!user,
    staleTime: 30_000,
    placeholderData: () =>
      subscriptionFromProfileSummary(qc.getQueryData(["user-profile-summary"])),
  });

  const subscriptionResolved =
    isFetched
    || subscriptionFromProfileSummary(qc.getQueryData(["user-profile-summary"])) !== undefined;
  const { data: teamAccountPerms } = useQuery<{ workspacesEnabled?: boolean } | null>({
    queryKey: ["team-account-permissions"],
    queryFn: () =>
      fetch(`${basePath}/api/team/account-permissions`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    enabled:
      isLoaded
      && !!user
      && subscriptionResolved
      && data?.workspacesEnabled === undefined,
    staleTime: 30_000,
  });

  const planName = data?.planName ?? null;
  const enabledFeatures = data?.enabledFeatures ?? null;
  const workspacesEnabled =
    data?.workspacesEnabled
    ?? teamAccountPerms?.workspacesEnabled
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
