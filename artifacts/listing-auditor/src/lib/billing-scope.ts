const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function billingUsageScopeKey(
  accountOverview: boolean,
  workspaceId: number | null,
): string {
  return accountOverview ? "account" : `workspace-${workspaceId ?? "none"}`;
}

export function creditUsageApiUrl(accountOverview: boolean, workspaceId: number | null): string {
  if (accountOverview) {
    return `${basePath}/api/credit-usage?scope=account`;
  }
  return `${basePath}/api/credit-usage?workspaceId=${workspaceId ?? ""}`;
}

export function teamOverviewApiUrl(accountOverview: boolean, workspaceId: number | null): string {
  if (accountOverview) {
    return `${basePath}/api/team`;
  }
  return `${basePath}/api/team?workspaceId=${workspaceId ?? ""}`;
}
