import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, CreditCard, Ban, CheckCircle, Trash2, Eye, PauseCircle, PlayCircle, Activity, DollarSign, Package, User, Building2, Phone, Globe, Edit2, Save, X, Zap, Image, BarChart3, RefreshCw, Users, Link, FileText as FileTextIcon, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useEffect } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Admin Team Panel ──────────────────────────────────────────────────────
interface AdminTeamMember {
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

interface AdminTeamStat {
  memberId: number;
  auditCount: number;
  credits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

const roleColors: Record<string, string> = {
  admin: "bg-orange-100 text-orange-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

function AdminCustomerTeam({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ members: AdminTeamMember[]; memberStats: AdminTeamStat[] }>({
    queryKey: ["admin-customer-team", userId],
    queryFn: () => fetch(`${basePath}/api/admin/customers/${userId}/team`, { credentials: "include" }).then((r) => r.json()),
  });

  const members = data?.members ?? [];
  const stats = data?.memberStats ?? [];

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (members.length === 0) return (
    <Card className="border-0 shadow-sm">
      <CardContent className="py-12 text-center">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm font-medium">No team members</p>
        <p className="text-xs text-slate-400 mt-1">This customer has not invited any team members yet.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-500" /> Team Members
          <Badge variant="outline" className="ml-auto">{members.length} member{members.length !== 1 ? "s" : ""}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Member</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Audits</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">AI Credits</th>
              <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const s = stats.find((st) => st.memberId === m.id);
              return (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{m.invitedName}</p>
                    <p className="text-xs text-slate-400">{m.invitedEmail}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={`${roleColors[m.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit text-xs`}>{m.role}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={m.status === "active" ? "border-green-200 text-green-600 text-xs" : m.status === "pending" ? "border-amber-200 text-amber-600 text-xs" : "border-slate-200 text-slate-500 text-xs"}>
                      {m.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-700">{s?.auditCount ?? "—"}</td>
                  <td className="px-3 py-3 text-right text-purple-700 font-semibold">{s?.credits?.aiCredits ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">
                    {m.acceptedAt ? format(new Date(m.acceptedAt), "MMM d, yyyy") : m.status === "pending" ? `Invited ${formatDistanceToNow(new Date(m.invitedAt), { addSuffix: true })}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface Plan {
  id: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  tag: string | null;
  isHighlighted: boolean;
}

function fetchCustomerDetail(userId: string) {
  return fetch(`${basePath}/api/admin/customers/${userId}`, { credentials: "include" }).then((r) => r.json());
}
function fetchCustomerPayments(userId: string) {
  return fetch(`${basePath}/api/admin/customers/${userId}/payments`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminCustomerDetail({ userId }: { userId: string }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creditForm, setCreditForm] = useState({ ai: "", image: "", audit: "", reason: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changePlanYearly, setChangePlanYearly] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "suspend" | "unsuspend" | "ban" | "unban" | "delete" } | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);
  const [profileForm, setProfileForm] = useState({
    fullName: "", companyName: "", phone: "", country: "",
    gstNumber: "", websiteUrl: "", teamSize: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customer", userId],
    queryFn: () => fetchCustomerDetail(userId),
  });

  const { data: billingData } = useQuery({
    queryKey: ["admin-customer-payments", userId],
    queryFn: () => fetchCustomerPayments(userId),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
    enabled: showChangePlan,
  });

  useEffect(() => {
    if (data?.profile) {
      setProfileForm({
        fullName: data.profile.fullName ?? "",
        companyName: data.profile.companyName ?? "",
        phone: data.profile.phone ?? "",
        country: data.profile.country ?? "",
        gstNumber: data.profile.gstNumber ?? "",
        websiteUrl: data.profile.websiteUrl ?? "",
        teamSize: data.profile.teamSize?.toString() ?? "",
      });
    }
  }, [data?.profile]);

  const banMutation = useMutation({
    mutationFn: (ban: boolean) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${ban ? "ban" : "unban"}`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customer", userId] }); toast({ title: "Ban status updated" }); },
  });

  const lockMutation = useMutation({
    mutationFn: (lock: boolean) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${lock ? "lock" : "unlock"}`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customer", userId] }); toast({ title: "Suspension status updated" }); },
  });

  const creditMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/credits/${userId}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer", userId] });
      setCreditForm({ ai: "", image: "", audit: "", reason: "" });
      toast({ title: "Credits updated" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/customers/${userId}/profile`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer", userId] });
      setEditingProfile(false);
      toast({ title: "Profile updated" });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const packageMutation = useMutation({
    mutationFn: (body: { planId: number; billingCycle: "monthly" | "yearly" }) =>
      fetch(`${basePath}/api/admin/customers/${userId}/package`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer", userId] });
      setShowChangePlan(false);
      toast({ title: "Package updated successfully" });
    },
    onError: () => toast({ title: "Failed to change package", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`${basePath}/api/admin/customers/${userId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { toast({ title: "Customer deleted" }); setLocation("/admin/customers"); },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { user, profile, audits, auditStats, credits, transactions, subscription } = data ?? {};
  const payments: Array<{ id: number; amount: number; currency: string; status: string; gateway: string; createdAt: string }> = billingData?.payments ?? [];
  const invoices: Array<{ id: number; amount: number; currency: string; status: string; dueDate: string | null; createdAt: string }> = billingData?.invoices ?? [];

  const totalSpend = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/customers")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Customers
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-orange-500">{(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email}
            </h1>
            <p className="text-slate-500 text-sm">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {user?.banned
                ? <Badge variant="destructive">Banned</Badge>
                : user?.locked
                  ? <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Suspended</Badge>
                  : <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
              }
              {subscription?.status && (
                <Badge className={`${subscription.status === "active" ? "bg-green-100 text-green-700" : subscription.status === "trial" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"} hover:bg-inherit`}>
                  {subscription.planName} · {subscription.status}
                </Badge>
              )}
              <span className="text-xs text-slate-400 self-center">
                Joined {user?.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}
              </span>
              {user?.lastSignInAt && (
                <span className="text-xs text-slate-400 self-center">
                  · Last seen {formatDistanceToNow(new Date(user.lastSignInAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPendingAction({ type: user?.locked ? "unsuspend" : "suspend" }); setConfirmStep(1); }}
            disabled={lockMutation.isPending || user?.banned}
            title={user?.locked ? "Unsuspend account" : "Suspend account"}
          >
            {user?.locked ? <PlayCircle className="w-4 h-4 mr-1.5 text-green-600" /> : <PauseCircle className="w-4 h-4 mr-1.5 text-yellow-600" />}
            {user?.locked ? "Activate" : "Suspend"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPendingAction({ type: user?.banned ? "unban" : "ban" }); setConfirmStep(1); }}
            disabled={banMutation.isPending}
          >
            {user?.banned ? <CheckCircle className="w-4 h-4 mr-1.5" /> : <Ban className="w-4 h-4 mr-1.5" />}
            {user?.banned ? "Unban" : "Ban"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setPendingAction({ type: "delete" }); setConfirmStep(1); }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Audits", value: auditStats?.total ?? 0, icon: FileText, color: "text-orange-500" },
          { label: "Avg Score", value: `${auditStats?.averageScore ?? 0}/100`, icon: Activity, color: "text-blue-500" },
          { label: "Total Spend", value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
          { label: "Credit Balance", value: `${(credits?.aiCredits ?? 0) + (credits?.imageCredits ?? 0) + (credits?.auditCredits ?? 0)}`, icon: CreditCard, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color} opacity-80`} />
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><FileText className="w-4 h-4 mr-1.5" />Audit History</TabsTrigger>
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="credits"><CreditCard className="w-4 h-4 mr-1.5" />Credits</TabsTrigger>
          <TabsTrigger value="subscriptions"><Package className="w-4 h-4 mr-1.5" />Subscription</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="w-4 h-4 mr-1.5" />Payments</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-1.5" />Activity</TabsTrigger>
          <TabsTrigger value="team"><Users className="w-4 h-4 mr-1.5" />Team</TabsTrigger>
        </TabsList>

        {/* ── Audit History ── */}
        <TabsContent value="overview">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Audit History
                <span className="ml-2 text-sm font-normal text-slate-400">{auditStats?.total ?? 0} total</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Product</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Score</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">View</th>
                  </tr>
                </thead>
                <tbody>
                  {audits?.map((a: { id: number; productName: string; overallScore: number; status: string; createdAt: string }) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-orange-50/40 cursor-pointer group" onClick={() => setLocation(`/audits/${a.id}`)}>
                      <td className="px-5 py-3 font-medium text-slate-800 truncate max-w-[200px] group-hover:text-orange-700 transition-colors">{a.productName}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${a.overallScore >= 70 ? "bg-green-100 text-green-700" : a.overallScore >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {a.overallScore}
                        </span>
                      </td>
                      <td className="px-3 py-3 capitalize text-xs text-slate-500">{a.status}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{format(new Date(a.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-orange-600 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/audits/${a.id}`); }}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!audits?.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">No audits yet</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Profile ── */}
        <TabsContent value="profile">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-orange-500" /> Customer Profile
              </CardTitle>
              <div className="flex gap-2">
                {editingProfile ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditingProfile(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => profileMutation.mutate({ ...profileForm, teamSize: profileForm.teamSize ? Number(profileForm.teamSize) : undefined })}
                      disabled={profileMutation.isPending}>
                      {profileMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" />Edit Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!profile && !editingProfile ? (
                <div className="text-center py-8">
                  <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No profile data yet.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setEditingProfile(true)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" />Add Profile
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "fullName", label: "Full Name", icon: User, placeholder: "Jane Smith" },
                      { key: "companyName", label: "Company / Brand", icon: Building2, placeholder: "Acme LLC" },
                      { key: "phone", label: "Phone", icon: Phone, placeholder: "+1 (555) 000-0000" },
                      { key: "country", label: "Country", icon: Globe, placeholder: "United States" },
                    ].map(({ key, label, icon: Icon, placeholder }) => (
                      <div key={key}>
                        <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Icon className="w-3 h-3" />{label}</Label>
                        {editingProfile ? (
                          <Input className="mt-1 h-8 text-sm" value={profileForm[key as keyof typeof profileForm]} placeholder={placeholder}
                            onChange={(e) => setProfileForm((p) => ({ ...p, [key]: e.target.value }))} />
                        ) : (
                          <p className="text-sm font-medium text-slate-800 mt-1">{(profile as Record<string, string | null>)?.[key] || <span className="text-slate-400 italic">Not set</span>}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs flex items-center gap-1.5 text-slate-500"><FileTextIcon className="w-3 h-3" />GST / Tax Number</Label>
                        {editingProfile ? (
                          <Input className="mt-1 h-8 text-sm" value={profileForm.gstNumber} placeholder="GST1234567890"
                            onChange={(e) => setProfileForm((p) => ({ ...p, gstNumber: e.target.value }))} />
                        ) : (
                          <p className="text-sm font-medium text-slate-800 mt-1">{profile?.gstNumber || <span className="text-slate-400 italic">Not set</span>}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Link className="w-3 h-3" />Website URL</Label>
                        {editingProfile ? (
                          <Input className="mt-1 h-8 text-sm" value={profileForm.websiteUrl} placeholder="https://example.com"
                            onChange={(e) => setProfileForm((p) => ({ ...p, websiteUrl: e.target.value }))} />
                        ) : (
                          <p className="text-sm font-medium text-slate-800 mt-1">
                            {profile?.websiteUrl
                              ? <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-[200px]">{profile.websiteUrl}</a>
                              : <span className="text-slate-400 italic">Not set</span>}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Users className="w-3 h-3" />Team Size</Label>
                        {editingProfile ? (
                          <Input className="mt-1 h-8 text-sm" type="number" value={profileForm.teamSize} placeholder="e.g. 5"
                            onChange={(e) => setProfileForm((p) => ({ ...p, teamSize: e.target.value }))} />
                        ) : (
                          <p className="text-sm font-medium text-slate-800 mt-1">{profile?.teamSize ?? <span className="text-slate-400 italic">Not set</span>}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Onboarding</Label>
                        <p className="text-sm font-medium mt-1">
                          {profile?.onboardingCompleted
                            ? <span className="text-green-600 font-semibold">✓ Completed</span>
                            : <span className="text-yellow-600">Pending</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Credits ── */}
        <TabsContent value="credits">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-500" /> Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "AI Credits", value: credits?.aiCredits ?? 0, key: "ai", color: "text-purple-600" },
                  { label: "Image Credits", value: credits?.imageCredits ?? 0, key: "image", color: "text-blue-600" },
                  { label: "Audit Credits", value: credits?.auditCredits ?? 0, key: "audit", color: "text-orange-600" },
                ].map((c) => (
                  <div key={c.key} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-slate-600">{c.label}</span>
                    <span className={`font-bold text-lg ${c.color}`}>{c.value}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjust Credits</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ label: "AI", key: "ai" as const }, { label: "Image", key: "image" as const }, { label: "Audit", key: "audit" as const }].map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs text-slate-500">{f.label}</Label>
                        <Input type="number" className="h-8 text-xs mt-0.5" placeholder="±0"
                          value={creditForm[f.key]}
                          onChange={(e) => setCreditForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <Input className="h-8 text-xs" placeholder="Reason (optional)" value={creditForm.reason}
                    onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))} />
                  <Button size="sm" className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600"
                    onClick={() => creditMutation.mutate({ aiCredits: Number(creditForm.ai) || 0, imageCredits: Number(creditForm.image) || 0, auditCredits: Number(creditForm.audit) || 0, reason: creditForm.reason || "Admin adjustment" })}
                    disabled={creditMutation.isPending}>
                    {creditMutation.isPending ? "Applying…" : "Apply Adjustment"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Credit Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  {transactions?.length ? (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                          <th className="text-left px-2 py-2 font-medium text-slate-500">Feature</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-500">Amount</th>
                          <th className="text-right px-4 py-2 font-medium text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t: { id: number; creditType: string; featureType: string | null; amount: number; reason: string; createdAt: string }) => (
                          <tr key={t.id} className="border-b border-slate-50">
                            <td className="px-4 py-2.5 capitalize text-slate-700">{t.creditType}</td>
                            <td className="px-2 py-2.5 text-slate-400 truncate max-w-[80px]">{t.featureType ?? "—"}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${t.amount > 0 ? "text-green-600" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">{format(new Date(t.createdAt), "MMM d")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-8">No credit transactions</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Subscriptions ── */}
        <TabsContent value="subscriptions">
          <div className="space-y-5">
            {/* Current Subscription */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" /> Current Subscription
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowChangePlan(true)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Change Package
                </Button>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1">Plan</p>
                      <p className="font-bold text-slate-900">{subscription.planName ?? "—"}</p>
                      <Badge className={`mt-1 ${subscription.status === "active" ? "bg-green-100 text-green-700" : subscription.status === "trial" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"} hover:bg-inherit`}>{subscription.status}</Badge>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1">Billing Cycle</p>
                      <p className="font-bold text-slate-900 capitalize">{subscription.billingCycle}</p>
                      <p className="text-xs text-slate-500">${subscription.billingCycle === "yearly" ? subscription.priceYearly : subscription.priceMonthly}{subscription.billingCycle === "yearly" ? "/year" : "/mo"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1">
                        {subscription.status === "trial" ? "Trial Ends" : "Period Ends"}
                      </p>
                      <p className="font-bold text-slate-900 text-sm">
                        {subscription.status === "trial" && subscription.trialEndsAt
                          ? format(new Date(subscription.trialEndsAt), "MMM d, yyyy")
                          : subscription.currentPeriodEnd
                            ? format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")
                            : "—"}
                      </p>
                      <p className="text-xs text-slate-500">Auto-renew: {subscription.autoRenew ? "On" : "Off"}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Zap className="w-3 h-3 text-purple-500" />AI Credits Left</p>
                      <p className="font-bold text-purple-700 text-xl">{credits?.aiCredits ?? 0}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Image className="w-3 h-3 text-blue-500" />Image Credits Left</p>
                      <p className="font-bold text-blue-700 text-xl">{credits?.imageCredits ?? 0}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-orange-500" />Audit Credits Left</p>
                      <p className="font-bold text-orange-700 text-xl">{credits?.auditCredits ?? 0}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm mb-3">No active subscription</p>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowChangePlan(true)}>Assign Package</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change Plan modal */}
            {showChangePlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowChangePlan(false)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900">Change Package</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowChangePlan(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Select a new plan for this customer. Credits will be updated to match the new plan.</p>

                  <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 mb-5 w-fit">
                    <button onClick={() => setChangePlanYearly(false)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!changePlanYearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Monthly</button>
                    <button onClick={() => setChangePlanYearly(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${changePlanYearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                      Yearly <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">-20%</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    {plans.map((plan) => (
                      <div key={plan.id} className={`rounded-xl border-2 p-4 ${plan.id === subscription?.planId ? "border-orange-300 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}>
                        {plan.tag && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">{plan.tag}</span>}
                        <p className="font-bold text-slate-900 mt-1">{plan.name}</p>
                        <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                          ${changePlanYearly ? plan.priceYearly : plan.priceMonthly}
                          <span className="text-xs font-normal text-slate-400">{changePlanYearly ? "/year" : "/mo"}</span>
                        </p>
                        <div className="text-xs text-slate-500 space-y-0.5 mt-2 mb-3">
                          <p>{plan.aiCredits} AI credits</p>
                          <p>{plan.imageCredits} image credits</p>
                          <p>{plan.auditCredits === 999 ? "Unlimited" : plan.auditCredits} audits</p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          disabled={packageMutation.isPending}
                          onClick={() => packageMutation.mutate({ planId: plan.id, billingCycle: changePlanYearly ? "yearly" : "monthly" })}
                        >
                          {plan.id === subscription?.planId ? "Current Plan" : packageMutation.isPending ? "Updating…" : "Switch to This"}
                        </Button>
                      </div>
                    ))}
                    {plans.length === 0 && (
                      <div className="col-span-3 text-center py-8 text-slate-400 text-sm">Loading plans…</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Invoices</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-600">#{inv.id}</td>
                          <td className="px-4 py-3 font-semibold">${inv.amount.toFixed(2)} <span className="text-xs text-slate-400">{inv.currency}</span></td>
                          <td className="px-4 py-3"><Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></td>
                          <td className="px-5 py-3 text-xs text-slate-400">{inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Payment History ── */}
        <TabsContent value="payments">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" /> Payment History
                <Badge variant="outline" className="ml-auto">{payments.length} payments · ${totalSpend.toFixed(2)} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No payments found for this user.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">ID</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Gateway</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50">
                        <td className="px-5 py-3 text-slate-500 text-xs">#{p.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">${p.amount.toFixed(2)} <span className="text-xs text-slate-400">{p.currency}</span></td>
                        <td className="px-4 py-3 capitalize text-slate-600">{p.gateway}</td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(p.createdAt), "MMM d, yyyy")}</td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => {
                            window.open(`${basePath}/api/admin/receipts/${p.id}`, "_blank");
                          }}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team">
          <AdminCustomerTeam userId={userId} />
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" /> Account Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-2">Timeline</div>
                {[
                  user?.createdAt && { date: new Date(user.createdAt), event: "Account created", icon: "🎉", color: "bg-green-100 text-green-700" },
                  user?.lastSignInAt && { date: new Date(user.lastSignInAt), event: "Last sign-in", icon: "🔑", color: "bg-blue-100 text-blue-700" },
                  ...(audits ?? []).slice(0, 5).map((a: { id: number; productName: string; createdAt: string }) => ({
                    date: new Date(a.createdAt),
                    event: `Audit created: ${a.productName}`,
                    icon: "📋",
                    color: "bg-orange-100 text-orange-700",
                  })),
                  ...payments.slice(0, 5).map((p) => ({
                    date: new Date(p.createdAt),
                    event: `Payment ${p.status}: $${p.amount.toFixed(2)} via ${p.gateway}`,
                    icon: "💳",
                    color: p.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
                  })),
                  ...(transactions ?? []).slice(0, 3).map((t: { id: number; creditType: string; amount: number; reason: string; featureType: string | null; createdAt: string }) => ({
                    date: new Date(t.createdAt),
                    event: `Credits ${t.amount > 0 ? "added" : "deducted"}: ${Math.abs(t.amount)} ${t.creditType}${t.featureType ? ` (${t.featureType})` : ""}`,
                    icon: "💰",
                    color: t.amount > 0 ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600",
                  })),
                  user?.banned && { date: new Date(), event: "Account banned", icon: "🚫", color: "bg-red-100 text-red-700" },
                  user?.locked && { date: new Date(), event: "Account suspended", icon: "⏸️", color: "bg-yellow-100 text-yellow-700" },
                ].filter(Boolean)
                 .sort((a, b) => (b as { date: Date }).date.getTime() - (a as { date: Date }).date.getTime())
                 .map((item, i) => {
                   const ev = item as { date: Date; event: string; icon: string; color: string };
                   return (
                     <div key={i} className="flex items-start gap-3">
                       <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${ev.color}`}>
                         {ev.icon}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-sm text-slate-700 truncate">{ev.event}</p>
                         <p className="text-xs text-slate-400">{format(ev.date, "MMM d, yyyy HH:mm")}</p>
                       </div>
                     </div>
                   );
                 })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      {pendingAction && (() => {
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "this customer";
        const configs = {
          suspend:   { title: "Suspend Account",      desc1: "will be temporarily suspended and unable to log in.", desc2: "Confirm you want to suspend this account.", btn1: "Continue", btn2: "Suspend",   destructive: true  },
          unsuspend: { title: "Activate Account",     desc1: "will be unsuspended and regain access.",             desc2: "Confirm you want to reactivate this account.", btn1: "Continue", btn2: "Activate",  destructive: false },
          ban:       { title: "Ban Customer",         desc1: "will be permanently banned from the platform.",      desc2: "This will block the account completely.",      btn1: "Continue", btn2: "Ban",       destructive: true  },
          unban:     { title: "Unban Customer",       desc1: "will be unbanned and regain full access.",           desc2: "Confirm you want to lift the ban.",            btn1: "Continue", btn2: "Unban",     destructive: false },
          delete:    { title: "Delete Customer",      desc1: "and all their data will be permanently deleted.",    desc2: "This cannot be undone. All data will be lost.", btn1: "Continue", btn2: "Delete",   destructive: true  },
        };
        const cfg = configs[pendingAction.type];

        function executeAction() {
          const t = pendingAction!.type;
          setPendingAction(null);
          setConfirmStep(1);
          if (t === "suspend") lockMutation.mutate(true);
          else if (t === "unsuspend") lockMutation.mutate(false);
          else if (t === "ban") banMutation.mutate(true);
          else if (t === "unban") banMutation.mutate(false);
          else if (t === "delete") deleteMutation.mutate();
        }

        return (
          <Dialog open onOpenChange={() => { setPendingAction(null); setConfirmStep(1); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader className="items-center text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 ${confirmStep === 2 && cfg.destructive ? "bg-red-50" : "bg-amber-50"}`}>
                  <AlertTriangle className={`w-7 h-7 ${confirmStep === 2 && cfg.destructive ? "text-red-500" : "text-amber-500"}`} />
                </div>
                <DialogTitle>{confirmStep === 1 ? cfg.title : "Final Confirmation"}</DialogTitle>
                <DialogDescription className="text-center pt-1">
                  {confirmStep === 1 ? (
                    <><span className="font-semibold text-slate-700">{name}</span> {cfg.desc1}</>
                  ) : (
                    <><span className={`font-semibold ${cfg.destructive ? "text-red-600" : "text-slate-700"}`}>{name}</span><br />{cfg.desc2}</>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                {confirmStep === 1 ? (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => { setPendingAction(null); setConfirmStep(1); }}>Cancel</Button>
                    <Button
                      className={`flex-1 ${cfg.destructive ? "bg-amber-500 hover:bg-amber-600" : "bg-orange-500 hover:bg-orange-600"}`}
                      onClick={() => setConfirmStep(2)}
                    >
                      {cfg.btn1}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmStep(1)}>Go Back</Button>
                    <Button
                      className={`flex-1 ${cfg.destructive ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`}
                      onClick={executeAction}
                    >
                      {cfg.btn2}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
