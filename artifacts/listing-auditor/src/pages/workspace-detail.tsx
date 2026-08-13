import { useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, Shield, Users, UserPlus, ChevronRight } from "lucide-react";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";
import { accountRoleLabel } from "@/lib/role-display";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MemberRow {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  roleId?: number | null;
  roleName?: string | null;
}

interface WorkspaceRecord {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  createdAt?: string;
  roleName?: string;
}

export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();

  useEffect(() => {
    if (
      Number.isFinite(workspaceId)
      && workspaceId > 0
      && activeWorkspaceId !== workspaceId
    ) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspaceId]);

  const ws = workspaces.find((w) => w.id === workspaceId);

  const { data: workspaceData, isLoading: wsLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchJson<WorkspaceRecord>(`${basePath}/api/workspaces/${workspaceId}`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => fetchJson<{ members: MemberRow[] }>(`${basePath}/api/workspaces/${workspaceId}/members`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    queryFn: () => fetchJson<{ roles: Array<{ id: number; name: string }> }>(`${basePath}/api/workspaces/${workspaceId}/roles`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const members = membersData?.members ?? [];
  const roles = rolesData?.roles ?? [];
  const isLoading = wsLoading || membersLoading || rolesLoading;

  const stats = useMemo(() => {
    const activeMemberCount = members.filter((m) => m.status === "active").length;
    const pendingMemberCount = members.filter((m) => m.status === "pending").length;
    return {
      memberCount: members.length,
      activeMemberCount,
      pendingMemberCount,
      roleCount: roles.length,
    };
  }, [members, roles]);

  const displayName = workspaceData?.name ?? ws?.name ?? "Workspace";
  const displayClient = workspaceData?.clientLabel ?? ws?.clientLabel;
  const displayDescription = workspaceData?.description ?? ws?.description;
  const displayRole = workspaceData?.roleName ?? ws?.roleName ?? "Unassigned";
  const isDefault = workspaceData?.isDefault ?? ws?.isDefault;
  const isActive = workspaceId === activeWorkspaceId;

  if (!ws && !isLoading) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Workspace not found.</p>
        <Link href="/workspaces"><Button variant="link" className="px-0">{WORKSPACES_HUB_LABEL}</Button></Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            {WORKSPACES_HUB_LABEL}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{displayName}</h1>
              {isDefault && <Badge variant="secondary">Default</Badge>}
              {isActive && <Badge className="bg-orange-100 text-orange-700">Active</Badge>}
            </div>
            {displayClient && (
              <p className="text-sm text-slate-500 mt-1">Client: {displayClient}</p>
            )}
            {displayDescription && (
              <p className="text-sm text-slate-600 mt-2">{displayDescription}</p>
            )}
            <p className="text-xs text-slate-400 mt-2">Your role: {displayRole}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/workspaces/${workspaceId}/members`}>
            <Button className="gap-1.5 bg-orange-500 hover:bg-orange-600">
              <UserPlus className="w-4 h-4" />
              Invite member
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading workspace…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{stats.memberCount}</p>
                <p className="text-xs text-slate-500 mt-1">{stats.activeMemberCount} active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Pending invites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{stats.pendingMemberCount}</p>
                <p className="text-xs text-slate-500 mt-1">Awaiting acceptance</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{stats.roleCount}</p>
                <p className="text-xs text-slate-500 mt-1">Custom roles defined</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Workspace ID</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">#{workspaceId}</p>
                <p className="text-xs text-slate-500 mt-1">Internal reference</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({members.length})
              </CardTitle>
              <Link href={`/workspaces/${workspaceId}/members`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-orange-600 hover:text-orange-700">
                  View all
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 mb-3">No members yet. Invite someone to collaborate in this workspace.</p>
                  <Link href={`/workspaces/${workspaceId}/members`}>
                    <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600">
                      <UserPlus className="w-4 h-4" />
                      Invite first member
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.slice(0, 8).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.invitedName}</TableCell>
                        <TableCell>{m.invitedEmail}</TableCell>
                        <TableCell>{accountRoleLabel(m.roleId, m.roleName, roles)}</TableCell>
                        <TableCell className="capitalize">{m.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {members.length > 8 && (
                <div className="pt-3 text-center">
                  <Link href={`/workspaces/${workspaceId}/members`}>
                    <Button variant="link" className="text-orange-600">
                      View all {members.length} members
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {roles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Roles ({roles.length})
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Account-wide roles assigned to members in this workspace. Manage roles from your profile menu.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Badge key={role.id} variant="outline" className="text-sm py-1 px-2.5">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
