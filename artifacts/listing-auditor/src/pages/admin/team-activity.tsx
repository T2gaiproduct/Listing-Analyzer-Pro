import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Shield, Mail, Clock, ChevronDown, ChevronRight,
  Zap, BarChart3, AlertTriangle, CheckCircle2, XCircle,
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

interface Team {
  ownerUserId: string;
  companyName: string | null;
  ownerEmail: string | null;
  ownerAuditCount: number;
  totalMembers: number;
  activeCount: number;
  pendingCount: number;
  revokedCount: number;
  members: TeamMember[];
}

interface TeamActivityData {
  totalTeams: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  teams: Team[];
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

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const toggleTeam = (ownerId: string) => {
    setExpandedTeam((prev) => (prev === ownerId ? null : ownerId));
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

  const teams = data?.teams ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Activity</h1>
        <p className="text-slate-500 text-sm mt-1">
          {data ? `${data.totalTeams} workspace${data.totalTeams !== 1 ? "s" : ""}, ${data.activeMembers} active members, ${data.pendingInvites} pending invites` : "Loading..."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Workspaces</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalTeams ?? 0}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Total Members</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalMembers ?? 0}</p>
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
                <p className="text-xs text-slate-500 uppercase font-medium">Active Members</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.activeMembers ?? 0}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Pending Invites</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data?.pendingInvites ?? 0}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teams list */}
      <Card className="border-0 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-sm text-slate-900">All Workspaces</h3>
          <p className="text-xs text-slate-400 mt-0.5">Click a workspace to view members and credits</p>
        </div>
        {teams.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">No team activity yet</p>
            <p className="text-slate-400 text-xs mt-1">Teams will appear here once users invite members</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {teams.map((team) => {
              const isExpanded = expandedTeam === team.ownerUserId;
              return (
                <div key={team.ownerUserId}>
                  <button
                    onClick={() => toggleTeam(team.ownerUserId)}
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
                          {team.companyName ?? "Unnamed Workspace"}
                        </p>
                        <span className="text-xs text-slate-400 font-mono">{team.ownerUserId.slice(0, 8)}...</span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">{team.ownerEmail ?? "No email on file"}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />{team.ownerAuditCount} audits
                      </span>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">{team.activeCount} active</Badge>
                      {team.pendingCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">{team.pendingCount} pending</Badge>
                      )}
                      {team.revokedCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">{team.revokedCount} revoked</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{team.totalMembers} members</Badge>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-50/50 border-t border-slate-100">
                      <ResponsiveTable minWidth="48rem">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Member</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Role</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">AI Credits</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Image Credits</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Audit Credits</th>
                            <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.members.map((m) => (
                            <tr key={m.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                    {m.invitedName[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-800 text-sm">{m.invitedName}</p>
                                    <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit text-xs`}>
                                  {m.role}
                                </Badge>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                  {statusIcons[m.status] ?? <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
                                  <span className={`text-xs capitalize ${
                                    m.status === "active" ? "text-green-600" : m.status === "pending" ? "text-amber-600" : "text-red-500"
                                  }`}>
                                    {m.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-semibold text-purple-700">
                                {m.allocatedCredits?.aiCredits ?? 0}
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-semibold text-blue-700">
                                {m.allocatedCredits?.imageCredits ?? 0}
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-semibold text-orange-700">
                                {m.allocatedCredits?.auditCredits ?? 0}
                              </td>
                              <td className="px-5 py-3 text-right text-xs text-slate-400">
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
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
