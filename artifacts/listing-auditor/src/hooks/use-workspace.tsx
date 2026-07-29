import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hasWorkspacePermission,
  type WorkspaceFeature,
  type WorkspaceAction,
  type WorkspaceRolePermissions,
} from "@workspace/workspace-permissions";
import { fetchJson } from "@/lib/api-fetch";
import { setActiveWorkspaceId } from "@/lib/workspace-header";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "la_active_workspace_id";

export interface WorkspaceSummary {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  isAccountOwner: boolean;
  roleName: string | null;
}

interface WorkspacePermissionsResponse {
  workspaceId: number;
  permissions: WorkspaceRolePermissions;
  roleName: string;
  isAccountOwner: boolean;
  preserveLegacyPermissions: boolean;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: number | null;
  permissions: WorkspaceRolePermissions;
  roleName: string;
  isAccountOwner: boolean;
  isLoading: boolean;
  setActiveWorkspaceId: (id: number) => void;
  can: (feature: WorkspaceFeature, action: WorkspaceAction) => boolean;
  canView: (feature: WorkspaceFeature) => boolean;
  canEdit: (feature: WorkspaceFeature) => boolean;
  canManageWorkspaces: boolean;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspaceId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(() => readStoredWorkspaceId());

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => fetchJson<{ workspaces: WorkspaceSummary[] }>(`${basePath}/api/workspaces`),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
  });

  const workspaces = listData?.workspaces ?? [];

  useEffect(() => {
    if (!workspaces.length) return;
    const valid = selectedId != null && workspaces.some((w) => w.id === selectedId);
    if (!valid) {
      const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;
      setSelectedId(fallback.id);
      localStorage.setItem(STORAGE_KEY, String(fallback.id));
    }
  }, [workspaces, selectedId]);

  const activeWorkspaceId = selectedId;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  useEffect(() => {
    setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ["workspace-permissions", activeWorkspaceId],
    queryFn: () =>
      fetchJson<WorkspacePermissionsResponse>(`${basePath}/api/workspaces/${activeWorkspaceId}/permissions/me`),
    enabled: isLoaded && !!user && !!activeWorkspaceId,
    staleTime: 30_000,
  });

  const permissions = permData?.permissions ?? {};
  const roleName = permData?.roleName ?? activeWorkspace?.roleName ?? "Member";
  const isAccountOwner = permData?.isAccountOwner ?? activeWorkspace?.isAccountOwner ?? false;

  const can = useCallback(
    (feature: WorkspaceFeature, action: WorkspaceAction) => {
      if (isAccountOwner) return true;
      return hasWorkspacePermission(permissions, feature, action);
    },
    [permissions, isAccountOwner],
  );

  const canView = useCallback(
    (feature: WorkspaceFeature) => can(feature, "viewGlobal") || can(feature, "viewOwn"),
    [can],
  );

  const canEdit = useCallback(
    (feature: WorkspaceFeature) => can(feature, "create") || can(feature, "edit"),
    [can],
  );

  const setWorkspace = useCallback((id: number) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    void qc.invalidateQueries({ queryKey: ["workspace-permissions", id] });
    void qc.invalidateQueries({ queryKey: ["audits"] });
    void qc.invalidateQueries({ queryKey: ["graphics-projects"] });
    void qc.invalidateQueries({ queryKey: ["recents"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  }, [qc]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    permissions,
    roleName,
    isAccountOwner,
    isLoading: listLoading || permLoading || !isLoaded,
    setActiveWorkspaceId: setWorkspace,
    can,
    canView,
    canEdit,
    canManageWorkspaces: isAccountOwner || can("workspaces", "viewGlobal"),
    refetch: () => { void refetchList(); },
  }), [
    workspaces, activeWorkspace, activeWorkspaceId, permissions, roleName, isAccountOwner,
    listLoading, permLoading, isLoaded, setWorkspace, can, canView, canEdit, refetchList,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
