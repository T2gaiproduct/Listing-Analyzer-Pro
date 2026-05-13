import { useState } from "react";
import { Users, Plus, Trash2, Mail, Shield, User, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = "admin" | "editor" | "viewer";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "pending";
  joinedAt: string;
  avatarUrl?: string;
}

const initialMembers: Member[] = [
  { id: "1", name: "You", email: "admin@test.com", role: "admin", status: "active", joinedAt: "Jan 1, 2026" },
  { id: "2", name: "Priya Sharma", email: "priya@example.com", role: "editor", status: "active", joinedAt: "Feb 15, 2026" },
  { id: "3", name: "James Chen", email: "james@example.com", role: "viewer", status: "pending", joinedAt: "Invited May 5, 2026" },
];

const roleColors: Record<Role, string> = {
  admin: "bg-orange-100 text-orange-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

const roleDescriptions: Record<Role, string> = {
  admin: "Full access — can manage team, billing, and all audits",
  editor: "Can create and edit audits, cannot manage billing or team",
  viewer: "Read-only access to audits and reports",
};

export default function Team() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setMembers(m => [
      ...m,
      {
        id: Date.now().toString(),
        name: inviteEmail.split("@")[0],
        email: inviteEmail,
        role: inviteRole,
        status: "pending",
        joinedAt: `Invited ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      },
    ]);
    setLoading(false);
    setInviteSent(true);
    setInviteEmail("");
    setTimeout(() => { setInviteSent(false); setShowInvite(false); }, 2000);
  }

  function changeRole(id: string, role: Role) {
    setMembers(m => m.map(mem => mem.id === id ? { ...mem, role } : mem));
  }

  function removeMember(id: string) {
    setMembers(m => m.filter(mem => mem.id !== id));
  }

  const maxSeats = 3;
  const activeCount = members.filter(m => m.status === "active").length;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team</h1>
            <p className="text-slate-500 mt-1">Manage who has access to your workspace.</p>
          </div>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => setShowInvite(true)}
            disabled={members.length >= maxSeats}
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {/* Seat usage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Seats used</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{members.length} / {maxSeats}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all"
              style={{ width: `${(members.length / maxSeats) * 100}%` }}
            />
          </div>
          {members.length >= maxSeats && (
            <p className="text-xs text-orange-600 mt-2">Seat limit reached. <button className="underline font-semibold">Upgrade your plan</button> to add more members.</p>
          )}
        </div>

        {/* Role guide */}
        <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(roleDescriptions) as [Role, string][]).map(([role, desc]) => (
            <div key={role} className="flex gap-3">
              <div className="mt-0.5">
                {role === "admin" ? <Shield className="w-4 h-4 text-orange-500" /> : role === "editor" ? <User className="w-4 h-4 text-blue-500" /> : <User className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wide ${role === "admin" ? "text-orange-600" : role === "editor" ? "text-blue-600" : "text-slate-500"}`}>{role}</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="bg-white border border-orange-200 rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-orange-500" />
              Invite a team member
            </h2>
            {inviteSent ? (
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Invitation sent!</span>
              </div>
            ) : (
              <form onSubmit={sendInvite} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="inviteEmail">Email address</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="inviteRole">Role</Label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as Role)}
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
                    {loading ? "Sending..." : "Send Invite"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">{members.length} member{members.length !== 1 ? "s" : ""}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600">
                  {m.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{m.name} {m.id === "1" && <span className="text-xs text-slate-400">(you)</span>}</p>
                  <p className="text-slate-400 text-xs truncate">{m.email}</p>
                </div>
                <Badge className={roleColors[m.role]}>{m.role}</Badge>
                <Badge variant="outline" className={m.status === "active" ? "border-green-200 text-green-600" : "border-amber-200 text-amber-600"}>
                  {m.status === "active" ? "Active" : "Pending"}
                </Badge>
                <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap">{m.joinedAt}</span>
                {m.id !== "1" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => changeRole(m.id, "admin")}>Make Admin</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeRole(m.id, "editor")}>Make Editor</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeRole(m.id, "viewer")}>Make Viewer</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => removeMember(m.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
