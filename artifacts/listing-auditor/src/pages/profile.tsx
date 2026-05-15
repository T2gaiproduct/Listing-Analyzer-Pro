import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { User, Building2, Phone, Globe, CreditCard, Zap, Image, BarChart3, Edit2, Save, X, Calendar, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProfileData {
  profile: {
    userId: string;
    fullName: string | null;
    companyName: string | null;
    phone: string | null;
    country: string | null;
    onboardingCompleted: boolean;
  } | null;
  subscription: {
    status: string;
    planName: string | null;
    billingCycle: string;
    priceMonthly: number;
    priceYearly: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cardLast4: string | null;
    cardBrand: string | null;
    autoRenew: boolean;
    planAiCredits: number;
    planImageCredits: number;
    planAuditCredits: number;
  } | null;
  credits: {
    aiCredits: number;
    imageCredits: number;
    auditCredits: number;
  };
  transactions: {
    id: number;
    creditType: string;
    amount: number;
    reason: string | null;
    createdAt: string;
  }[];
}

function CreditBar({ label, icon: Icon, used, total, color, bg }: { label: string; icon: React.ElementType; used: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const remaining = Math.max(0, total - used);
  const isLow = pct >= 80;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <div className="text-right">
          <span className={`text-xs font-bold ${isLow ? "text-red-500" : "text-slate-700"}`}>{used.toLocaleString()} used</span>
          <span className="text-xs text-slate-400"> / {total.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs mt-1 ${isLow ? "text-red-500 font-medium" : "text-slate-400"}`}>
        {remaining.toLocaleString()} remaining{isLow ? " — running low!" : ""}
      </p>
    </div>
  );
}

export default function Profile() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", companyName: "", phone: "", country: "" });

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["user-profile"],
    queryFn: () => fetch(`${basePath}/api/profile`, { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        fullName: data.profile.fullName ?? user?.fullName ?? "",
        companyName: data.profile.companyName ?? "",
        phone: data.profile.phone ?? "",
        country: data.profile.country ?? "",
      });
    }
  }, [data, user]);

  const updateMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/profile`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-profile"] }); setEditing(false); toast({ title: "Profile updated" }); },
  });

  const sub = data?.subscription;
  const credits = data?.credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const usedAi = Math.max(0, (sub?.planAiCredits ?? 0) - credits.aiCredits);
  const usedImage = Math.max(0, (sub?.planImageCredits ?? 0) - credits.imageCredits);
  const usedAudit = Math.max(0, (sub?.planAuditCredits ?? 0) - credits.auditCredits);

  function statusBadge(status: string) {
    if (status === "active") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    if (status === "trial") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" />Free Trial</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">{status}</Badge>;
  }

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account details and subscription</p>
        </div>
      </div>

      {/* Profile info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={user.fullName ?? "Avatar"} className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-100" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                <User className="w-7 h-7 text-orange-500" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{form.fullName || user?.fullName || "Your Name"}</CardTitle>
              <p className="text-sm text-slate-400">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-1" />{updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="w-4 h-4 mr-1" />Edit Profile</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><User className="w-3 h-3" />Full Name</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.fullName || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Building2 className="w-3 h-3" />Company / Brand</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.companyName || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><User className="w-3 h-3" />Email Address</Label>
              <p className="text-sm text-slate-600 mt-1">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Phone className="w-3 h-3" />Phone Number</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.phone || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Globe className="w-3 h-3" />Country</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.country || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-500">Member Since</Label>
              <p className="text-sm text-slate-600 mt-1">{user?.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Subscription</CardTitle>
          {sub && statusBadge(sub.status)}
        </CardHeader>
        <CardContent>
          {sub ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-0.5">Current Plan</p>
                  <p className="font-bold text-slate-900">{sub.planName}</p>
                  <p className="text-xs text-slate-500">${sub.billingCycle === "yearly" ? sub.priceYearly : sub.priceMonthly}/mo</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-0.5">Billing Cycle</p>
                  <p className="font-bold text-slate-900 capitalize">{sub.billingCycle}</p>
                  <p className="text-xs text-slate-500">{sub.billingCycle === "yearly" ? "Billed annually" : "Billed monthly"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
                    <Calendar className="w-3 h-3" />
                    {sub.status === "trial" ? "Trial Ends" : "Next Renewal"}
                  </div>
                  <p className="font-bold text-slate-900 text-sm">
                    {sub.status === "trial" && sub.trialEndsAt
                      ? format(new Date(sub.trialEndsAt), "MMM d, yyyy")
                      : sub.currentPeriodEnd
                        ? format(new Date(sub.currentPeriodEnd), "MMM d, yyyy")
                        : "—"}
                  </p>
                </div>
              </div>

              {/* Payment method */}
              {sub.cardLast4 && (
                <div className="flex items-center gap-3 border border-slate-200 rounded-xl p-4">
                  <div className="w-10 h-7 bg-slate-900 rounded flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{sub.cardBrand} ending in {sub.cardLast4}</p>
                    <p className="text-xs text-slate-400">Auto-renewal {sub.autoRenew ? "enabled" : "disabled"}</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto text-xs h-7">Update</Button>
                </div>
              )}

              {sub.status === "trial" && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-800">You're on a free trial</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {sub.trialEndsAt ? `Your trial ends ${format(new Date(sub.trialEndsAt), "MMMM d, yyyy")}. Add a payment method to continue after the trial.` : "Add a payment method to continue after the trial."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No active subscription</p>
              <Button className="mt-3 bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => window.location.href = "/onboarding"}>Choose a Plan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credits */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credit Usage</CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">Credits reset at the start of each billing period</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <CreditBar label="AI Content Credits" icon={Zap} used={usedAi} total={sub?.planAiCredits ?? credits.aiCredits} color="text-blue-500" bg="bg-blue-50" />
          <CreditBar label="Image Generation Credits" icon={Image} used={usedImage} total={sub?.planImageCredits ?? credits.imageCredits} color="text-purple-500" bg="bg-purple-50" />
          <CreditBar label="Audit Credits" icon={BarChart3} used={usedAudit} total={sub?.planAuditCredits ?? credits.auditCredits} color="text-orange-500" bg="bg-orange-50" />
        </CardContent>
      </Card>

      {/* Credit transaction log */}
      {data?.transactions && data.transactions.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Credit History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">Type</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Reason</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">Amount</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5">
                      <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${tx.creditType === "ai" ? "bg-blue-50 text-blue-700" : tx.creditType === "image" ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"}`}>{tx.creditType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{tx.reason ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">
                      <span className={tx.amount > 0 ? "text-green-600" : "text-red-500"}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-slate-400">{format(new Date(tx.createdAt), "MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
