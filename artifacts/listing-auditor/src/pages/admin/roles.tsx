import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Shield, RefreshCw } from "lucide-react";

interface AdminRole { id: number; name: string; description: string | null; permissions: string[]; createdAt: string; }

const ALL_PERMISSIONS = [
  "view_dashboard", "view_analytics",
  "manage_customers", "ban_customers", "delete_customers",
  "manage_audits", "delete_audits",
  "manage_plans", "manage_credits",
  "manage_payments", "manage_invoices", "manage_refunds", "manage_coupons",
  "view_content", "view_logs", "view_downloads",
  "manage_roles", "manage_settings", "manage_notifications",
];

function fetchRoles(): Promise<{ roles: AdminRole[] }> {
  return fetch("/api/admin/roles").then((r) => r.json());
}

export default function AdminRoles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });

  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });
  const roles = data?.roles ?? [];

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", permissions: [] }); setOpen(true); };
  const openEdit = (r: AdminRole) => { setEditing(r); setForm({ name: r.name, description: r.description ?? "", permissions: r.permissions }); setOpen(true); };

  const save = useMutation({
    mutationFn: (body: object) => {
      if (editing) {
        return fetch(`/api/admin/roles/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }
      return fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/roles/${id}`, { method: "DELETE" }).then((r) => r.ok),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-roles"] }),
  });

  const togglePerm = (p: string) => {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-bold">Admin Roles</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New Role</Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : roles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No roles defined yet.</TableCell></TableRow>
                ) : (
                  roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.permissions.slice(0, 4).map((p) => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}
                          {r.permissions.length > 4 && <Badge variant="outline" className="text-xs">+{r.permissions.length - 4}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Role" : "Create Role"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Role name (e.g. Support Staff)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div>
                <p className="text-sm font-medium mb-2">Permissions</p>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={form.permissions.includes(p)} onCheckedChange={() => togglePerm(p)} />
                      {p.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(form)} disabled={!form.name}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
