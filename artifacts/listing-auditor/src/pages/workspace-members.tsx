import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Copy, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MemberRow {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  inviteToken?: string;
  roleName?: string;
  legacyRole?: string;
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
  const { workspaces, can, isAccountOwner } = useWorkspace();
  const ws = workspaces.find((w) => w.id === workspaceId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");

  const canInvite = isAccountOwner || can("team", "create");

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => fetchJson<{ members: MemberRow[] }>(`${basePath}/api/workspaces/${workspaceId}/members`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const { data: rolesData } = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    queryFn: () => fetchJson<{ roles: RoleOption[] }>(`${basePath}/api/workspaces/${workspaceId}/roles`),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
  });

  const members = membersData?.members ?? [];
  const roles = rolesData?.roles ?? [];

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
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Workspaces
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ws.name} — Members</h1>
        </div>
      </div>

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
              disabled={!email.trim() || invite.isPending}
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
                  {canInvite && <TableHead className="w-[7rem]">Invite</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.invitedName}</TableCell>
                    <TableCell>{m.invitedEmail}</TableCell>
                    <TableCell>{m.roleName ?? m.legacyRole ?? "—"}</TableCell>
                    <TableCell className="capitalize">{m.status}</TableCell>
                    {canInvite && (
                      <TableCell>
                        {m.status === "pending" && m.inviteToken ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => copyInviteLink(m.inviteToken!, toast)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy link
                          </Button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
