import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface TeamMembership {
  id: number;
  ownerUserId: string;
  role: "admin" | "editor" | "viewer";
  status: string;
  invitedName: string;
  acceptedAt: string | null;
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
  const { data, isLoading } = useQuery<TeamMembership[]>({
    queryKey: ["team-membership"],
    queryFn: () =>
      fetch(`${basePath}/api/team/membership`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) return [];
          return r.json();
        }),
    staleTime: 60_000,
  });

  const { data: creditsData, isLoading: creditsLoading } = useQuery<{ credits: MemberCredits }>({
    queryKey: ["team-membership-credits"],
    queryFn: () =>
      fetch(`${basePath}/api/team/membership/credits`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) return { credits: { aiCredits: 0, imageCredits: 0, auditCredits: 0 } };
          return r.json();
        }),
    staleTime: 60_000,
    enabled: !!data && data.length > 0,
  });

  const membership = data && data.length > 0 ? data[0] : null;
  const role = membership?.role ?? "owner";
  const isTeamMember = !!membership;
  const isOwner = !isTeamMember;
  const canEdit = role === "admin" || role === "editor" || isOwner;
  const canManage = role === "admin" || isOwner;

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
