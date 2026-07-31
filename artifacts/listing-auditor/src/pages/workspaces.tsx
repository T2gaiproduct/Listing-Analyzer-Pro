import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Building2, ChevronRight, LayoutGrid, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";
import { setActiveWorkspaceId as setHeaderWorkspaceId } from "@/lib/workspace-header";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "la_active_workspace_id";

interface WorkspaceMemberListItem {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  roleName: string | null;
  legacyRole: string | null;
}

interface WorkspaceOverview {
  totalWorkspaces: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  totalRoles: number;
  ownerCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
  availableToFundWorkspaces?: { aiCredits: number; imageCredits: number; auditCredits: number };
  workspaces: Array<{
    id: number;
    name: string;
    description: string | null;
    clientLabel: string | null;
    isDefault: boolean;
    memberCount: number;
    activeMemberCount: number;
    pendingMemberCount: number;
    members: WorkspaceMemberListItem[];
    poolCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
    poolAvailableForMembers?: { aiCredits: number; imageCredits: number; auditCredits: number };
  }>;
}

export default function WorkspacesPage() {
  const { workspaces, activeWorkspaceId, isAccountOwner, can, refetch, setActiveWorkspaceId } = useWorkspace();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<typeof workspaces[0] | null>(null);
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });
  const [fundingWorkspace, setFundingWorkspace] = useState<WorkspaceOverview["workspaces"][0] | null>(null);
  const [poolForm, setPoolForm] = useState({ aiCredits: "0", imageCredits: "0", auditCredits: "0" });

  const canCreate = isAccountOwner || can("workspaces", "create");
  const canEdit = isAccountOwner || can("workspaces", "edit");
  const canDelete = isAccountOwner;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["workspaces-overview"],
    queryFn: () => fetchJson<WorkspaceOverview>(`${basePath}/api/workspaces/overview`),
    enabled: isAccountOwner,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", clientLabel: "" });
    setOpen(true);
  };

  const openEdit = (ws: typeof workspaces[0]) => {
    setEditing(ws);
    setForm({
      name: ws.name,
      description: ws.description ?? "",
      clientLabel: ws.clientLabel ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        clientLabel: form.clientLabel.trim() || undefined,
      };
      if (editing) {
        return fetchJson(`${basePath}/api/workspaces/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return fetchJson(`${basePath}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      refetch();
      setOpen(false);
      toast({ title: editing ? "Workspace updated" : "Workspace created" });
    },
    onError: (err: Error) => toast({ title: "Failed to save workspace", description: err.message, variant: "destructive" }),
  });

  const deleteWorkspace = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/workspaces/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: async (_data, deletedId) => {
      const remaining = workspaces.filter((w) => w.id !== deletedId);
      if (activeWorkspaceId === deletedId) {
        const next = remaining.find((w) => w.isDefault) ?? remaining[0];
        if (next) {
          setActiveWorkspaceId(next.id);
        } else {
          setHeaderWorkspaceId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      qc.setQueryData<WorkspaceOverview>(["workspaces-overview"], (old) => {
        if (!old) return old;
        const nextWorkspaces = old.workspaces.filter((w) => w.id !== deletedId);
        return {
          ...old,
          totalWorkspaces: nextWorkspaces.length,
          workspaces: nextWorkspaces,
        };
      });
      qc.setQueryData<{ workspaces: typeof workspaces }>(["workspaces"], (old) => {
        if (!old) return old;
        return { workspaces: old.workspaces.filter((w) => w.id !== deletedId) };
      });

      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      await qc.invalidateQueries({ queryKey: ["archive"] });
      refetch();
      toast({
        title: "Workspace deleted",
        description: "It was moved to Archive → Workspaces. You can restore it from there.",
        action: (
          <Button variant="outline" size="sm" onClick={() => navigate("/archive?tab=workspaces")}>
            View Archive
          </Button>
        ),
      });
    },
    onError: () => toast({ title: "Failed to delete workspace", variant: "destructive" }),
  });

  const fundPool = useMutation({
    mutationFn: async () => {
      if (!fundingWorkspace) throw new Error("No workspace selected");
      return fetchJson(`${basePath}/api/workspaces/${fundingWorkspace.id}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiCredits: Math.max(0, parseInt(poolForm.aiCredits) || 0),
          imageCredits: Math.max(0, parseInt(poolForm.imageCredits) || 0),
          auditCredits: Math.max(0, parseInt(poolForm.auditCredits) || 0),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      qc.invalidateQueries({ queryKey: ["user-credits"] });
      setFundingWorkspace(null);
      toast({ title: "Workspace credit pool updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update pool", description: err.message, variant: "destructive" }),
  });

  const openFundPool = (ws: WorkspaceOverview["workspaces"][0]) => {
    setFundingWorkspace(ws);
    setPoolForm({
      aiCredits: String(ws.poolCredits?.aiCredits ?? 0),
      imageCredits: String(ws.poolCredits?.imageCredits ?? 0),
      auditCredits: String(ws.poolCredits?.auditCredits ?? 0),
    });
  };

  const displayWorkspaces: WorkspaceOverview["workspaces"] = isAccountOwner && overview
    ? overview.workspaces.map((ws) => ({
        ...ws,
        members: ws.members ?? [],
      }))
    : workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        description: ws.description,
        clientLabel: ws.clientLabel,
        isDefault: ws.isDefault,
        memberCount: 0,
        activeMemberCount: 0,
        pendingMemberCount: 0,
        members: [] as WorkspaceMemberListItem[],
      }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-900">All workspaces</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isAccountOwner
              ? "Admin overview of all your client workspaces. Select one to view details."
              : "Manage client workspaces and members."}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New workspace
          </Button>
        )}
      </div>

      {isAccountOwner && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total workspaces</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {overviewLoading ? "—" : overview?.totalWorkspaces ?? workspaces.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total members</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {overviewLoading ? "—" : overview?.totalMembers ?? 0}
              </p>
              {!overviewLoading && overview && (
                <p className="text-xs text-slate-500 mt-1">{overview.activeMembers} active</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending invites</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {overviewLoading ? "—" : overview?.pendingInvites ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total roles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {overviewLoading ? "—" : overview?.totalRoles ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isAccountOwner && overview?.availableToFundWorkspaces && (
        <p className="text-xs text-slate-500">
          Account credits available to fund workspace pools:{" "}
          <span className="font-medium text-slate-700">
            {overview.availableToFundWorkspaces.auditCredits} audit · {overview.availableToFundWorkspaces.aiCredits} text · {overview.availableToFundWorkspaces.imageCredits} images
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {displayWorkspaces.map((ws) => (
          <Card key={ws.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <CardTitle className="text-lg truncate">{ws.name}</CardTitle>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ws.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
              </div>
              {ws.clientLabel && (
                <p className="text-xs text-slate-500">Client: {ws.clientLabel}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {ws.description && <p className="text-sm text-slate-600 line-clamp-2">{ws.description}</p>}
              {isAccountOwner && (
                <div className="text-xs text-slate-500 flex flex-wrap gap-2 items-center">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    Pool: {ws.poolCredits?.auditCredits ?? 0} audit · {ws.poolCredits?.aiCredits ?? 0} text · {ws.poolCredits?.imageCredits ?? 0} images
                  </span>
                  {ws.poolAvailableForMembers && (
                    <span className="text-slate-400">
                      ({ws.poolAvailableForMembers.auditCredits} audit unassigned to members)
                    </span>
                  )}
                  <Button variant="link" size="sm" className="h-auto p-0 text-orange-600" onClick={() => openFundPool(ws as WorkspaceOverview["workspaces"][0])}>
                    Fund pool
                  </Button>
                </div>
              )}
              {isAccountOwner && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{ws.memberCount} members</span>
                    {ws.pendingMemberCount > 0 && (
                      <span className="text-amber-700">{ws.pendingMemberCount} pending</span>
                    )}
                  </div>
                  {ws.members.length > 0 && (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden text-xs">
                      {ws.members.slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="truncate text-slate-700">{m.invitedName || m.invitedEmail}</span>
                          <Badge variant="outline" className="text-[10px] capitalize shrink-0">{m.status}</Badge>
                        </div>
                      ))}
                      {ws.members.length > 5 && (
                        <p className="px-3 py-2 text-slate-400">+{ws.members.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!isAccountOwner && (
                <p className="text-xs text-slate-400">Your role: {workspaces.find((w) => w.id === ws.id)?.roleName ?? "Unassigned"}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/workspaces/${ws.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5" />
                    {isAccountOwner ? "View workspace" : "Open"}
                  </Button>
                </Link>
                <Link href={`/workspaces/${ws.id}/members`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Members
                  </Button>
                </Link>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(workspaces.find((w) => w.id === ws.id)!)} className="gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 gap-1.5"
                    onClick={() => {
                      const message = ws.isDefault
                        ? `Delete default workspace "${ws.name}"? It will be removed from this dashboard and moved to Archive → Workspaces. Another workspace will become the new default.`
                        : `Delete workspace "${ws.name}"? It will be removed from this dashboard and moved to Archive → Workspaces.`;
                      if (confirm(message)) deleteWorkspace.mutate(ws.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workspace" : "Create workspace"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ws-client">Client label (optional)</Label>
              <Input id="ws-client" placeholder="e.g. Acme Corp" value={form.clientLabel} onChange={(e) => setForm((f) => ({ ...f, clientLabel: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ws-desc">Description</Label>
              <Input id="ws-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fundingWorkspace != null} onOpenChange={(v) => !v && setFundingWorkspace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund workspace pool — {fundingWorkspace?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Move credits from your account balance into this workspace pool. Workspace admins assign from the pool to members.
          </p>
          {overview?.availableToFundWorkspaces && (
            <p className="text-xs text-slate-500">
              Available in account: {overview.availableToFundWorkspaces.auditCredits} audit · {overview.availableToFundWorkspaces.aiCredits} text · {overview.availableToFundWorkspaces.imageCredits} images
            </p>
          )}
          <div className="grid grid-cols-3 gap-3 py-2">
            <div>
              <Label className="text-xs">Audit</Label>
              <Input type="number" min={0} value={poolForm.auditCredits} onChange={(e) => setPoolForm((f) => ({ ...f, auditCredits: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Text (AI)</Label>
              <Input type="number" min={0} value={poolForm.aiCredits} onChange={(e) => setPoolForm((f) => ({ ...f, aiCredits: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Images</Label>
              <Input type="number" min={0} value={poolForm.imageCredits} onChange={(e) => setPoolForm((f) => ({ ...f, imageCredits: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundingWorkspace(null)}>Cancel</Button>
            <Button onClick={() => fundPool.mutate()} disabled={fundPool.isPending}>
              {fundPool.isPending ? "Saving…" : "Update pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
