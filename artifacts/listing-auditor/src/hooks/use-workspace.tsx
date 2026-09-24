import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isWorkspaceApiScopeActive, isWorkspaceAdminOverviewRoute, parseWorkspaceRouteId } from "@/lib/workspace-routes";
import {
  hasWorkspacePermission,
  hasWorkspacesAccountPermission,
  type WorkspaceFeature,
  type WorkspaceAction,
  type WorkspaceRolePermissions,
} from "@workspace/workspace-permissions";
import { fetchJson } from "@/lib/api-fetch";
import { refetchCreditQueries } from "@/lib/credit-queries";
import { pathUsesAgencyAccountWideApiScope } from "@/lib/agency-dashboard-scope";
import { setActiveWorkspaceId } from "@/lib/workspace-header";
import { resetWorkspaceScopedQueries } from "@/lib/workspace-query-sync";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "la_active_workspace_id";
const AGENCY_OVERVIEW_KEY = "la_agency_account_overview";

function readAgencyAccountOverview(): boolean {
  try {
    return localStorage.getItem(AGENCY_OVERVIEW_KEY) !== "false";
  } catch {
    return true;
  }
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  isAccountOwner: boolean;
  roleName: string | null;
  accountOwnerEmail?: string | null;
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
  /** Owner of the currently selected workspace (not billing subscription alone). */
  isWorkspaceAccountOwner: boolean;
  isTeamMemberAccount: boolean;
  isLoading: boolean;
  /** Workspace role permissions still loading for the active workspace (members). */
  permissionsLoading: boolean;
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
  /** Billing customer (accountRole user), including before first workspace exists. */
  isBillingAccountOwner: boolean;
  /** Billing owner picked a workspace for scoped dashboard / project APIs (false after visiting workspace hub). */
  workspaceScopeCommitted: boolean;
  /** Agency billing owner: rollup across all workspaces (not tied to isDefault / My Workspace). */
  isAgencyAccountOverview: boolean;
  setAgencyAccountOverview: (active: boolean) => void;
  profileLoading: boolean;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspaceId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const defaultRaw = localStorage.getItem("la_default_workspace_id");
    if (!defaultRaw) return null;
    const defaultId = Number(defaultRaw);
    return Number.isFinite(defaultId) && defaultId > 0 ? defaultId : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(() => readStoredWorkspaceId());
  const [agencyAccountOverview, setAgencyOverviewState] = useState(readAgencyAccountOverview);
  const [workspaceScopeCommitted, setWorkspaceScopeCommitted] = useState(false);
  const overviewVisitedThisSession = useRef(false);
  const workspaceApiScopeActive = isWorkspaceApiScopeActive(location);
  const { workspacesEnabled: multiWorkspacePlanEnabled } = useWorkspacesPlan();

  const { data: listData, isLoading: listLoading, isError: listError, refetch: refetchList } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => fetchJson<{ workspaces: WorkspaceSummary[] }>(`${basePath}/api/workspaces`),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    retry: 3,
  });

  const workspaces = listData?.workspaces ?? [];

  const { data: profileSummary, isLoading: profileLoading } = useQuery<{
    accountRole?: { type: string; label: string };
  }>({
    queryKey: ["user-profile-summary"],
    queryFn: () =>
      fetchJson<{ accountRole?: { type: string; label: string } }>(`${basePath}/api/profile/summary`),
    enabled: isLoaded && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  const sharedWorkspaceMember =
    (listData?.workspaces?.length ?? 0) > 0
    && !(listData?.workspaces?.some((w) => w.isAccountOwner) ?? false);

  const { data: accountPermPayload, isLoading: accountPermsLoading } = useQuery<{
    permissions: WorkspaceRolePermissions;
    workspacesEnabled: boolean;
  }>({
    queryKey: ["team-account-permissions"],
    queryFn: () =>
      fetchJson<{ permissions: WorkspaceRolePermissions; workspacesEnabled: boolean }>(
        `${basePath}/api/team/account-permissions`,
      ),
    enabled:
      isLoaded
      && !!user
      && (profileSummary?.accountRole?.type === "team_member" || sharedWorkspaceMember),
    staleTime: 30_000,
  });

  const ownsAnyWorkspace = workspaces.some((w) => w.isAccountOwner);
  const hasOnlySharedWorkspaces = workspaces.length > 0 && !ownsAnyWorkspace;
  const profileTeamMember = profileSummary?.accountRole?.type === "team_member";
  const isTeamMemberAccount = profileTeamMember || hasOnlySharedWorkspaces;
  const isBillingAccountOwnerProfile = profileSummary?.accountRole?.type === "user" && !profileTeamMember;
  const isMainDashboardRoute = location === "/dashboard" || location === "/";
  const isAccountWideListRoute = pathUsesAgencyAccountWideApiScope(location);

  // Plan without multi-workspace: skip agency overview / pick-a-workspace gates — use default workspace immediately.
  useEffect(() => {
    if (multiWorkspacePlanEnabled) return;
    if (!isBillingAccountOwnerProfile || !workspaces.length) return;
    setAgencyOverviewState(false);
    try {
      localStorage.setItem(AGENCY_OVERVIEW_KEY, "false");
    } catch {
      /* ignore */
    }
    if (!workspaceScopeCommitted) setWorkspaceScopeCommitted(true);
    const owned = workspaces.filter((w) => w.isAccountOwner);
    const fallback = owned.find((w) => w.isDefault) ?? owned[0];
    if (fallback && selectedId !== fallback.id) {
      setSelectedId(fallback.id);
      localStorage.setItem(STORAGE_KEY, String(fallback.id));
    }
  }, [
    multiWorkspacePlanEnabled,
    isBillingAccountOwnerProfile,
    workspaces,
    selectedId,
    workspaceScopeCommitted,
  ]);

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
    setAgencyOverviewState(false);
    try {
      localStorage.setItem(AGENCY_OVERVIEW_KEY, "false");
    } catch {
      /* ignore */
    }
    if (!workspaceScopeCommitted) setWorkspaceScopeCommitted(true);
  }, [location, workspaces, selectedId, workspaceScopeCommitted]);

  useEffect(() => {
    if (!workspaces.length || workspaceScopeCommitted || overviewVisitedThisSession.current) return;
    if (isWorkspaceAdminOverviewRoute(location)) return;
    if (isBillingAccountOwnerProfile && (location === "/dashboard" || location === "/")) return;
    const owns = workspaces.some((w) => w.isAccountOwner);
    const billing = profileSummary?.accountRole?.type === "user";
    const sharedOnly = workspaces.length > 0 && !owns;
    const teamMember = profileSummary?.accountRole?.type === "team_member";
    if (!owns && !billing && !sharedOnly && !teamMember) return;
    if (selectedId != null && workspaces.some((w) => w.id === selectedId)) {
      setWorkspaceScopeCommitted(true);
    }
  }, [
    workspaces,
    selectedId,
    location,
    profileSummary?.accountRole?.type,
    workspaceScopeCommitted,
    profileTeamMember,
    ownsAnyWorkspace,
    agencyAccountOverview,
    isAccountWideListRoute,
  ]);

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
    if (ownsAnyWorkspace && billingAccountOwner && !profileTeamMember) {
      const onAccountWidePage =
        location === "/" || location === "/dashboard" || isAccountWideListRoute;
      if (agencyAccountOverview && onAccountWidePage) {
        return;
      }
      const owned = workspaces.filter((w) => w.isAccountOwner);
      const fallback = owned.find((w) => w.isDefault) ?? owned[0];
      if (fallback) {
        if (selectedId !== fallback.id) {
          setSelectedId(fallback.id);
          localStorage.setItem(STORAGE_KEY, String(fallback.id));
        }
        if (!workspaceScopeCommitted && !onAccountWidePage) {
          setWorkspaceScopeCommitted(true);
        }
      }
      return;
    }

    const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;
    setSelectedId(fallback.id);
    localStorage.setItem(STORAGE_KEY, String(fallback.id));
  }, [workspaces, selectedId, profileSummary?.accountRole?.type, profileTeamMember, ownsAnyWorkspace, listLoading, agencyAccountOverview]);

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
  const isBillingAccountOwner = isBillingAccountOwnerProfile;
  const skipPermLoadingForNav =
    isBillingAccountOwnerProfile
    || isTeamMemberAccount
    || profileSummary?.accountRole?.type === "platform_admin";

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
    isWorkspaceAccountOwner || isBillingAccountOwner;

  const isAgencyAccountOverview =
    multiWorkspacePlanEnabled
    && isBillingAccountOwner
    && ownsAnyWorkspace
    && agencyAccountOverview;

  const withholdWorkspaceScope =
    multiWorkspacePlanEnabled
    && isBillingAccountOwner
    && ownsAnyWorkspace
    && !workspaceScopeCommitted
    && !isMainDashboardRoute;

  const withholdForAgencyOverview =
    isAgencyAccountOverview && (isMainDashboardRoute || isAccountWideListRoute);

  const validActiveWorkspace =
    activeWorkspaceId != null
    && (
      workspaces.some((w) => w.id === activeWorkspaceId)
      || selectedId === activeWorkspaceId
    );
  const withholdFeatureWorkspaceScope =
    (withholdWorkspaceScope && !(validActiveWorkspace && !isAccountWideListRoute))
    || withholdForAgencyOverview;

  const featureWorkspaceId = workspaceApiScopeActive
    ? (withholdFeatureWorkspaceScope ? null : activeWorkspaceId)
    : null;
  const featureWorkspace = featureWorkspaceId
    ? workspaces.find((w) => w.id === featureWorkspaceId)
      ?? (featureWorkspaceId === selectedId
        ? {
          id: featureWorkspaceId,
          name: "Workspace",
          description: null,
          clientLabel: null,
          isDefault: false,
          isAccountOwner: isBillingAccountOwner,
          roleName: null,
        }
        : null)
    : null;
  const needsWorkspaceSelection = withholdWorkspaceScope
    && workspaceApiScopeActive
    && parseWorkspaceRouteId(location) == null
    && !validActiveWorkspace;

  // Sync module header before paint so fetch interceptors see the right workspace (never during render — causes React #310).
  useLayoutEffect(() => {
    if (isAgencyAccountOverview) {
      setActiveWorkspaceId(null);
      return;
    }
    setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId, isAgencyAccountOverview]);

  const accountPermissions = accountPermPayload?.permissions;

  const can = useCallback(
    (feature: WorkspaceFeature, action: WorkspaceAction) => {
      if (isWorkspaceAccountOwner) return true;
      if (feature === "workspaces") {
        if (action === "viewGlobal" || action === "viewOwn") {
          const source = accountPermissions ?? permissions;
          return hasWorkspacePermission(source, "workspaces", "viewGlobal");
        }
        if (action === "create" || action === "edit" || action === "delete") {
          if (accountPermsLoading || permLoading) return false;
          const source = accountPermissions ?? permissions;
          return hasWorkspacesAccountPermission(source, action);
        }
      }
      return hasWorkspacePermission(permissions, feature, action);
    },
    [permissions, isWorkspaceAccountOwner, accountPermissions, accountPermsLoading, permLoading],
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

  const setAgencyAccountOverview = useCallback((active: boolean) => {
    setAgencyOverviewState(active);
    try {
      localStorage.setItem(AGENCY_OVERVIEW_KEY, active ? "true" : "false");
    } catch {
      /* ignore */
    }
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  }, [qc]);

  const setWorkspace = useCallback((id: number) => {
    const changed = selectedId !== id;
    setActiveWorkspaceId(id);
    setSelectedId(id);
    setAgencyOverviewState(false);
    try {
      localStorage.setItem(AGENCY_OVERVIEW_KEY, "false");
    } catch {
      /* ignore */
    }
    setWorkspaceScopeCommitted(true);
    localStorage.setItem(STORAGE_KEY, String(id));
    if (!changed && !agencyAccountOverview) return;
    resetWorkspaceScopedQueries(qc);
    void refetchCreditQueries(qc);
  }, [qc, selectedId, agencyAccountOverview]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    featureWorkspaceId,
    featureWorkspace,
    permissions,
    roleName,
    isAccountOwner,
    isWorkspaceAccountOwner,
    isTeamMemberAccount,
    isLoading: listLoading || (!skipPermLoadingForNav && permLoading) || (profileLoading && workspaces.length === 0) || !isLoaded,
    permissionsLoading: Boolean(activeWorkspaceId && permLoading && !skipPermLoadingForNav),
    setActiveWorkspaceId: setWorkspace,
    can,
    canView,
    canEdit,
    canDelete,
    canManageWorkspaces: isWorkspaceAccountOwner || can("workspaces", "viewGlobal"),
    isWorkspaceApiScopeActive: workspaceApiScopeActive,
    needsWorkspaceSelection,
    isBillingAccountOwner,
    workspaceScopeCommitted,
    isAgencyAccountOverview,
    setAgencyAccountOverview,
    profileLoading,
    refetch: () => { void refetchList(); },
  }), [
    workspaces, activeWorkspace, activeWorkspaceId, featureWorkspaceId, featureWorkspace,
    permissions, roleName, isAccountOwner, isWorkspaceAccountOwner, isTeamMemberAccount, isBillingAccountOwner, profileLoading,
    listLoading, permLoading, skipPermLoadingForNav, isLoaded, activeWorkspaceId, setWorkspace, setAgencyAccountOverview, can, canView, canEdit, canDelete, refetchList,
    workspaceApiScopeActive, needsWorkspaceSelection, workspaceScopeCommitted, isAgencyAccountOverview,
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
