import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isWorkspaceApiScopeActive, isWorkspaceAdminOverviewRoute, parseWorkspaceRouteId } from "@/lib/workspace-routes";
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
  /** Workspace used for project/feature pages — null until billing owner picks one from overview. */
  featureWorkspaceId: number | null;
  featureWorkspace: WorkspaceSummary | null;
  permissions: WorkspaceRolePermissions;
  roleName: string;
  isAccountOwner: boolean;
  isTeamMemberAccount: boolean;
  isLoading: boolean;
  setActiveWorkspaceId: (id: number) => void;
  can: (feature: WorkspaceFeature, action: WorkspaceAction) => boolean;
  canView: (feature: WorkspaceFeature) => boolean;
  canEdit: (feature: WorkspaceFeature) => boolean;
  canDelete: (feature: WorkspaceFeature) => boolean;
  canManageWorkspaces: boolean;
  /** False on workspace admin hub and account routes — project APIs should not run. */
  isWorkspaceApiScopeActive: boolean;
  /** Account owner must pick a workspace after visiting the workspace admin hub. */
  needsWorkspaceSelection: boolean;
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
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(() => readStoredWorkspaceId());
  const [workspaceScopeCommitted, setWorkspaceScopeCommitted] = useState(false);
  const overviewVisitedThisSession = useRef(false);
  const workspaceApiScopeActive = isWorkspaceApiScopeActive(location);

  const { data: listData, isLoading: listLoading, isError: listError, refetch: refetchList } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => fetchJson<{ workspaces: WorkspaceSummary[] }>(`${basePath}/api/workspaces`),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    retry: 3,
  });

  const workspaces = listData?.workspaces ?? [];

  const { data: profileSummary } = useQuery<{
    accountRole?: { type: string; label: string };
  }>({
    queryKey: ["user-profile-summary"],
    queryFn: () =>
      fetch(`${basePath}/api/profile/summary`, { credentials: "include" }).then((r) => r.json()),
    enabled: isLoaded && !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isWorkspaceAdminOverviewRoute(location)) {
      overviewVisitedThisSession.current = true;
      setWorkspaceScopeCommitted(false);
    }
  }, [location]);

  // Visiting a workspace detail URL (/workspaces/:id) commits that workspace for the ribbon and scoped APIs.
  useEffect(() => {
    const routeWorkspaceId = parseWorkspaceRouteId(location);
    if (routeWorkspaceId == null || !workspaces.some((w) => w.id === routeWorkspaceId)) return;
    if (selectedId !== routeWorkspaceId) {
      setSelectedId(routeWorkspaceId);
      localStorage.setItem(STORAGE_KEY, String(routeWorkspaceId));
    }
    if (!workspaceScopeCommitted) setWorkspaceScopeCommitted(true);
  }, [location, workspaces, selectedId, workspaceScopeCommitted]);

  useEffect(() => {
    if (!workspaces.length || workspaceScopeCommitted || overviewVisitedThisSession.current) return;
    if (isWorkspaceAdminOverviewRoute(location)) return;
    const owns = workspaces.some((w) => w.isAccountOwner);
    const billing = profileSummary?.accountRole?.type === "user";
    const sharedOnly = workspaces.length > 0 && !owns;
    const teamMember = profileSummary?.accountRole?.type === "team_member";
    if (!owns && !billing && !sharedOnly && !teamMember) return;
    if (selectedId != null && workspaces.some((w) => w.id === selectedId)) {
      setWorkspaceScopeCommitted(true);
    }
  }, [workspaces, selectedId, location, profileSummary?.accountRole?.type, workspaceScopeCommitted]);

  const ownsAnyWorkspace = workspaces.some((w) => w.isAccountOwner);
  const hasOnlySharedWorkspaces = workspaces.length > 0 && !ownsAnyWorkspace;
  const profileTeamMember = profileSummary?.accountRole?.type === "team_member";
  const isTeamMemberAccount = profileTeamMember || hasOnlySharedWorkspaces;

  useEffect(() => {
    if (listLoading) return;
    if (!workspaces.length) {
      if (selectedId != null) {
        setSelectedId(null);
        localStorage.removeItem(STORAGE_KEY);
        setActiveWorkspaceId(null);
      }
      return;
    }
    const valid = selectedId != null && workspaces.some((w) => w.id === selectedId);
    if (valid) return;

    const billingAccountOwner = profileSummary?.accountRole?.type === "user";
    // Billing owners who own workspaces pick from the hub; everyone else auto-selects.
    if (ownsAnyWorkspace && billingAccountOwner && !profileTeamMember) {
      if (selectedId != null) {
        setSelectedId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;
    setSelectedId(fallback.id);
    localStorage.setItem(STORAGE_KEY, String(fallback.id));
  }, [workspaces, selectedId, profileSummary?.accountRole?.type, profileTeamMember, ownsAnyWorkspace, listLoading]);

  useEffect(() => {
    if (!isTeamMemberAccount || !workspaces.length) return;
    const valid = selectedId != null && workspaces.some((w) => w.id === selectedId);
    if (!valid) {
      const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;
      setSelectedId(fallback.id);
      localStorage.setItem(STORAGE_KEY, String(fallback.id));
    }
    if (!workspaceScopeCommitted) setWorkspaceScopeCommitted(true);
  }, [isTeamMemberAccount, workspaces, selectedId, workspaceScopeCommitted]);

  useEffect(() => {
    if (isTeamMemberAccount && workspaces.length === 0 && !listLoading) {
      void refetchList();
    }
  }, [isTeamMemberAccount, workspaces.length, listLoading, refetchList]);

  useEffect(() => {
    if (listError && !listLoading) {
      void refetchList();
    }
  }, [listError, listLoading, refetchList]);

  const activeWorkspaceId = selectedId;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const isBillingAccountOwner = profileSummary?.accountRole?.type === "user" && ownsAnyWorkspace;

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ["workspace-permissions", activeWorkspaceId],
    queryFn: () =>
      fetchJson<WorkspacePermissionsResponse>(`${basePath}/api/workspaces/${activeWorkspaceId}/permissions/me`),
    enabled: isLoaded && !!user && !!activeWorkspaceId,
    staleTime: 30_000,
  });

  const permissions = permData?.permissions ?? {};
  const roleName = permData?.roleName ?? activeWorkspace?.roleName ?? "Unassigned";
  const isWorkspaceAccountOwner =
    permData?.isAccountOwner ?? activeWorkspace?.isAccountOwner ?? false;
  const isAccountOwner =
    isWorkspaceAccountOwner || (ownsAnyWorkspace && !isTeamMemberAccount && profileSummary?.accountRole?.type === "user");

  const featureWorkspaceId = workspaceApiScopeActive
    ? (isBillingAccountOwner && ownsAnyWorkspace && !workspaceScopeCommitted ? null : activeWorkspaceId)
    : null;
  const featureWorkspace = featureWorkspaceId
    ? workspaces.find((w) => w.id === featureWorkspaceId) ?? null
    : null;
  const needsWorkspaceSelection = isBillingAccountOwner
    && ownsAnyWorkspace
    && workspaceApiScopeActive
    && !workspaceScopeCommitted
    && parseWorkspaceRouteId(location) == null;

  useEffect(() => {
    setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

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

  const canDelete = useCallback(
    (feature: WorkspaceFeature) => can(feature, "delete"),
    [can],
  );

  const setWorkspace = useCallback((id: number) => {
    setSelectedId(id);
    setWorkspaceScopeCommitted(true);
    localStorage.setItem(STORAGE_KEY, String(id));
    void qc.invalidateQueries({ queryKey: ["workspace-permissions"] });
    void qc.invalidateQueries({ queryKey: ["audits"] });
    void qc.invalidateQueries({ queryKey: ["graphics-projects"] });
    void qc.invalidateQueries({ queryKey: ["recents"] });
    void qc.invalidateQueries({ queryKey: ["/api/recents"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["archive"] });
    void qc.invalidateQueries({ queryKey: ["search-projects"] });
    void qc.removeQueries({ queryKey: ["workspace-permissions"], exact: false });
  }, [qc]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    featureWorkspaceId,
    featureWorkspace,
    permissions,
    roleName,
    isAccountOwner,
    isTeamMemberAccount,
    isLoading: listLoading || permLoading || !isLoaded,
    setActiveWorkspaceId: setWorkspace,
    can,
    canView,
    canEdit,
    canDelete,
    canManageWorkspaces: isAccountOwner || can("workspaces", "viewGlobal"),
    isWorkspaceApiScopeActive: workspaceApiScopeActive,
    needsWorkspaceSelection,
    refetch: () => { void refetchList(); },
  }), [
    workspaces, activeWorkspace, activeWorkspaceId, featureWorkspaceId, featureWorkspace,
    permissions, roleName, isAccountOwner, isTeamMemberAccount,
    listLoading, permLoading, isLoaded, setWorkspace, can, canView, canEdit, canDelete, refetchList,
    workspaceApiScopeActive, needsWorkspaceSelection,
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
