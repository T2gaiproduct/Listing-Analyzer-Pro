import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Briefcase, Building2, Mail, Clock, ChevronDown, ChevronRight,
  BarChart3, AlertTriangle, CheckCircle2, XCircle, Layers,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ResponsiveTable } from "@/components/responsive-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TeamMember {
  id: number;
  ownerUserId: string;
  memberUserId: string | null;
  invitedEmail: string;
  invitedName: string;
  role: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  allocatedCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

interface WorkspaceMember {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  userId: string | null;
  roleId: number | null;
  roleName: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

interface ClientWorkspace {
  id: number;
  name: string;
  clientLabel: string | null;
  isDefault: boolean;
  memberCount: number;
  activeMemberCount: number;
  pendingMemberCount: number;
  members: WorkspaceMember[];
}

interface AgencyTeam {
  ownerUserId: string;
  companyName: string | null;
  ownerEmail: string | null;
  ownerAuditCount: number;
  workspaceCount: number;
  workspaceMemberCount: number;
  workspaceActiveCount: number;
  workspacePendingCount: number;
  workspaces: ClientWorkspace[];
  totalMembers: number;
  activeCount: number;
  pendingCount: number;
  revokedCount: number;
  members: TeamMember[];
}

interface TeamActivityData {
  totalAgencies: number;
  totalWorkspaces: number;
  totalWorkspaceMembers: number;
  workspaceActiveMembers: number;
  workspacePendingInvites: number;
  totalTeams: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  teams: AgencyTeam[];
}

const roleColors: Record<string, string> = {
  admin: "bg-orange-100 text-orange-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

const statusIcons: Record<string, React.ReactNode> = {
  active: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  pending: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  revoked: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

function fetchTeamActivity(): Promise<TeamActivityData> {
  return fetch(`${basePath}/api/admin/team-activity`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminTeamActivity() {
  const { data, isLoading } = useQuery<TeamActivityData>({
    queryKey: ["admin-team-activity"],
    queryFn: fetchTeamActivity,
  });

  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);
  const [expandedWorkspace, setExpandedWorkspace] = useState<number | null>(null);

  const toggleAgency = (ownerId: string) => {
    setExpandedAgency((prev) => {
      if (prev === ownerId) {
        setExpandedWorkspace(null);
        return null;
      }
      setExpandedWorkspace(null);
      return ownerId;
    });
  };

  const toggleWorkspace = (workspaceId: number) => {
    setExpandedWorkspace((prev) => (prev === workspaceId ? null : workspaceId));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const agencies = data?.teams ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Activity</h1>
        <p className="text-slate-500 text-sm mt-1">
          {data
            ? `${data.totalAgencies} agencies, ${data.totalWorkspaces} client workspaces, ${data.workspaceActiveMembers} active workspace members`
            : "Loading..."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Agencies</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalAgencies ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Account owners</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Client Workspaces</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalWorkspaces ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Across all agencies</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Layers className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Workspace Members</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalWorkspaceMembers ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">{data?.workspaceActiveMembers ?? 0} active</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <Users className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Account Team</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalMembers ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Legacy account-level invites</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-sm text-slate-900">Agencies &amp; Client Workspaces</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Expand an agency to see each client workspace and its members
          </p>
        </div>
        {agencies.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">No agency activity yet</p>
            <p className="text-slate-400 text-xs mt-1">Agencies appear when account owners create workspaces or invite team members</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {agencies.map((agency) => {
              const isExpanded = expandedAgency === agency.ownerUserId;
              return (
                <div key={agency.ownerUserId}>
                  <button
                    type="button"
                    onClick={() => toggleAgency(agency.ownerUserId)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {agency.companyName ?? "Unnamed Agency"}
                        </p>
                        <span className="text-xs text-slate-400 font-mono">{agency.ownerUserId.slice(0, 8)}…</span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">{agency.ownerEmail ?? "No email on file"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />{agency.ownerAuditCount} audits
                      </span>
                      <Badge variant="outline" className="text-xs">{agency.workspaceCount} workspaces</Badge>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                        {agency.workspaceActiveCount} active
                      </Badge>
                      {agency.workspacePendingCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                          {agency.workspacePendingCount} pending
                        </Badge>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-50/80 border-t border-slate-100 px-5 py-4 space-y-5">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                          Client workspaces ({agency.workspaces.length})
                        </h4>
                        {agency.workspaces.length === 0 ? (
                          <p className="text-sm text-slate-500 py-2">No client workspaces created yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {agency.workspaces.map((workspace) => {
                              const wsExpanded = expandedWorkspace === workspace.id;
                              return (
                                <div key={workspace.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleWorkspace(workspace.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                                  >
                                    {wsExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-900 text-sm">{workspace.name}</p>
                                      {workspace.clientLabel && (
                                        <p className="text-xs text-slate-500">{workspace.clientLabel}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {workspace.isDefault && (
                                        <Badge variant="outline" className="text-xs">Default</Badge>
                                      )}
                                      <Badge variant="outline" className="text-xs">{workspace.memberCount} members</Badge>
                                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                        {workspace.activeMemberCount} active
                                      </Badge>
                                      {workspace.pendingMemberCount > 0 && (
                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                                          {workspace.pendingMemberCount} pending
                                        </Badge>
                                      )}
                                    </div>
                                  </button>
                                  {wsExpanded && workspace.members.length > 0 && (
                                    <div className="border-t border-slate-100">
                                      <ResponsiveTable minWidth="40rem">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Member</th>
                                              <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Role</th>
                                              <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                                              <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase">Joined</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {workspace.members.map((m) => (
                                              <tr key={m.id} className="border-b border-slate-50 last:border-0">
                                                <td className="px-4 py-2.5">
                                                  <p className="font-medium text-slate-800 text-sm">{m.invitedName || "—"}</p>
                                                  <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                                                </td>
                                                <td className="px-3 py-2.5 text-sm text-slate-600">
                                                  {m.roleName ?? "—"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                  <div className="flex items-center gap-1.5">
                                                    {statusIcons[m.status] ?? <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
                                                    <span className="text-xs capitalize text-slate-600">{m.status}</span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                                                  {m.acceptedAt
                                                    ? format(new Date(m.acceptedAt), "MMM d, yyyy")
                                                    : m.status === "pending"
                                                      ? `Invited ${formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}`
                                                      : "—"}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </ResponsiveTable>
                                    </div>
                                  )}
                                  {wsExpanded && workspace.members.length === 0 && (
                                    <p className="px-4 py-3 text-sm text-slate-500 border-t border-slate-100">No members in this workspace.</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Account-level team (legacy)
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">
                          Original account invites and credit allocations — preserved for existing admin workflows.
                        </p>
                        {agency.members.length === 0 ? (
                          <p className="text-sm text-slate-500">No account-level team members.</p>
                        ) : (
                          <ResponsiveTable minWidth="48rem">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Member</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Role</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">AI</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Image</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Audit</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Joined</th>
                                </tr>
                              </thead>
                              <tbody>
                                {agency.members.map((m) => (
                                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2.5">
                                      <p className="font-medium text-slate-800 text-sm">{m.invitedName}</p>
                                      <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit text-xs`}>
                                        {m.role}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        {statusIcons[m.status] ?? <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
                                        <span className="text-xs capitalize text-slate-600">{m.status}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-purple-700">
                                      {m.allocatedCredits?.aiCredits ?? 0}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-blue-700">
                                      {m.allocatedCredits?.imageCredits ?? 0}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-orange-700">
                                      {m.allocatedCredits?.auditCredits ?? 0}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-xs text-slate-400">
                                      {m.acceptedAt
                                        ? format(new Date(m.acceptedAt), "MMM d, yyyy")
                                        : m.status === "pending"
                                          ? `Invited ${formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}`
                                          : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </ResponsiveTable>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
