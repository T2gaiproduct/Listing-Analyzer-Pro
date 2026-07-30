/** Account-level workspace admin hub — no single-workspace project scope. */
export function isWorkspaceAdminOverviewRoute(location: string): boolean {
  return location === "/workspaces";
}

/** Account-level routes that should not send workspace-scoped API headers. */
export function isAccountScopedRoute(location: string): boolean {
  return location === "/roles" || isWorkspaceAdminOverviewRoute(location);
}

/** Whether API calls should include x-workspace-id for project/feature data. */
export function isWorkspaceApiScopeActive(location: string): boolean {
  return !isAccountScopedRoute(location);
}

/** Workspace detail routes (/workspaces/:id, members, etc.). */
export function parseWorkspaceRouteId(location: string): number | null {
  const match = location.match(/^\/workspaces\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
