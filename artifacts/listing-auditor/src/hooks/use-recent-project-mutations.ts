import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetRecentsQueryKey, getGetAuditQueryKey } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useRecentProjectMutations(recentsLimit = 200) {
  const queryClient = useQueryClient();
  const recentsQueryKey = getGetRecentsQueryKey({ limit: recentsLimit });

  function invalidateRecents() {
    void queryClient.invalidateQueries({ queryKey: recentsQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const pinMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, id }),
      });
      if (!r.ok) throw new Error("Failed to pin project");
      return r.json();
    },
    onSuccess: invalidateRecents,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ type, id, name }: { type: string; id: number; name: string }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Failed to rename project");
      return r.json();
    },
    onSuccess: (_data, { type, id }) => {
      invalidateRecents();
      if (type === "audit" || type === "listing") {
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to archive project");
      return r.json();
    },
    onSuccess: () => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete project");
      return r.json();
    },
    onSuccess: () => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });

  return { pinMutation, renameMutation, archiveMutation, deleteMutation };
}
