import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Shield, RefreshCw, UserPlus, ChevronDown, Users, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ADMIN_PERMISSION_META, type AdminPermissionGroup } from "@workspace/admin-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminRole { id: number; name: string; description: string | null; permissions: string[]; createdAt: string; }

interface AssignedUser {
  id: number;
  userId: string;
  roleId: number;
  createdAt: string;
  role: AdminRole | null;
  clerkUser: { email: string; name: string } | null;
}

interface PendingInvite {
  id: number;
  email: string;
  roleId: number;
  createdAt: string;
  status: "pending";
  role: AdminRole | null;
  inviteToken?: string | null;
  inviteUrl?: string | null;
}

function resolveInviteUrl(invite: Pick<PendingInvite, "inviteUrl" | "inviteToken">): string {
  if (invite.inviteUrl?.trim()) return invite.inviteUrl.trim();
  return adminInviteLink(invite.inviteToken);
}

function copyInviteLink(
  invite: Pick<PendingInvite, "inviteUrl" | "inviteToken">,
  showToast: (opts: { title: string; description?: string; variant?: "destructive" }) => void,
) {
  const url = resolveInviteUrl(invite);
  if (!url) {
    showToast({ title: "No invite link available", description: "Try refreshing the page or re-assigning the role.", variant: "destructive" });
    return;
  }
  void navigator.clipboard.writeText(url);
  showToast({ title: "Invite link copied", description: url });
}

function adminInviteLink(token: string | null | undefined): string {
  if (!token) return "";
  return `${window.location.origin}${basePath}/accept-admin-invite?token=${token}`;
}

async function readApiJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text.trim()) {
    if (!r.ok) {
      throw new Error(
        r.status === 404
          ? "This action is not available on the running API yet. Deploy the latest backend update, then try again."
          : `Server error (${r.status}). The API may be unavailable or the database needs updating.`,
      );
    }
    return {} as T;
  }
  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!r.ok) {
      throw new Error(
        data.error
          ?? (r.status === 404
            ? "This action is not available on the running API yet. Deploy the latest backend update, then try again."
            : `Server error (${r.status}). The API may be unavailable or the database needs updating.`),
      );
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.message !== "Unexpected token" && !err.message.startsWith("Unexpected token")) {
      throw err;
    }
    throw new Error(
      r.ok
        ? "Invalid server response"
        : r.status === 404
          ? "This action is not available on the running API yet. Deploy the latest backend update, then try again."
          : `Server error (${r.status}). The API may be unavailable or the database needs updating.`,
    );
  }
}

const PERMISSION_GROUPS = ADMIN_PERMISSION_META.reduce((acc, item) => {
  if (!acc[item.group]) acc[item.group] = [];
  acc[item.group].push(item);
  return acc;
}, {} as Record<AdminPermissionGroup, typeof ADMIN_PERMISSION_META>);

const GROUP_ORDER: AdminPermissionGroup[] = [
  "Overview",
  "User Management",
  "Services",
  "Billing",
  "Reports",
  "Marketing",
  "Website CMS",
  "Help & Support",
  "Settings",
];

export default function AdminRoles() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Role CRUD state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });

  // Assign role state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ email: "", roleId: "" });
  const [editAssignOpen, setEditAssignOpen] = useState(false);
  const [editingAssign, setEditingAssign] = useState<AssignedUser | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [inviteLinkDialog, setInviteLinkDialog] = useState<{ email: string; url: string } | null>(null);

  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useQuery<{ roles: AdminRole[] }>({
    queryKey: ["admin-roles"],
    queryFn: () => fetch(`${basePath}/api/admin/roles`, { credentials: "include" }).then((r) => r.json()),
  });
  const roles = rolesData?.roles ?? [];

  const { data: assignedData, isLoading: assignedLoading, refetch: refetchAssigned } = useQuery<{ users: AssignedUser[]; invites?: PendingInvite[] }>({
    queryKey: ["admin-role-assignments"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/admin-users`, { credentials: "include" });
      const data = await readApiJson<{ users: AssignedUser[]; invites?: PendingInvite[]; error?: string }>(r);
      if (!r.ok) throw new Error(data.error ?? "Failed to load assignments");
      return data;
    },
  });
  const assignedUsers = assignedData?.users ?? [];
  const pendingInvites = assignedData?.invites ?? [];
  const hasAssignments = assignedUsers.length > 0 || pendingInvites.length > 0;

  // ── Role CRUD ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", permissions: [] }); setRoleDialogOpen(true); };
  const openEdit = (r: AdminRole) => { setEditing(r); setForm({ name: r.name, description: r.description ?? "", permissions: r.permissions }); setRoleDialogOpen(true); };

  const saveRole = useMutation({
    mutationFn: (body: object) => {
      if (editing) {
        return fetch(`${basePath}/api/admin/roles/${editing.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }
      return fetch(`${basePath}/api/admin/roles`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setRoleDialogOpen(false); toast({ title: editing ? "Role updated" : "Role created" }); },
    onError: () => toast({ title: "Failed to save role", variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/roles/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.ok),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); toast({ title: "Role deleted" }); },
  });

  const togglePerm = (p: string) => {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  };

  // ── Assign role ──────────────────────────────────────────────────────────────
  const assignRole = useMutation({
    mutationFn: async (body: { email: string; roleId: number }) => {
      const r = await fetch(`${basePath}/api/admin/admin-users`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await readApiJson<{ pending?: boolean; emailSent?: boolean; emailError?: string; inviteUrl?: string; error?: string }>(r);
      if (!r.ok) throw new Error(data.error ?? "Failed to assign role");
      return data;
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-role-assignments"] });
      const assignedEmail = variables.email;
      setAssignDialogOpen(false);
      setAssignForm({ email: "", roleId: "" });
      if (data.pending) {
        if (data.inviteUrl) {
          setInviteLinkDialog({ email: assignedEmail, url: data.inviteUrl });
        }
        toast({
          title: "Invite saved",
          description: data.emailSent
            ? "Invitation email sent. Share the access link below if needed."
            : data.inviteUrl
              ? "Copy the invite link below and share it with the user."
              : data.emailError
                ? `Email not sent: ${data.emailError}`
                : "Pending invite created.",
        });
        return;
      }
      if (data.emailSent) {
        toast({ title: "Role assigned", description: "Notification email sent to the user." });
      } else {
        toast({
          title: "Role assigned",
          description: `Email not sent: ${data.emailError ?? "Configure Resend in Admin → Email Settings."}`,
        });
      }
    },
    onError: (e: Error) => toast({ title: "Failed to assign role", description: e.message, variant: "destructive" }),
  });

  const updateAssign = useMutation({
    mutationFn: ({ id, roleId }: { id: number; roleId: number }) =>
      fetch(`${basePath}/api/admin/admin-users/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) })
        .then((r) => r.json() as Promise<{ emailSent?: boolean; emailError?: string }>),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-role-assignments"] });
      setEditAssignOpen(false);
      if (data.emailSent) {
        toast({ title: "Role updated", description: "Notification email sent to the user." });
      } else {
        toast({
          title: "Role updated",
          description: `Email not sent: ${data.emailError ?? "Configure Resend in Admin → Email Settings."}`,
        });
      }
    },
  });

  const removeAssign = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/admin-users/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.ok),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-role-assignments"] }); toast({ title: "Assignment removed" }); },
  });

  const removeInvite = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/admin-invites/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.ok),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-role-assignments"] }); toast({ title: "Invite removed" }); },
  });

  const generateInviteLink = useMutation({
    mutationFn: async ({ email, roleId }: { email: string; roleId: number }) => {
      const r = await fetch(`${basePath}/api/admin/admin-users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleId }),
      });
      const data = await readApiJson<{ pending?: boolean; inviteUrl?: string; error?: string }>(r);
      if (!data.inviteUrl) {
        throw new Error(
          "The server did not return an invite link. Deploy the latest API update (PR #108), then try again.",
        );
      }
      return { ...data, email };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-role-assignments"] });
      setInviteLinkDialog({ email: data.email, url: data.inviteUrl! });
      toast({
        title: "Access link generated",
        description: "Share the link — the user signs in and accepts to activate their role.",
      });
    },
    onError: (e: Error) => toast({ title: "Failed to generate link", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-8">
      {/* ── Roles Definition ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            <div>
              <h1 className="text-2xl font-bold">Admin Roles</h1>
              <p className="text-sm text-slate-500 mt-0.5">Define roles and their permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { refetchRoles(); refetchAssigned(); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
            </Button>
            <Button size="sm" onClick={openCreate} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-1.5" />New Role
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Role Name</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold">Permissions</TableHead>
                    <TableHead className="font-semibold">Assigned Users</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No roles defined yet. Create your first role.</TableCell></TableRow>
                  ) : (
                    roles.map((r) => {
                      const assignedCount = assignedUsers.filter((u) => u.roleId === r.id).length;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-3.5 h-3.5 text-orange-600" />
                              </div>
                              <span className="font-semibold text-slate-800">{r.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.description || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.permissions.slice(0, 3).map((p) => <Badge key={p} variant="secondary" className="text-xs">{p.replace(/_/g, " ")}</Badge>)}
                              {r.permissions.length > 3 && <Badge variant="outline" className="text-xs">+{r.permissions.length - 3} more</Badge>}
                              {r.permissions.length === 0 && <span className="text-xs text-slate-400">No permissions</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />{assignedCount} {assignedCount === 1 ? "user" : "users"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(r.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Edit role"><Pencil className="h-4 w-4" /></Button>
                            <Button
                              variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                              title="Delete role"
                              onClick={() => confirm(`Delete role "${r.name}"? This will remove all assignments.`) && deleteRole.mutate(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Assign Roles ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-bold">Assigned Roles</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Every assignment generates a shareable link. The user signs in and accepts to activate their role.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { setAssignForm({ email: "", roleId: roles[0]?.id?.toString() ?? "" }); setAssignDialogOpen(true); }}
            disabled={roles.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />Assign Role
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {assignedLoading ? (
              <div className="py-10 flex justify-center"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : !hasAssignments ? (
              <div className="py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">No roles assigned yet</p>
                <p className="text-slate-400 text-xs mt-1 mb-4">Assign a role to give an admin user scoped permissions</p>
                <Button
                  size="sm"
                  onClick={() => { setAssignForm({ email: "", roleId: roles[0]?.id?.toString() ?? "" }); setAssignDialogOpen(true); }}
                  disabled={roles.length === 0}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />Assign First Role
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Admin User</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Permissions</TableHead>
                    <TableHead className="font-semibold">Invite link</TableHead>
                    <TableHead className="font-semibold">Assigned On</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((invite) => (
                    <TableRow key={`invite-${invite.id}`} className="bg-amber-50/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 font-bold text-amber-700 text-sm">
                            {invite.email[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{invite.email}</p>
                            <Badge variant="outline" className="text-xs mt-1 border-amber-300 text-amber-700 bg-amber-50">Pending sign-up</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invite.role ? (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                            <Shield className="w-3 h-3 mr-1" />{invite.role.name}
                          </Badge>
                        ) : <span className="text-xs text-slate-400">Unknown role</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(invite.role?.permissions ?? []).slice(0, 3).map((p) => <Badge key={p} variant="secondary" className="text-xs">{p.replace(/_/g, " ")}</Badge>)}
                          {(invite.role?.permissions?.length ?? 0) > 3 && <Badge variant="outline" className="text-xs">+{(invite.role?.permissions.length ?? 0) - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(() => {
                          const url = resolveInviteUrl(invite);
                          if (!url) {
                            return <span className="text-xs text-slate-400">Link unavailable — refresh or re-assign</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1.5 max-w-xs">
                              <code className="text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded break-all line-clamp-2">{url}</code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-fit"
                                onClick={() => copyInviteLink(invite, toast)}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />Copy link
                              </Button>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{format(new Date(invite.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          title="Cancel invite"
                          onClick={() => confirm(`Cancel invite for ${invite.email}?`) && removeInvite.mutate(invite.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 font-bold text-blue-600 text-sm">
                            {(u.clerkUser?.name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{u.clerkUser?.name ?? "—"}</p>
                            <p className="text-xs text-slate-400">{u.clerkUser?.email ?? u.userId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role ? (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                            <Shield className="w-3 h-3 mr-1" />{u.role.name}
                          </Badge>
                        ) : <span className="text-xs text-slate-400">Unknown role</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(u.role?.permissions ?? []).slice(0, 3).map((p) => <Badge key={p} variant="secondary" className="text-xs">{p.replace(/_/g, " ")}</Badge>)}
                          {(u.role?.permissions?.length ?? 0) > 3 && <Badge variant="outline" className="text-xs">+{(u.role?.permissions.length ?? 0) - 3}</Badge>}
                          {(u.role?.permissions?.length ?? 0) === 0 && <span className="text-xs text-slate-400">No permissions</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7"
                          disabled={generateInviteLink.isPending || !u.clerkUser?.email}
                          onClick={() => {
                            const email = u.clerkUser?.email;
                            if (!email) {
                              toast({ title: "No email on file", description: "Re-assign this role by email to generate a link.", variant: "destructive" });
                              return;
                            }
                            generateInviteLink.mutate({ email, roleId: u.roleId });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          {generateInviteLink.isPending ? "Generating…" : "Get access link"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{format(new Date(u.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setEditingAssign(u); setEditRoleId(u.roleId.toString()); setEditAssignOpen(true); }}
                          title="Change role"
                        >
                          <ChevronDown className="h-4 w-4 mr-1" />Change Role
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          title="Remove assignment"
                          onClick={() => confirm(`Remove role from ${u.clerkUser?.email ?? u.userId}?`) && removeAssign.mutate(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create/Edit Role Dialog ── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />{editing ? "Edit Role" : "Create Role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1">Role Name *</Label>
              <Input placeholder="e.g. Support Staff, Billing Manager" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs mb-1">Description</Label>
              <Input placeholder="What can this role do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Permissions ({form.permissions.length} selected)</Label>
              <div className="max-h-72 overflow-y-auto pr-1 border rounded-lg p-3 space-y-4">
                {GROUP_ORDER.map((group) => {
                  const items = PERMISSION_GROUPS[group];
                  if (!items?.length) return null;
                  return (
                    <div key={group}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((item) => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-50 rounded p-1">
                            <Checkbox checked={form.permissions.includes(item.id)} onCheckedChange={() => togglePerm(item.id)} />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveRole.mutate(form)}
              disabled={!form.name || saveRole.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {saveRole.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Role Dialog ── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />Assign Role
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Admin User Email *</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={assignForm.email}
                onChange={(e) => setAssignForm((p) => ({ ...p, email: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Creates a shareable link. The user opens it, signs in, and accepts to activate their admin role.</p>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Role *</Label>
              <select
                value={assignForm.roleId}
                onChange={(e) => setAssignForm((p) => ({ ...p, roleId: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Select a role…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignRole.mutate({ email: assignForm.email, roleId: Number(assignForm.roleId) })}
              disabled={!assignForm.email || !assignForm.roleId || assignRole.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignRole.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : <><UserPlus className="w-4 h-4 mr-2" />Assign Role</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Assignment Dialog ── */}
      <Dialog open={editAssignOpen} onOpenChange={setEditAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role for {editingAssign?.clerkUser?.name ?? editingAssign?.clerkUser?.email ?? editingAssign?.userId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{editingAssign?.clerkUser?.email}</p>
            <div>
              <Label className="text-xs mb-1.5 block">New Role</Label>
              <select
                value={editRoleId}
                onChange={(e) => setEditRoleId(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editingAssign && updateAssign.mutate({ id: editingAssign.id, roleId: Number(editRoleId) })}
              disabled={updateAssign.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {updateAssign.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteLinkDialog} onOpenChange={(open) => !open && setInviteLinkDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Admin access invite link</DialogTitle>
          </DialogHeader>
          {inviteLinkDialog && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Share this link with <strong>{inviteLinkDialog.email}</strong>. They open it, sign in (or create an account), then accept the invitation to access the admin dashboard with their assigned role.
              </p>
              <code className="block text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-3 break-all">
                {inviteLinkDialog.url}
              </code>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteLinkDialog(null)}>Close</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (!inviteLinkDialog) return;
                void navigator.clipboard.writeText(inviteLinkDialog.url);
                toast({ title: "Invite link copied" });
              }}
            >
              <Copy className="w-4 h-4 mr-2" />Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
