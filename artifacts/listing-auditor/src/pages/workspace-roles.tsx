import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  WORKSPACE_FEATURE_META,
  WORKSPACE_ACTIONS,
  type WorkspaceFeature,
  type WorkspaceAction,
  type FeaturePermission,
} from "@workspace/workspace-permissions";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkspaceRole {
  id: number;
  name: string;
  description: string | null;
  permissions: Record<string, Partial<FeaturePermission>>;
  isSystem: boolean;
}

const ACTION_LABELS: Record<WorkspaceAction, string> = {
  viewGlobal: "View Global",
  viewOwn: "View Own",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export default function WorkspaceRolesPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { workspaces, can, isAccountOwner } = useWorkspace();
  const ws = workspaces.find((w) => w.id === workspaceId);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrix, setMatrix] = useState<Record<string, Partial<FeaturePermission>>>({});

  const canManage = isAccountOwner || can("team", "edit");

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    queryFn: () => fetchJson<{ roles: WorkspaceRole[] }>(`${basePath}/api/workspaces/${workspaceId}/roles`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const roles = data?.roles ?? [];

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, typeof WORKSPACE_FEATURE_META> = {};
    for (const meta of WORKSPACE_FEATURE_META) {
      if (!groups[meta.group]) groups[meta.group] = [];
      groups[meta.group]!.push(meta);
    }
    return groups;
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setMatrix({});
    setDialogOpen(true);
  };

  const openEdit = (role: WorkspaceRole) => {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setMatrix(role.permissions ?? {});
    setDialogOpen(true);
  };

  const toggle = (feature: WorkspaceFeature, action: WorkspaceAction) => {
    setMatrix((m) => {
      const row = { ...(m[feature] ?? {}) };
      row[action] = !row[action];
      return { ...m, [feature]: row };
    });
  };

  const saveRole = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), description: description.trim() || undefined, permissions: matrix };
      if (editing) {
        return fetchJson(`${basePath}/api/workspaces/${workspaceId}/roles/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return fetchJson(`${basePath}/api/workspaces/${workspaceId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      setDialogOpen(false);
      toast({ title: editing ? "Role updated" : "Role created" });
    },
    onError: () => toast({ title: "Failed to save role", variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: number) =>
      fetch(`${basePath}/api/workspaces/${workspaceId}/roles/${roleId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      toast({ title: "Role deleted" });
    },
  });

  if (!ws) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Workspace not found or you do not have access.</p>
        <Link href="/workspaces"><Button variant="link" className="px-0">Back to workspaces</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Workspaces
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ws.name} — Roles</h1>
          <p className="text-sm text-slate-500">Configure horizontal permissions per feature.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="ml-auto gap-2">
            <Plus className="w-4 h-4" />
            New role
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles ({roles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading roles…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.isSystem ? "System" : "Custom"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(role)} className="gap-1">
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => deleteRole.mutate(role.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit role: ${editing.name}` : "Create role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Role name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={editing?.isSystem} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {Object.entries(groupedFeatures).map(([group, features]) => (
              <div key={group} className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 font-semibold text-sm text-slate-700">{group}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Feature</TableHead>
                      {WORKSPACE_ACTIONS.map((action) => (
                        <TableHead key={action} className="text-center text-xs">{ACTION_LABELS[action]}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((meta) => (
                      <TableRow key={meta.id}>
                        <TableCell className="text-sm font-medium">{meta.label}</TableCell>
                        {WORKSPACE_ACTIONS.map((action) => {
                          const enabled = meta.actions.includes(action);
                          return (
                            <TableCell key={action} className="text-center">
                              {enabled ? (
                                <Checkbox
                                  checked={Boolean(matrix[meta.id]?.[action])}
                                  onCheckedChange={() => toggle(meta.id, action)}
                                  disabled={editing?.isSystem}
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRole.mutate()} disabled={!name.trim() || saveRole.isPending || editing?.isSystem}>
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
