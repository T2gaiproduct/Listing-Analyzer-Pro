import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Building2, ChevronRight, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkspaceOverview {
  totalWorkspaces: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  totalRoles: number;
  workspaces: Array<{
    id: number;
    name: string;
    description: string | null;
    clientLabel: string | null;
    isDefault: boolean;
    memberCount: number;
    activeMemberCount: number;
    pendingMemberCount: number;
  }>;
}

export default function WorkspacesPage() {
  const { workspaces, activeWorkspaceId, isAccountOwner, can, refetch } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<typeof workspaces[0] | null>(null);
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });

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

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/workspaces/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      refetch();
      toast({ title: "Workspace deleted" });
    },
    onError: () => toast({ title: "Failed to delete workspace", variant: "destructive" }),
  });

  const displayWorkspaces = isAccountOwner && overview
    ? overview.workspaces
    : workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        description: ws.description,
        clientLabel: ws.clientLabel,
        isDefault: ws.isDefault,
        memberCount: 0,
        activeMemberCount: 0,
        pendingMemberCount: 0,
      }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-900">Workspace Dashboard</h1>
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
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{ws.memberCount} members</span>
                  {ws.pendingMemberCount > 0 && (
                    <span className="text-amber-700">{ws.pendingMemberCount} pending</span>
                  )}
                </div>
              )}
              {!isAccountOwner && (
                <p className="text-xs text-slate-400">Your role: {workspaces.find((w) => w.id === ws.id)?.roleName ?? "Member"}</p>
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
                {canDelete && !ws.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 gap-1.5"
                    onClick={() => {
                      if (confirm(`Delete workspace "${ws.name}"?`)) remove.mutate(ws.id);
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
    </div>
  );
}
