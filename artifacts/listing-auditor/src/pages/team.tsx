import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useLocation, Link } from "wouter";
import {
  Users, Plus, Trash2, Mail, Shield, MoreHorizontal,
  CheckCircle2, Copy, Clock, BarChart3, Zap,
  AlertTriangle, Building2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import { useWorkspace } from "@/hooks/use-workspace";
import { accountRoleLabel } from "@/lib/role-display";
import { fetchJson } from "@/lib/api-fetch";
import { ResponsiveTable } from "@/components/responsive-table";
import { format, formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AccountRole {
  id: number;
  name: string;
  description: string | null;
}

interface TeamMember {
  id: number;
  ownerUserId: string;
  memberUserId: string | null;
  invitedEmail: string;
  invitedName: string;
  role: string;
  roleId: number | null;
  status: string;
  inviteToken: string;
  invitedAt: string;
  acceptedAt: string | null;
}

interface MemberStat {
  memberId: number;
  auditCount: number;
  creditsUsed: number;
  lastActivityAt: string | null;
  remainingCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
  allocatedCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

interface WorkspaceMemberListItem {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  userId: string | null;
  roleId?: number | null;
  roleName: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

interface WorkspaceMemberSummary {
  totalMemberships: number;
  uniquePeople: number;
  activeMembers: number;
  pendingInvites: number;
  scopedWorkspaceId: number | null;
  workspaces: Array<{
    id: number;
    name: string;
    isDefault: boolean;
    memberCount: number;
    activeMemberCount: number;
    pendingMemberCount: number;
    members: WorkspaceMemberListItem[];
  }>;
}

interface WorkspaceMemberStat {
  workspaceMemberId: number;
  teamMemberId: number | null;
  auditCount: number;
  creditsUsed: number;
  lastActivityAt: string | null;
  remainingCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
  allocatedCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

interface TeamData {
  maxSeats: number;
  planName: string | null;
  planStatus: string | null;
  ownerCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
  totalAllocated?: { aiCredits: number; imageCredits: number; auditCredits: number };
  availableToAllocate?: { aiCredits: number; imageCredits: number; auditCredits: number };
  members: TeamMember[];
  memberStats: MemberStat[];
  workspaceMembers?: WorkspaceMemberSummary;
  workspaceMemberStats?: WorkspaceMemberStat[];
}

const roleBadgeColors = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-slate-100 text-slate-600",
];

function roleBadgeClass(roleId: number | null | undefined, roles: AccountRole[]): string {
  if (roleId) {
    const idx = roles.findIndex((r) => r.id === roleId);
    if (idx >= 0) return roleBadgeColors[idx % roleBadgeColors.length];
  }
  return "bg-slate-100 text-slate-600";
}

function copyToClipboard(text: string, label: string, toast: (t: object) => void) {
  navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied!` }));
}

function WorkspaceMembersList({
  members,
  roles,
  emptyLabel,
}: {
  members: WorkspaceMemberListItem[];
  roles: AccountRole[];
  emptyLabel?: string;
}) {
  if (members.length === 0) {
    return <p className="text-xs text-slate-500 py-2">{emptyLabel ?? "No members yet."}</p>;
  }
  return (
    <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-white">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{m.invitedName || m.invitedEmail}</p>
            <p className="text-xs text-slate-500 truncate">{m.invitedEmail}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {accountRoleLabel(m.roleId, m.roleName, roles)}
            </Badge>
            <Badge
              variant={m.status === "active" ? "secondary" : "outline"}
              className={`text-xs capitalize ${m.status === "pending" ? "border-amber-200 text-amber-700" : ""}`}
            >
              {m.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

interface WorkspaceMembersDetailPanelProps {
  members: WorkspaceMemberListItem[];
  stats: WorkspaceMemberStat[];
  roles: AccountRole[];
  canManageCredits: boolean;
  availableToAllocate?: TeamData["availableToAllocate"];
  editingCredits: Record<number, { aiCredits: string; imageCredits: string; auditCredits: string }>;
  setEditingCredits: Dispatch<SetStateAction<Record<number, { aiCredits: string; imageCredits: string; auditCredits: string }>>>;
  onSaveCredits: (workspaceMemberId: number, aiCredits: number, imageCredits: number, auditCredits: number) => void;
  creditSaving: boolean;
  emptyLabel?: string;
}

function WorkspaceMembersDetailPanel({
  members,
  stats,
  roles,
  canManageCredits,
  availableToAllocate,
  editingCredits,
  setEditingCredits,
  onSaveCredits,
  creditSaving,
  emptyLabel,
}: WorkspaceMembersDetailPanelProps) {
  if (members.length === 0) {
    return <p className="text-xs text-slate-500 py-4">{emptyLabel ?? "No members yet."}</p>;
  }

  function getWsStat(workspaceMemberId: number) {
    return stats.find((s) => s.workspaceMemberId === workspaceMemberId);
  }

  const active = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
      {active.map((m) => {
        const stat = getWsStat(m.id);
        const isEditing = editingCredits[m.id] != null;
        const editVals = editingCredits[m.id] ?? {
          aiCredits: String(stat?.allocatedCredits?.aiCredits ?? 0),
          imageCredits: String(stat?.allocatedCredits?.imageCredits ?? 0),
          auditCredits: String(stat?.allocatedCredits?.auditCredits ?? 0),
        };

        return (
          <div key={m.id} className="px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600">
                {(m.invitedName?.[0] ?? m.invitedEmail[0]).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName || m.invitedEmail}</p>
                <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
                {stat && !isEditing && (
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3 text-orange-400" />{stat.auditCount} audit actions
                    </span>
                    <span className="text-xs text-slate-400">{stat.creditsUsed} credits used</span>
                    {stat.remainingCredits && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-blue-400" />
                        {stat.remainingCredits.aiCredits} AI / {stat.remainingCredits.imageCredits} Img / {stat.remainingCredits.auditCredits} Audit left
                      </span>
                    )}
                    {stat.lastActivityAt && (
                      <span className="text-xs text-slate-400">
                        Last active {formatDistanceToNow(new Date(stat.lastActivityAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
              {accountRoleLabel(m.roleId, m.roleName, roles)}
            </Badge>
              <Badge variant="outline" className="border-green-200 text-green-600 flex-shrink-0">Active</Badge>
              {m.acceptedAt && (
                <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap">
                  Joined {format(new Date(m.acceptedAt), "MMM d, yyyy")}
                </span>
              )}
              {canManageCredits && m.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => setEditingCredits((prev) => ({
                    ...prev,
                    [m.id]: {
                      aiCredits: String(stat?.allocatedCredits?.aiCredits ?? 0),
                      imageCredits: String(stat?.allocatedCredits?.imageCredits ?? 0),
                      auditCredits: String(stat?.allocatedCredits?.auditCredits ?? 0),
                    },
                  }))}
                >
                  <Zap className="w-4 h-4" />
                </Button>
              )}
            </div>
            {isEditing && (
              <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Allocate Credits</span>
                </div>
                {availableToAllocate && (
                  <p className="text-xs text-slate-500 mb-3">
                    Available to assign: up to {availableToAllocate.auditCredits} audit, {availableToAllocate.aiCredits} text, {availableToAllocate.imageCredits} image credits.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">AI Credits</Label>
                    <Input type="number" min={0} value={editVals.aiCredits} className="h-8 text-sm"
                      onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id]!, aiCredits: e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Image Credits</Label>
                    <Input type="number" min={0} value={editVals.imageCredits} className="h-8 text-sm"
                      onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id]!, imageCredits: e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Audit Credits</Label>
                    <Input type="number" min={0} value={editVals.auditCredits} className="h-8 text-sm"
                      onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id]!, auditCredits: e.target.value } }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={creditSaving}
                    onClick={() => {
                      onSaveCredits(
                        m.id,
                        Math.max(0, parseInt(editVals.aiCredits) || 0),
                        Math.max(0, parseInt(editVals.imageCredits) || 0),
                        Math.max(0, parseInt(editVals.auditCredits) || 0),
                      );
                      setEditingCredits((prev) => {
                        const next = { ...prev };
                        delete next[m.id];
                        return next;
                      });
                    }}>
                    {creditSaving ? "Saving..." : "Save Credits"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingCredits((prev) => {
                    const next = { ...prev };
                    delete next[m.id];
                    return next;
                  })}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {pending.map((m) => (
        <div key={m.id} className="flex items-center gap-4 px-5 py-4 bg-amber-50/40">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName || m.invitedEmail}</p>
            <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Invite sent {formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">{accountRoleLabel(m.roleId, m.roleName, roles)}</Badge>
          <Badge variant="outline" className="border-amber-200 text-amber-600 flex-shrink-0">Pending</Badge>
        </div>
      ))}
    </div>
  );
}

export default function Team() {
  const { user } = useUser();
  const { canManage, isTeamMember, isOwner, role, membership, memberCredits } = useTeam();
  const {
    featureWorkspaceId,
    featureWorkspace,
    isAccountOwner,
    can,
  } = useWorkspace();
  const [, setLocation] = useLocation();
  const viewAllWorkspaces = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("all") === "1";
  const scopedWorkspaceId = isAccountOwner && viewAllWorkspaces ? null : featureWorkspaceId;
  const isAdminTeamView = isAccountOwner && !scopedWorkspaceId;
  const isWorkspaceTeamView = scopedWorkspaceId != null;
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: rolesData } = useQuery({
    queryKey: ["account-roles"],
    queryFn: () => fetchJson<{ roles: AccountRole[] }>(`${basePath}/api/account/roles`),
    enabled: isAccountOwner,
  });
  const accountRoles = rolesData?.roles ?? [];

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team", scopedWorkspaceId],
    queryFn: () => {
      const url = scopedWorkspaceId
        ? `${basePath}/api/team?workspaceId=${scopedWorkspaceId}`
        : `${basePath}/api/team`;
      return fetch(url, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load team");
        return r.json();
      });
    },
    enabled: isAccountOwner,
  });

  const { data: scopedWorkspaceMembersData } = useQuery({
    queryKey: ["workspace-members", scopedWorkspaceId],
    queryFn: () => fetchJson<{
      members: Array<{
        id: number;
        invitedEmail: string;
        invitedName: string;
        status: string;
        userId: string | null;
        roleId?: number | null;
        roleName?: string | null;
        invitedAt: string;
        acceptedAt: string | null;
        allocatedCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
      }>;
      poolAvailableForMembers?: { aiCredits: number; imageCredits: number; auditCredits: number };
    }>(`${basePath}/api/workspaces/${scopedWorkspaceId}/members`),
    enabled: scopedWorkspaceId != null && (can("team", "viewGlobal") || can("credits", "viewGlobal") || canManage),
  });

  const workspacePoolAvailable = scopedWorkspaceMembersData?.poolAvailableForMembers;

  const { data: overviewFallback } = useQuery({
    queryKey: ["workspaces-overview"],
    queryFn: () => fetchJson<{
      workspaces: Array<{
        id: number;
        name: string;
        isDefault: boolean;
        memberCount: number;
        activeMemberCount: number;
        pendingMemberCount: number;
        members?: WorkspaceMemberListItem[];
      }>;
      totalMemberships?: number;
      totalMembers?: number;
      uniquePeople?: number;
      activeMembers?: number;
      pendingInvites?: number;
    }>(`${basePath}/api/workspaces/overview`),
    enabled: isAdminTeamView,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: number; roleId: number }) =>
      fetch(`${basePath}/api/team/${id}/role`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast({ title: "Role updated" }); },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/team/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast({ title: "Member removed" }); },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const creditMutation = useMutation({
    mutationFn: ({ id, aiCredits, imageCredits, auditCredits }: { id: number; aiCredits: number; imageCredits: number; auditCredits: number }) => {
      if (!scopedWorkspaceId) {
        throw new Error("Select a workspace to assign credits from its pool.");
      }
      return fetch(`${basePath}/api/workspaces/${scopedWorkspaceId}/members/${id}/credits`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiCredits, imageCredits, auditCredits }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to update credits");
        return data;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
      toast({ title: "Credits updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update credits", description: e.message, variant: "destructive" }),
  });

  const [editingCredits, setEditingCredits] = useState<Record<number, { aiCredits: string; imageCredits: string; auditCredits: string }>>({});

  const members = data?.members ?? [];
  const memberStats = data?.memberStats ?? [];
  const maxSeats = data?.maxSeats ?? 1;
  const activePendingCount = members.filter((m) => m.status !== "revoked").length + 1; // +1 for owner
  const isAtLimit = activePendingCount >= maxSeats;
  const pct = Math.min(100, Math.round((activePendingCount / maxSeats) * 100));

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  const scopedWorkspaceMembers: WorkspaceMemberListItem[] = isAccountOwner
    ? (data?.workspaceMembers?.workspaces[0]?.members ?? [])
    : (scopedWorkspaceMembersData?.members ?? []).map((m) => ({
      id: m.id,
      invitedEmail: m.invitedEmail,
      invitedName: m.invitedName,
      status: m.status,
      userId: m.userId,
      roleId: m.roleId ?? null,
      roleName: m.roleName ?? null,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
    }));

  const scopedWorkspaceName = isAccountOwner
    ? data?.workspaceMembers?.workspaces[0]?.name ?? featureWorkspace?.name
    : featureWorkspace?.name;

  const workspaceMemberStats = data?.workspaceMemberStats ?? [];

  const adminWorkspaceRows = (data?.workspaceMembers?.workspaces?.length
    ? data.workspaceMembers.workspaces
    : overviewFallback?.workspaces?.map((ws) => ({
      id: ws.id,
      name: ws.name,
      isDefault: ws.isDefault,
      memberCount: ws.memberCount,
      activeMemberCount: ws.activeMemberCount,
      pendingMemberCount: ws.pendingMemberCount,
      members: ws.members ?? [],
    }))) ?? [];

  const adminSummary = data?.workspaceMembers ?? (overviewFallback ? {
    totalMemberships: overviewFallback.totalMembers ?? 0,
    uniquePeople: overviewFallback.uniquePeople ?? 0,
    activeMembers: overviewFallback.activeMembers ?? 0,
    pendingInvites: overviewFallback.pendingInvites ?? 0,
    scopedWorkspaceId: null,
    workspaces: adminWorkspaceRows,
  } : null);

  function getInviteUrl(token: string) {
    return `${window.location.origin}${basePath}/accept-invite?token=${token}`;
  }

  function getStat(memberId: number) {
    return memberStats.find((s) => s.memberId === memberId);
  }

  if (isTeamMember && !isOwner) {
    const allocated = memberCredits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 mt-1 text-sm">
            You are a <span className="font-medium capitalize">{role}</span> on{" "}
            <span className="font-medium text-slate-700">{membership?.workspaceName ?? "this workspace"}</span>.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Team management is handled by the workspace owner. You can work on shared audits from the dashboard.
          </p>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Your remaining credits</p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {allocated.aiCredits + allocated.imageCredits + allocated.auditCredits} credits
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {allocated.auditCredits} audit · {allocated.aiCredits} text · {allocated.imageCredits} images
            </p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isWorkspaceTeamView
              ? `Members with access to ${scopedWorkspaceName ?? "this workspace"}.`
              : isAdminTeamView
                ? "All workspaces and their members across your account."
                : "Manage who has access to your workspace."}
          </p>
          {isWorkspaceTeamView && isAccountOwner && (
            <p className="text-xs text-slate-400 mt-1">
              Scoped to the workspace selected in the switcher.{" "}
              <Link href="/team?all=1" className="underline font-medium text-slate-600">View all workspaces</Link>
            </p>
          )}
          {isTeamMember && (
            <p className="text-xs text-slate-400 mt-1">Your role: <span className="font-medium capitalize">{role}</span></p>
          )}
        </div>
        {canManage && isWorkspaceTeamView && scopedWorkspaceId != null && (
          <Link href={`/workspaces/${scopedWorkspaceId}/members`}>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" />
              Invite to workspace
            </Button>
          </Link>
        )}
      </div>

      {/* Seat usage (account billing) */}
      {isAccountOwner && (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Seats used</span>
            {data?.planName && <Badge variant="outline" className="text-xs">{data.planName}</Badge>}
          </div>
          <span className="text-sm font-semibold text-slate-900">{activePendingCount} / {maxSeats}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-yellow-400" : "bg-orange-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Seat limit reached.{" "}
            <button className="underline font-semibold" onClick={() => setLocation("/billing")}>Upgrade your plan</button>
            {" "}to add more members.
          </p>
        )}
        {isAccountOwner && data?.availableToAllocate && (
          <p className="text-xs text-slate-500 mt-3">
            Account credits not yet in workspace pools:{" "}
            <span className="font-medium text-slate-700">
              {data.availableToAllocate.auditCredits} audit · {data.availableToAllocate.aiCredits} text · {data.availableToAllocate.imageCredits} images
            </span>
            . Fund pools on the{" "}
            <Link href="/workspaces" className="underline font-medium">Workspaces</Link> page.
          </p>
        )}
      </div>
      )}

      {/* Workspace-scoped members with activity & credits */}
      {isWorkspaceTeamView && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-slate-900">{scopedWorkspaceName ?? "Workspace"} team</h2>
              {featureWorkspace?.isDefault && <Badge variant="secondary">Default</Badge>}
            </div>
            <Link href={`/workspaces/${scopedWorkspaceId}/members`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" />
                Manage members
              </Button>
            </Link>
          </div>
          <WorkspaceMembersDetailPanel
            members={scopedWorkspaceMembers}
            stats={workspaceMemberStats}
            roles={accountRoles}
            canManageCredits={!isAccountOwner && can("credits", "edit")}
            availableToAllocate={workspacePoolAvailable ?? data?.availableToAllocate}
            editingCredits={editingCredits}
            setEditingCredits={setEditingCredits}
            onSaveCredits={(id, ai, img, audit) => creditMutation.mutate({ id, aiCredits: ai, imageCredits: img, auditCredits: audit })}
            creditSaving={creditMutation.isPending}
            emptyLabel="No members in this workspace yet. Invite someone from the workspace members page."
          />
        </div>
      )}

      {/* Admin: all workspaces with their members */}
      {isAdminTeamView && adminSummary && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All workspaces</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Each workspace shows only its own members.
              </p>
            </div>
            <Link href="/workspaces">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Workspace hub
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total memberships</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{adminSummary.totalMemberships}</p>
                <p className="text-xs text-slate-500 mt-1">{adminSummary.uniquePeople} unique people</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Active members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{adminSummary.activeMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Pending invites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{adminSummary.pendingInvites}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Workspaces</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{adminWorkspaceRows.length}</p>
              </CardContent>
            </Card>
          </div>
          {adminWorkspaceRows.length > 0 && (
            <div className="space-y-4">
              {adminWorkspaceRows.map((ws) => (
                <Card key={ws.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <CardTitle className="text-base truncate">{ws.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ws.isDefault && <Badge variant="secondary">Default</Badge>}
                        <Badge variant="outline" className="text-xs">{ws.memberCount} members</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <WorkspaceMembersList members={ws.members ?? []} roles={accountRoles} emptyLabel="No members in this workspace." />
                    <Link href={`/workspaces/${ws.id}/members`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5" />
                        Manage members
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role guide */}
      {isAdminTeamView && accountRoles.length > 0 ? (
        <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountRoles.map((role, idx) => (
            <div key={role.id} className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <Shield className={`w-4 h-4 ${idx === 0 ? "text-orange-500" : "text-slate-400"}`} />
              </div>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wide ${roleBadgeColors[idx % roleBadgeColors.length].replace("bg-", "text-").split(" ")[0]}`}>{role.name}</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {role.description?.trim() || "Custom role — permissions set on the Roles page."}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : isAdminTeamView ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">No roles defined yet</p>
            <p className="text-xs text-amber-700 mt-1">
              Create roles on the <Link href="/roles" className="underline font-semibold">Roles</Link> page, then invite members from a workspace&apos;s Members page.
            </p>
          </div>
        </div>
      ) : null}

      {/* Account seats & credits (team_members billing) */}
      {isAdminTeamView && (
      <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Account seats & credits</h2>
          <p className="text-xs text-slate-500 mt-0.5">Billing seats for your account. Fund workspace pools on Workspaces, then workspace admins assign member credits.</p>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-medium text-slate-800 text-sm">
            {activePendingCount + pendingMembers.length} seat member{activePendingCount + pendingMembers.length !== 1 ? "s" : ""}
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {/* Owner (you) */}
          <div className="flex items-center gap-4 px-5 py-4">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-100 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-orange-600">
                {(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{user?.fullName || user?.primaryEmailAddress?.emailAddress} <span className="text-xs text-slate-400 font-normal">(you)</span></p>
              <p className="text-slate-400 text-xs">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <Badge variant="outline" className="border-green-200 text-green-600">Owner</Badge>
          </div>

          {/* Active members */}
          {activeMembers.map((m) => {
            const stat = getStat(m.id);
            return (
              <div key={m.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600">
                    {m.invitedName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName}</p>
                    <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
                    {stat && (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-orange-400" />{stat.auditCount} audit actions</span>
                        <span className="text-xs text-slate-400">{stat.creditsUsed} credits used</span>
                        {stat.remainingCredits && (
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3 text-blue-400" />{stat.remainingCredits.aiCredits} AI / {stat.remainingCredits.imageCredits} Img / {stat.remainingCredits.auditCredits} Audit left</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge className={`${roleBadgeClass(m.roleId, accountRoles)} hover:bg-inherit flex-shrink-0`}>
                    {accountRoleLabel(m.roleId, m.role, accountRoles)}
                  </Badge>
                  <Badge variant="outline" className="border-green-200 text-green-600 flex-shrink-0">Active</Badge>
                  {m.acceptedAt && <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap">Joined {format(new Date(m.acceptedAt), "MMM d, yyyy")}</span>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {accountRoles.map((accountRole) => (
                        <DropdownMenuItem
                          key={accountRole.id}
                          onClick={() => roleMutation.mutate({ id: m.id, roleId: accountRole.id })}
                          disabled={m.roleId === accountRole.id}
                        >
                          {m.roleId === accountRole.id && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />}
                          Make {accountRole.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => confirm(`Remove ${m.invitedName} from your team?`) && removeMutation.mutate(m.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {/* Pending invites */}
          {pendingMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4 bg-amber-50/40">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-600">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName}</p>
                <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />Invite sent {formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}</p>
              </div>
              <Badge className={`${roleBadgeClass(m.roleId, accountRoles)} hover:bg-inherit flex-shrink-0`}>
                {accountRoleLabel(m.roleId, m.role, accountRoles)}
              </Badge>
              <Badge variant="outline" className="border-amber-200 text-amber-600 flex-shrink-0">Pending</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => copyToClipboard(getInviteUrl(m.inviteToken), "Invite link", toast)}>
                    <Copy className="w-3.5 h-3.5 mr-2" />Copy Invite Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => confirm(`Revoke invite for ${m.invitedName}?`) && removeMutation.mutate(m.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />Revoke Invite
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && members.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No team members yet</p>
              <p className="text-slate-400 text-xs mt-1">Invite members from a workspace&apos;s Members page.</p>
              <Link href="/workspaces">
                <Button className="mt-4 bg-orange-500 hover:bg-orange-600" size="sm">
                  <Building2 className="w-4 h-4 mr-2" />Go to Workspaces
                </Button>
              </Link>
            </div>
          )}

          {isLoading && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>

      {activeMembers.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-900">Member Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Usage tracked from credit transactions in the current billing period</p>
            </div>
            <ResponsiveTable>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Member</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Role</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Credits Used</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Audit Actions</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Budget Left</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m) => {
                  const stat = getStat(m.id);
                  const remaining = stat?.remainingCredits;
                  const budgetLeft = remaining
                    ? remaining.aiCredits + remaining.imageCredits + remaining.auditCredits
                    : 0;
                  return (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{m.invitedName}</p>
                          <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`${roleBadgeClass(m.roleId, accountRoles)} hover:bg-inherit text-xs`}>
                          {accountRoleLabel(m.roleId, m.role, accountRoles)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{stat?.creditsUsed ?? 0}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{stat?.auditCount ?? 0}</td>
                      <td className="px-4 py-3 text-right text-sm text-purple-700 font-semibold">{budgetLeft}</td>
                      <td className="px-5 py-3 text-right text-xs text-slate-400">
                        {stat?.lastActivityAt ? formatDistanceToNow(new Date(stat.lastActivityAt), { addSuffix: true }) : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
