import type { QueryClient } from "@tanstack/react-query";

export type WorkspaceListCacheRow = {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  isAccountOwner: boolean;
  roleName: string | null;
};

/** Drop cached project/list data so a workspace switch cannot show the previous workspace's rows. */
export function resetWorkspaceScopedQueries(queryClient: QueryClient): void {
  void queryClient.removeQueries({ queryKey: ["products"] });
  void queryClient.removeQueries({ queryKey: ["product"] });
  void queryClient.removeQueries({ queryKey: ["audits"] });
  void queryClient.removeQueries({ queryKey: ["graphics-projects"] });
  void queryClient.removeQueries({ queryKey: ["recents"] });
  void queryClient.removeQueries({ queryKey: ["/api/recents"] });
  void queryClient.removeQueries({ queryKey: ["dashboard"] });
  void queryClient.removeQueries({ queryKey: ["archive"] });
  void queryClient.removeQueries({ queryKey: ["search-projects"] });
  void queryClient.removeQueries({ queryKey: ["workspace-permissions"] });
  void queryClient.removeQueries({ queryKey: ["workspace-member-credits"] });
  void queryClient.removeQueries({ queryKey: ["workspace-pool-credits"] });
}

export function appendWorkspaceToListCache(
  queryClient: QueryClient,
  workspace: WorkspaceListCacheRow,
): void {
  queryClient.setQueryData<{ workspaces: WorkspaceListCacheRow[] }>(["workspaces"], (old) => {
    const list = old?.workspaces ?? [];
    if (list.some((w) => w.id === workspace.id)) {
      return old ?? { workspaces: list };
    }
    return { workspaces: [...list, workspace] };
  });
}
