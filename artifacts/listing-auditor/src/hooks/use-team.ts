import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

import { fetchJson, fetchJsonArray } from "@/lib/api-fetch";

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
  canEdit: boolean;
  canManage: boolean;
  isLoading: boolean;
  memberCredits: MemberCredits | null;
  memberCreditsLoading: boolean;
}

export function useTeam(): TeamContext {
  const { user, isLoaded } = useUser();

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
  const isOwner = !isTeamMember;
  const canEdit = role === "admin" || role === "editor" || isOwner;
  const canManage = isOwner;

  return {
    membership,
    role,
    isTeamMember,
    isOwner,
    canEdit,
    canManage,
    isLoading,
    memberCredits: creditsData?.credits ?? null,
    memberCreditsLoading: creditsLoading,
  };
}
