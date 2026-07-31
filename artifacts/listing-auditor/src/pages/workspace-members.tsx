import { Link, useParams } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Copy, Mail, Trash2, UserPlus, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";
import { accountRoleLabel } from "@/lib/role-display";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MemberRow {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  inviteToken?: string;
  roleId?: number | null;
  roleName?: string | null;
  allocatedCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
}

interface InviteResponse {
  inviteUrl?: string;
  emailSent?: boolean;
  emailError?: string;
}

function getWorkspaceInviteUrl(token: string) {
  return `${window.location.origin}${basePath}/accept-workspace-invite?token=${token}`;
}

function copyInviteLink(token: string, toast: ReturnType<typeof useToast>["toast"]) {
  void navigator.clipboard.writeText(getWorkspaceInviteUrl(token)).then(() => {
    toast({ title: "Invite link copied" });
  });
}

interface RoleOption { id: number; name: string; }

export default function WorkspaceMembersPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { workspaces, can, isAccountOwner, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const ws = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (Number.isFinite(workspaceId) && workspaceId > 0) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaceId, setActiveWorkspaceId]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [editingCredits, setEditingCredits] = useState<Record<number, { aiCredits: string; imageCredits: string; auditCredits: string }>>({});

  const canInvite = isAccountOwner || can("team", "create");
  const canRemoveMember = isAccountOwner || can("team", "delete");
  const canAllocateCredits = isAccountOwner || can("credits", "edit");
  const canViewCredits = isAccountOwner || can("credits", "viewGlobal");

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => fetchJson<{
      members: MemberRow[];
      poolCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
      poolAvailableForMembers?: { aiCredits: number; imageCredits: number; auditCredits: number };
    }>(`${basePath}/api/workspaces/${workspaceId}/members`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const { data: rolesData } = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    queryFn: () => fetchJson<{ roles: RoleOption[] }>(`${basePath}/api/workspaces/${workspaceId}/roles`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const members = membersData?.members ?? [];
  const roles = rolesData?.roles ?? [];

  useEffect(() => {
    if (roles.length > 0 && !roleId) {
      setRoleId(String(roles[0]!.id));
    }
  }, [roles, roleId]);

  const creditMutation = useMutation({
    mutationFn: ({ memberId, aiCredits, imageCredits, auditCredits }: { memberId: number; aiCredits: number; imageCredits: number; auditCredits: number }) =>
      fetchJson(`${basePath}/api/workspaces/${workspaceId}/members/${memberId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiCredits, imageCredits, auditCredits }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Credits updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update credits", description: err.message, variant: "destructive" }),
  });

  const resendInvite = useMutation({
    mutationFn: (memberId: number) =>
      fetchJson<InviteResponse>(`${basePath}/api/workspaces/${workspaceId}/members/${memberId}/resend`, {
        method: "POST",
      }),
    onSuccess: (data, memberId) => {
      const member = members.find((m) => m.id === memberId);
      if (data.emailSent) {
        toast({
          title: "Invitation resent",
          description: `Email sent to ${member?.invitedEmail ?? "invitee"}.`,
        });
      } else {
        toast({
          title: "Could not send email",
          description: data.emailError ?? "Copy the invite link instead.",
          variant: "destructive",
        });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Failed to resend invite", description: err.message, variant: "destructive" }),
  });

  const invite = useMutation({
    mutationFn: () =>
      fetchJson<InviteResponse>(`${basePath}/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitedEmail: email.trim(),
          invitedName: name.trim() || email.split("@")[0],
          roleId: roleId ? Number(roleId) : undefined,
        }),
      }),
    onSuccess: (data) => {
      const invitedEmail = email.trim();
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      setEmail("");
      setName("");
      if (data.emailSent) {
        toast({ title: "Invitation email sent", description: `An invite was emailed to ${invitedEmail}.` });
      } else {
        toast({
          title: "Invite created",
          description: data.emailError
            ? `Email could not be sent (${data.emailError}). Copy the invite link from the members table.`
            : "Copy the invite link from the members table to share it.",
          variant: data.emailError ? "destructive" : "default",
        });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Failed to invite member", description: err.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: number) => {
      const r = await fetch(`${basePath}/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to remove member");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      void qc.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Member removed from workspace" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to remove member", description: err.message, variant: "destructive" }),
  });

  function confirmRemoveMember(m: MemberRow) {
    const label = m.invitedName?.trim() || m.invitedEmail;
    const verb = m.status === "pending" ? "Revoke the invite for" : "Remove";
    const message =
      m.status === "pending"
        ? `${verb} ${label}? They will not be able to accept this invitation.`
        : `${verb} ${label} from "${ws?.name ?? "this workspace"}"? They will lose access to this workspace.`;
    if (confirm(message)) removeMember.mutate(m.id);
  }

  if (!ws) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Workspace not found.</p>
        <Link href="/workspaces"><Button variant="link" className="px-0">Back</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/workspaces/${workspaceId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            {ws.name}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ws.name} — Members</h1>
        </div>
      </div>

      {canViewCredits && membersData?.poolCredits && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Workspace credit pool
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-1">
            <p>
              Pool balance: {membersData.poolCredits.auditCredits} audit · {membersData.poolCredits.aiCredits} text · {membersData.poolCredits.imageCredits} images
            </p>
            {membersData.poolAvailableForMembers && (
              <p className="text-xs text-slate-500">
                Available to assign to members: {membersData.poolAvailableForMembers.auditCredits} audit · {membersData.poolAvailableForMembers.aiCredits} text · {membersData.poolAvailableForMembers.imageCredits} images
              </p>
            )}
            {isAccountOwner && (
              <p className="text-xs text-slate-500">
                Fund this pool from your account on the{" "}
                <Link href="/workspaces" className="underline font-medium">Workspaces</Link> dashboard, then assign credits to members in the table below.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite member
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="sm:col-span-3 w-fit"
              onClick={() => invite.mutate()}
              disabled={!email.trim() || !roleId || roles.length === 0 || invite.isPending}
            >
              Send invite
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {canViewCredits && <TableHead>Credits</TableHead>}
                  {canInvite && <TableHead className="w-[11rem]">Invite</TableHead>}
                  {canRemoveMember && <TableHead className="w-[7rem]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isEditing = editingCredits[m.id] != null;
                  const editVals = editingCredits[m.id] ?? {
                    aiCredits: String(m.allocatedCredits?.aiCredits ?? 0),
                    imageCredits: String(m.allocatedCredits?.imageCredits ?? 0),
                    auditCredits: String(m.allocatedCredits?.auditCredits ?? 0),
                  };
                  return (
                  <TableRow key={m.id}>
                    <TableCell>{m.invitedName}</TableCell>
                    <TableCell>{m.invitedEmail}</TableCell>
                    <TableCell>{accountRoleLabel(m.roleId, m.roleName, roles)}</TableCell>
                    <TableCell className="capitalize">{m.status}</TableCell>
                    {canViewCredits && (
                      <TableCell>
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-1">
                              <Input type="number" min={0} className="h-8 text-xs" value={editVals.aiCredits}
                                onChange={(e) => setEditingCredits((p) => ({ ...p, [m.id]: { ...p[m.id]!, aiCredits: e.target.value } }))} />
                              <Input type="number" min={0} className="h-8 text-xs" value={editVals.imageCredits}
                                onChange={(e) => setEditingCredits((p) => ({ ...p, [m.id]: { ...p[m.id]!, imageCredits: e.target.value } }))} />
                              <Input type="number" min={0} className="h-8 text-xs" value={editVals.auditCredits}
                                onChange={(e) => setEditingCredits((p) => ({ ...p, [m.id]: { ...p[m.id]!, auditCredits: e.target.value } }))} />
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7" disabled={creditMutation.isPending}
                                onClick={() => {
                                  creditMutation.mutate({
                                    memberId: m.id,
                                    aiCredits: Math.max(0, parseInt(editVals.aiCredits) || 0),
                                    imageCredits: Math.max(0, parseInt(editVals.imageCredits) || 0),
                                    auditCredits: Math.max(0, parseInt(editVals.auditCredits) || 0),
                                  });
                                  setEditingCredits((p) => {
                                    const next = { ...p };
                                    delete next[m.id];
                                    return next;
                                  });
                                }}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingCredits((p) => {
                                const next = { ...p };
                                delete next[m.id];
                                return next;
                              })}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>
                              {m.allocatedCredits?.auditCredits ?? 0} audit · {m.allocatedCredits?.aiCredits ?? 0} text · {m.allocatedCredits?.imageCredits ?? 0} img
                            </span>
                            {canAllocateCredits && m.status === "active" && (
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingCredits((p) => ({
                                ...p,
                                [m.id]: {
                                  aiCredits: String(m.allocatedCredits?.aiCredits ?? 0),
                                  imageCredits: String(m.allocatedCredits?.imageCredits ?? 0),
                                  auditCredits: String(m.allocatedCredits?.auditCredits ?? 0),
                                },
                              }))}>
                                <Zap className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                    {canInvite && (
                      <TableCell>
                        {m.status === "pending" && m.inviteToken ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => resendInvite.mutate(m.id)}
                              disabled={resendInvite.isPending}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Resend
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => copyInviteLink(m.inviteToken!, toast)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Link
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                    )}
                    {canRemoveMember && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => confirmRemoveMember(m)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {m.status === "pending" ? "Revoke" : "Remove"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
