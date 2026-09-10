/** Agency account owner on default workspace → account-wide dashboard; client workspace → scoped. */
export function isAgencyAccountOverviewDashboard(
  isBillingAccountOwner: boolean,
  workspaces: Array<{ id: number; isDefault?: boolean }>,
  activeWorkspaceId: number | null,
): boolean {
  if (!isBillingAccountOwner) return false;
  if (activeWorkspaceId == null) return true;
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  return ws?.isDefault === true;
}
