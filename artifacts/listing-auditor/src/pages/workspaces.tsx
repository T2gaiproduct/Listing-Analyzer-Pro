import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Shield, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
      refetch();
      toast({ title: "Workspace deleted" });
    },
    onError: () => toast({ title: "Failed to delete workspace", variant: "destructive" }),
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspaces</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create roles per workspace, then assign them to members.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New workspace
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {workspaces.map((ws) => (
          <Card key={ws.id} className={ws.id === activeWorkspaceId ? "ring-2 ring-orange-300" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <CardTitle className="text-lg truncate">{ws.name}</CardTitle>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ws.isDefault && <Badge variant="secondary">Default</Badge>}
                  {ws.id === activeWorkspaceId && <Badge className="bg-orange-100 text-orange-700">Active</Badge>}
                </div>
              </div>
              {ws.clientLabel && (
                <p className="text-xs text-slate-500">Client: {ws.clientLabel}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {ws.description && <p className="text-sm text-slate-600">{ws.description}</p>}
              <p className="text-xs text-slate-400">Your role: {ws.roleName ?? "Member"}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(canEdit || isAccountOwner) && (
                  <Link href={`/workspaces/${ws.id}/roles`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Roles
                    </Button>
                  </Link>
                )}
                <Link href={`/workspaces/${ws.id}/members`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Members
                  </Button>
                </Link>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(ws)} className="gap-1.5">
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
