import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

import { fetchJson, fetchJsonArray } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";
import type { WorkspaceFeature } from "@workspace/workspace-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface TeamMembership {
  id: number;
  ownerUserId: string;
  role: "admin" | "editor" | "viewer";
  status: string;
  invitedName: string;
  acceptedAt: string | null;
  workspaceName?: string;
}

export interface MemberCredits {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

export interface TeamContext {
  membership: TeamMembership | null;
  role: "admin" | "editor" | "viewer" | "owner";
  isTeamMember: boolean;
  isOwner: boolean;
  /** Edit/create on audits or build-brand flows. */
  canEditAudits: boolean;
  /** Edit/create on graphics projects. */
  canEditGraphics: boolean;
  /** Legacy aggregate — true when either audit or graphics edit is allowed. */
  canEdit: boolean;
  canDeleteAudits: boolean;
  canDeleteGraphics: boolean;
  canManage: boolean;
  isLoading: boolean;
  memberCredits: MemberCredits | null;
  memberCreditsLoading: boolean;
  canEditFeature: (feature: WorkspaceFeature) => boolean;
  canDeleteFeature: (feature: WorkspaceFeature) => boolean;
}

export function useTeam(): TeamContext {
  const { user, isLoaded } = useUser();
  const {
    canEdit: wsCanEdit,
    canDelete: wsCanDelete,
    isAccountOwner: wsOwner,
    isLoading: wsLoading,
    workspaces,
  } = useWorkspace();

  const { data, isLoading } = useQuery<TeamMembership[]>({
    queryKey: ["team-membership"],
    queryFn: () => fetchJsonArray<TeamMembership>(`${basePath}/api/team/membership`),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    retry: 3,
  });

  const { data: creditsData, isLoading: creditsLoading } = useQuery<{ credits: MemberCredits }>({
    queryKey: ["team-membership-credits"],
    queryFn: () =>
      fetchJson<{ credits: MemberCredits }>(`${basePath}/api/team/membership/credits`).catch(
        () => ({ credits: { aiCredits: 0, imageCredits: 0, auditCredits: 0 } }),
      ),
    staleTime: 60_000,
    retry: 3,
    enabled: !!data && data.length > 0,
  });

  const membership = data && data.length > 0 ? data[0] : null;
  const role = membership?.role ?? "owner";
  const isTeamMember = !!membership;
  const isOwner = !isTeamMember || wsOwner;
  const hasWorkspaces = workspaces.length > 0;

  const canEditAudits =
    wsOwner ||
    wsCanEdit("audits") ||
    wsCanEdit("build_brand") ||
    (!hasWorkspaces && (role === "admin" || role === "editor" || isOwner));
  const canEditGraphics =
    wsOwner ||
    wsCanEdit("graphics") ||
    (!hasWorkspaces && (role === "admin" || role === "editor" || isOwner));
  const canEdit = canEditAudits || canEditGraphics;
  const canDeleteAudits = wsOwner || wsCanDelete("audits");
  const canDeleteGraphics = wsOwner || wsCanDelete("graphics");
  const canManage = wsOwner || isOwner;

  const canEditFeature = (feature: WorkspaceFeature) => {
    if (wsOwner) return true;
    if (feature === "build_brand" || feature === "audits") return canEditAudits;
    if (feature === "graphics") return canEditGraphics;
    return wsCanEdit(feature);
  };

  const canDeleteFeature = (feature: WorkspaceFeature) => {
    if (wsOwner) return true;
    if (feature === "build_brand" || feature === "audits") return canDeleteAudits;
    if (feature === "graphics") return canDeleteGraphics;
    return wsCanDelete(feature);
  };

  return {
    membership,
    role,
    isTeamMember,
    isOwner,
    canEditAudits,
    canEditGraphics,
    canEdit,
    canDeleteAudits,
    canDeleteGraphics,
    canManage,
    isLoading: isLoading || wsLoading,
    memberCredits: creditsData?.credits ?? null,
    memberCreditsLoading: creditsLoading,
    canEditFeature,
    canDeleteFeature,
  };
}
