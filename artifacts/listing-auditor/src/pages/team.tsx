import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  Users, Plus, Trash2, Mail, Shield, User, MoreHorizontal,
  CheckCircle2, Copy, ExternalLink, Clock, BarChart3, Zap, RefreshCw,
  ChevronRight, AlertTriangle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import { format, formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Role = "admin" | "editor" | "viewer";

interface TeamMember {
  id: number;
  ownerUserId: string;
  memberUserId: string | null;
  invitedEmail: string;
  invitedName: string;
  role: string;
  status: string;
  inviteToken: string;
  invitedAt: string;
  acceptedAt: string | null;
}

interface MemberStat {
  memberId: number;
  auditCount: number;
  avgScore: number;
  lastAudit: { createdAt: string; productName: string } | null;
  creditBalance: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
  allocatedCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

interface TeamData {
  maxSeats: number;
  planName: string | null;
  planStatus: string | null;
  members: TeamMember[];
  memberStats: MemberStat[];
}

const roleColors: Record<string, string> = {
  admin: "bg-orange-100 text-orange-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

const roleDescriptions: Record<string, string> = {
  admin: "Full access — can manage team, billing, and all audits",
  editor: "Can create and edit audits, cannot manage billing or team",
  viewer: "Read-only access to audits and reports",
};

function copyToClipboard(text: string, label: string, toast: (t: object) => void) {
  navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied!` }));
}

export default function Team() {
  const { user } = useUser();
  const { canManage, isTeamMember, role } = useTeam();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "editor" as Role });
  const [createdInvite, setCreatedInvite] = useState<{ token: string; invitedName: string; invitedEmail: string } | null>(null);

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team"],
    queryFn: () => fetch(`${basePath}/api/team`, { credentials: "include" }).then((r) => r.json()),
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { invitedEmail: string; invitedName: string; role: string }) =>
      fetch(`${basePath}/api/team/invite`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setCreatedInvite({ token: data.token, invitedName: data.invite.invitedName, invitedEmail: data.invite.invitedEmail });
      setInviteForm({ name: "", email: "", role: "editor" });
    },
    onError: (e: Error) => toast({ title: "Invite failed", description: e.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      fetch(`${basePath}/api/team/${id}/role`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast({ title: "Role updated" }); },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/team/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast({ title: "Member removed" }); },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const creditMutation = useMutation({
    mutationFn: ({ id, aiCredits, imageCredits, auditCredits }: { id: number; aiCredits: number; imageCredits: number; auditCredits: number }) =>
      fetch(`${basePath}/api/team/${id}/credits`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiCredits, imageCredits, auditCredits }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast({ title: "Credits updated" }); },
    onError: () => toast({ title: "Failed to update credits", variant: "destructive" }),
  });

  const [editingCredits, setEditingCredits] = useState<Record<number, { aiCredits: string; imageCredits: string; auditCredits: string }>>({});

  const members = data?.members ?? [];
  const memberStats = data?.memberStats ?? [];
  const maxSeats = data?.maxSeats ?? 1;
  const activePendingCount = members.filter((m) => m.status !== "revoked").length + 1; // +1 for owner
  const isAtLimit = activePendingCount >= maxSeats;
  const pct = Math.min(100, Math.round((activePendingCount / maxSeats) * 100));

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  function getInviteUrl(token: string) {
    return `${window.location.origin}${basePath}/accept-invite?token=${token}`;
  }

  function getStat(memberId: number) {
    return memberStats.find((s) => s.memberId === memberId);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage who has access to your workspace.</p>
          {isTeamMember && (
            <p className="text-xs text-slate-400 mt-1">Your role: <span className="font-medium capitalize">{role}</span></p>
          )}
        </div>
        {canManage && (
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => { setShowInvite(true); setCreatedInvite(null); }}
            disabled={isAtLimit}
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Seat usage */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Seats used</span>
            {data?.planName && <Badge variant="outline" className="text-xs">{data.planName}</Badge>}
          </div>
          <span className="text-sm font-semibold text-slate-900">{activePendingCount} / {maxSeats}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-yellow-400" : "bg-orange-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Seat limit reached.{" "}
            <button className="underline font-semibold" onClick={() => setLocation("/billing")}>Upgrade your plan</button>
            {" "}to add more members.
          </p>
        )}
      </div>

      {/* Role guide */}
      <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["admin", "editor", "viewer"] as const).map((role) => (
          <div key={role} className="flex gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {role === "admin" ? <Shield className="w-4 h-4 text-orange-500" /> : <User className={`w-4 h-4 ${role === "editor" ? "text-blue-500" : "text-slate-400"}`} />}
            </div>
            <div>
              <span className={`text-xs font-bold uppercase tracking-wide ${role === "admin" ? "text-orange-600" : role === "editor" ? "text-blue-600" : "text-slate-500"}`}>{role}</span>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{roleDescriptions[role]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInvite && canManage && (
        <div className="bg-white border border-orange-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-orange-500" />
              Invite a team member
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setShowInvite(false); setCreatedInvite(null); }}><X className="w-4 h-4" /></Button>
          </div>

          {createdInvite ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Invite created for {createdInvite.invitedName}</p>
                  <p className="text-xs text-green-600 mt-0.5">Share the link below with {createdInvite.invitedEmail}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getInviteUrl(createdInvite.token)}
                    className="font-mono text-xs bg-slate-50 text-slate-600 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(getInviteUrl(createdInvite.token), "Invite link", toast)}
                  >
                    <Copy className="w-4 h-4 mr-1.5" />Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getInviteUrl(createdInvite.token), "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Share this link with your team member. They'll need to sign up or sign in to accept.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCreatedInvite(null)}>Invite Another</Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowInvite(false); setCreatedInvite(null); }}>Done</Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate({ invitedEmail: inviteForm.email, invitedName: inviteForm.name, role: inviteForm.role });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="inviteName" className="text-xs">Full Name *</Label>
                  <Input
                    id="inviteName"
                    className="mt-1"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="inviteEmail" className="text-xs">Email Address *</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    className="mt-1"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="inviteRole" className="text-xs">Access Level *</Label>
                  <select
                    id="inviteRole"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as Role }))}
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-9"
                  >
                    <option value="editor">Editor — Create & edit audits</option>
                    <option value="viewer">Viewer — Read-only access</option>
                    <option value="admin">Admin — Full workspace access</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={inviteMutation.isPending} className="bg-orange-500 hover:bg-orange-600">
                  {inviteMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Creating…</> : <><Mail className="w-4 h-4 mr-2" />Create Invite</>}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Owner card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">
            {activePendingCount + pendingMembers.length} member{activePendingCount + pendingMembers.length !== 1 ? "s" : ""}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {/* Owner (you) */}
          <div className="flex items-center gap-4 px-5 py-4">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-100 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-orange-600">
                {(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{user?.fullName || user?.primaryEmailAddress?.emailAddress} <span className="text-xs text-slate-400 font-normal">(you)</span></p>
              <p className="text-slate-400 text-xs">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">admin</Badge>
            <Badge variant="outline" className="border-green-200 text-green-600">Owner</Badge>
          </div>

          {/* Active members */}
          {activeMembers.map((m) => {
            const stat = getStat(m.id);
            const isEditing = editingCredits[m.id] != null;
            const editVals = editingCredits[m.id] ?? {
              aiCredits: String(stat?.allocatedCredits?.aiCredits ?? 0),
              imageCredits: String(stat?.allocatedCredits?.imageCredits ?? 0),
              auditCredits: String(stat?.allocatedCredits?.auditCredits ?? 0),
            };
            return (
              <div key={m.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600">
                    {m.invitedName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName}</p>
                    <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
                    {stat && !isEditing && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-orange-400" />{stat.auditCount} audits</span>
                        {stat.lastAudit && (
                          <span className="text-xs text-slate-400">last {formatDistanceToNow(new Date(stat.lastAudit.createdAt), { addSuffix: true })}</span>
                        )}
                        {stat.allocatedCredits && (
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3 text-blue-400" />{stat.allocatedCredits.aiCredits} AI / {stat.allocatedCredits.imageCredits} Img / {stat.allocatedCredits.auditCredits} Audit</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit flex-shrink-0`}>{m.role}</Badge>
                  <Badge variant="outline" className="border-green-200 text-green-600 flex-shrink-0">Active</Badge>
                  {m.acceptedAt && <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap">Joined {format(new Date(m.acceptedAt), "MMM d, yyyy")}</span>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["admin", "editor", "viewer"] as Role[]).map((role) => (
                        <DropdownMenuItem key={role} onClick={() => roleMutation.mutate({ id: m.id, role })} disabled={m.role === role}>
                          {m.role === role && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />}
                          Make {role.charAt(0).toUpperCase() + role.slice(1)}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingCredits((prev) => ({ ...prev, [m.id]: { aiCredits: String(stat?.allocatedCredits?.aiCredits ?? 0), imageCredits: String(stat?.allocatedCredits?.imageCredits ?? 0), auditCredits: String(stat?.allocatedCredits?.auditCredits ?? 0) } }))}>
                        <Zap className="w-4 h-4 mr-2" />Edit Credits
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => confirm(`Remove ${m.invitedName} from your team?`) && removeMutation.mutate(m.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Credit allocation inline editor */}
                {isEditing && (
                  <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-slate-700">Allocate Credits</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">AI Credits</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editVals.aiCredits}
                          onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id], aiCredits: e.target.value } }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">Image Credits</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editVals.imageCredits}
                          onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id], imageCredits: e.target.value } }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">Audit Credits</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editVals.auditCredits}
                          onChange={(e) => setEditingCredits((prev) => ({ ...prev, [m.id]: { ...prev[m.id], auditCredits: e.target.value } }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600"
                        disabled={creditMutation.isPending}
                        onClick={() => {
                          creditMutation.mutate({
                            id: m.id,
                            aiCredits: Math.max(0, parseInt(editVals.aiCredits) || 0),
                            imageCredits: Math.max(0, parseInt(editVals.imageCredits) || 0),
                            auditCredits: Math.max(0, parseInt(editVals.auditCredits) || 0),
                          });
                          setEditingCredits((prev) => {
                            const next = { ...prev };
                            delete next[m.id];
                            return next;
                          });
                        }}
                      >
                        {creditMutation.isPending ? "Saving..." : "Save Credits"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCredits((prev) => {
                          const next = { ...prev };
                          delete next[m.id];
                          return next;
                        })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending invites */}
          {pendingMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4 bg-amber-50/40">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-600">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{m.invitedName}</p>
                <p className="text-slate-400 text-xs truncate">{m.invitedEmail}</p>
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />Invite sent {formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}</p>
              </div>
              <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit flex-shrink-0`}>{m.role}</Badge>
              <Badge variant="outline" className="border-amber-200 text-amber-600 flex-shrink-0">Pending</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => copyToClipboard(getInviteUrl(m.inviteToken), "Invite link", toast)}>
                    <Copy className="w-3.5 h-3.5 mr-2" />Copy Invite Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => confirm(`Revoke invite for ${m.invitedName}?`) && removeMutation.mutate(m.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />Revoke Invite
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && members.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No team members yet</p>
              <p className="text-slate-400 text-xs mt-1">Invite your team to collaborate on audits</p>
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => setShowInvite(true)} disabled={isAtLimit}>
                <Plus className="w-4 h-4 mr-2" />Invite First Member
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Activity of active members */}
      {activeMembers.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-900">Member Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Each member uses their own credits and audit workspace</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Member</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Role</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Audits</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Avg Score</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">AI Credits</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m) => {
                  const stat = getStat(m.id);
                  return (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{m.invitedName}</p>
                          <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit text-xs`}>{m.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{stat?.auditCount ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${(stat?.avgScore ?? 0) >= 70 ? "bg-green-100 text-green-700" : (stat?.avgScore ?? 0) >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                          {stat?.avgScore ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-purple-700 font-semibold">{stat?.creditBalance?.aiCredits ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-xs text-slate-400">
                        {stat?.lastAudit ? formatDistanceToNow(new Date(stat.lastAudit.createdAt), { addSuffix: true }) : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
