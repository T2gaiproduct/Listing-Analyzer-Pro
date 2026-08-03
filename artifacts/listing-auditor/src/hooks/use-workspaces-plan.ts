import { useQuery } from "@tanstack/react-query";
import {
  planIncludesWorkspaces,
  WORKSPACES_INCLUDED_PLANS_LABEL,
  WORKSPACES_UPGRADE_MESSAGE,
  WORKSPACES_UPGRADE_SHORT,
} from "@workspace/workspace-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface UserSubscriptionPlan {
  planName: string | null;
  workspacesEnabled?: boolean;
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
  const workspacesEnabled =
    data?.workspacesEnabled ?? planIncludesWorkspaces(planName);

  return {
    isLoading,
    planName,
    workspacesEnabled,
    workspacesPlanLocked: !workspacesEnabled,
    upgradeMessage: WORKSPACES_UPGRADE_MESSAGE,
    upgradeShort: WORKSPACES_UPGRADE_SHORT,
    includedPlansLabel: WORKSPACES_INCLUDED_PLANS_LABEL,
  };
}
