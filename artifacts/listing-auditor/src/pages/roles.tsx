import { useEffect, useMemo, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  WORKSPACE_FEATURE_META,
  WORKSPACE_FEATURE_GROUP_ORDER,
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
}

const ACTION_LABELS: Record<WorkspaceAction, string> = {
  viewGlobal: "View Global",
  viewOwn: "View Own",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export default function RolesPage() {
  const { workspaces, activeWorkspaceId, isAccountOwner, isLoading: wsLoading } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [workspaceId, setWorkspaceId] = useState<number | null>(activeWorkspaceId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrix, setMatrix] = useState<Record<string, Partial<FeaturePermission>>>({});

  useEffect(() => {
    if (activeWorkspaceId && !workspaceId) {
      setWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, workspaceId]);

  const ws = workspaces.find((w) => w.id === workspaceId) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    queryFn: () => fetchJson<{ roles: WorkspaceRole[] }>(`${basePath}/api/workspaces/${workspaceId}/roles`),
    enabled: Number.isFinite(workspaceId) && (workspaceId ?? 0) > 0,
  });

  const roles = data?.roles ?? [];

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, typeof WORKSPACE_FEATURE_META> = {};
    for (const meta of WORKSPACE_FEATURE_META) {
      if (!groups[meta.group]) groups[meta.group] = [];
      groups[meta.group]!.push(meta);
    }
    return WORKSPACE_FEATURE_GROUP_ORDER
      .filter((group) => groups[group]?.length)
      .map((group) => [group, groups[group]!] as const);
  }, []);

  const groupDescriptions: Record<string, string> = {
    Features: "Main product modules — same as the left sidebar",
    Overview: "Dashboard access",
    Projects: "Project history and archive",
    Workspace: "Team and workspace management",
    Account: "User account settings",
    Advanced: "Integrations and extra tools",
  };

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

  const setPermission = (feature: WorkspaceFeature, action: WorkspaceAction, value: boolean) => {
    setMatrix((m) => ({
      ...m,
      [feature]: { ...(m[feature] ?? {}), [action]: value },
    }));
  };

  const saveRole = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Select a workspace");
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
    onError: (err: Error) => toast({ title: "Failed to save role", description: err.message, variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: async (roleId: number) => {
      if (!workspaceId) throw new Error("Select a workspace");
      const r = await fetch(`${basePath}/api/workspaces/${workspaceId}/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete role");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete role", description: err.message, variant: "destructive" });
    },
  });

  if (wsLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  if (!isAccountOwner) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create and edit workspace roles. Assign roles to members from each workspace&apos;s Members page.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 flex-shrink-0" disabled={!workspaceId}>
          <Plus className="w-4 h-4" />
          Add role
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label htmlFor="roles-workspace">Select workspace</Label>
            <Select
              value={workspaceId ? String(workspaceId) : ""}
              onValueChange={(value) => setWorkspaceId(Number(value))}
            >
              <SelectTrigger id="roles-workspace" className="mt-1.5">
                <SelectValue placeholder="Choose workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!ws ? (
        <p className="text-sm text-slate-500">Select a workspace to manage its roles.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ws.name} — Roles ({roles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading roles…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm text-slate-500 py-6 text-center">
                        No roles yet. Click <strong>Add role</strong> to create one, then assign it from{" "}
                        <Link href={`/workspaces/${workspaceId}/members`} className="text-orange-600 hover:underline">
                          Members
                        </Link>.
                      </TableCell>
                    </TableRow>
                  ) : roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(role)} className="gap-1">
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={deleteRole.isPending}
                          onClick={() => {
                            if (!confirm(`Delete role "${role.name}"? Members assigned to this role will need a new role.`)) return;
                            deleteRole.mutate(role.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editing ? `Edit role: ${editing.name}` : "Create role"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Role name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {groupedFeatures.map(([group, features]) => (
              <div key={group} className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2">
                  <div className="font-semibold text-sm text-slate-700">{group}</div>
                  {groupDescriptions[group] && (
                    <p className="text-xs text-slate-500 mt-0.5">{groupDescriptions[group]}</p>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-56">Feature</th>
                      {WORKSPACE_ACTIONS.map((action) => (
                        <th key={action} className="h-10 px-2 text-center align-middle font-medium text-muted-foreground text-xs">
                          {ACTION_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((meta) => (
                      <tr key={meta.id} className="border-b last:border-0">
                        <td className="p-2 align-middle text-sm font-medium">
                          <span>{meta.label}</span>
                          {meta.comingSoon && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                              Coming Soon
                            </span>
                          )}
                        </td>
                        {WORKSPACE_ACTIONS.map((action) => {
                          const enabled = meta.actions.includes(action);
                          const checked = Boolean(matrix[meta.id]?.[action]);
                          return (
                            <td key={action} className="p-2 align-middle text-center">
                              {enabled ? (
                                <label className={cn(
                                  "inline-flex items-center justify-center min-h-9 min-w-9 rounded-md",
                                  meta.comingSoon ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50",
                                )}>
                                  <Checkbox
                                    className="h-5 w-5"
                                    checked={checked}
                                    disabled={meta.comingSoon}
                                    onCheckedChange={(value) => setPermission(meta.id, action, value === true)}
                                  />
                                </label>
                              ) : (
                                <span className="text-slate-300 select-none" title="Not applicable">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRole.mutate()} disabled={!name.trim() || saveRole.isPending}>
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
