/** Active workspace id sent as x-workspace-id on API requests. */
let activeWorkspaceId: number | null = null;

export function setActiveWorkspaceId(id: number | null): void {
  activeWorkspaceId = id;
}

export function getActiveWorkspaceId(): number | null {
  return activeWorkspaceId;
}

export const WORKSPACE_HEADER = "x-workspace-id";
