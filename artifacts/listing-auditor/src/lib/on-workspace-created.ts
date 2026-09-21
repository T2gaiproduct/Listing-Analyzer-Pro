import type { QueryClient } from "@tanstack/react-query";
import { appendWorkspaceToListCache } from "@/lib/workspace-query-sync";

export function applyWorkspaceCreated(
  queryClient: QueryClient,
  ws: { id: number },
  form: { name: string; description: string; clientLabel: string },
  isAccountOwner: boolean,
  setActiveWorkspaceId: (id: number) => void,
): void {
  appendWorkspaceToListCache(queryClient, {
    id: ws.id,
    name: form.name.trim(),
    description: form.description.trim() || null,
    clientLabel: form.clientLabel.trim() || null,
    isDefault: false,
    isAccountOwner,
    roleName: isAccountOwner ? "Owner" : null,
  });
  void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  void queryClient.invalidateQueries({ queryKey: ["workspaces-overview"] });
  setActiveWorkspaceId(ws.id);
}
