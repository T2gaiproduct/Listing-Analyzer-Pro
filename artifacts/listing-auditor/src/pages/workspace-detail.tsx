import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Shield, Users, UserPlus, Clock } from "lucide-react";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkspaceSummary {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  createdAt: string;
  roleName: string;
  isAccountOwner: boolean;
  memberCount: number;
  activeMemberCount: number;
  pendingMemberCount: number;
  roleCount: number;
}

export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, isAccountOwner } = useWorkspace();

  useEffect(() => {
    if (Number.isFinite(workspaceId) && workspaceId > 0 && workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspaceId]);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-summary", workspaceId],
    queryFn: () => fetchJson<WorkspaceSummary>(`${basePath}/api/workspaces/${workspaceId}/summary`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const ws = workspaces.find((w) => w.id === workspaceId);
  const isActive = workspaceId === activeWorkspaceId;

  if (!ws && !isLoading) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Workspace not found.</p>
        <Link href="/workspaces"><Button variant="link" className="px-0">Back to workspaces</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            All workspaces
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
              <h1 className="text-2xl font-bold text-slate-900 truncate">{data?.name ?? ws?.name ?? "Workspace"}</h1>
              {data?.isDefault && <Badge variant="secondary">Default</Badge>}
              {isActive && <Badge className="bg-orange-100 text-orange-700">Active</Badge>}
            </div>
            {data?.clientLabel && (
              <p className="text-sm text-slate-500 mt-1">Client: {data.clientLabel}</p>
            )}
            {data?.description && (
              <p className="text-sm text-slate-600 mt-2">{data.description}</p>
            )}
            <p className="text-xs text-slate-400 mt-2">Your role: {data?.roleName ?? ws?.roleName ?? "Member"}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading workspace…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{data.memberCount}</p>
                <p className="text-xs text-slate-500 mt-1">{data.activeMemberCount} active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Pending invites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{data.pendingMemberCount}</p>
                <p className="text-xs text-slate-500 mt-1">Awaiting acceptance</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{data.roleCount}</p>
                <p className="text-xs text-slate-500 mt-1">Custom roles defined</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Created</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-slate-900">
                  {new Date(data.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className="text-xs text-slate-500 mt-1">Workspace start date</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href={`/workspaces/${workspaceId}/members`}>
                <Button variant="outline" className="gap-1.5">
                  <Users className="w-4 h-4" />
                  Manage members
                </Button>
              </Link>
              {isAccountOwner && (
                <Link href="/roles">
                  <Button variant="outline" className="gap-1.5">
                    <Shield className="w-4 h-4" />
                    Manage roles
                  </Button>
                </Link>
              )}
              {data.pendingMemberCount > 0 && (
                <Link href={`/workspaces/${workspaceId}/members`}>
                  <Button variant="outline" className="gap-1.5">
                    <Clock className="w-4 h-4" />
                    Review pending invites
                  </Button>
                </Link>
              )}
              <Link href={`/workspaces/${workspaceId}/members`}>
                <Button className="gap-1.5 bg-orange-500 hover:bg-orange-600">
                  <UserPlus className="w-4 h-4" />
                  Invite member
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
