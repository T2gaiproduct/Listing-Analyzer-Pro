import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, CreditCard, Ban, CheckCircle, Trash2, Eye, PauseCircle, PlayCircle, Activity, DollarSign, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customer", userId],
    queryFn: () => fetchCustomerDetail(userId),
  });

  const { data: billingData } = useQuery({
    queryKey: ["admin-customer-payments", userId],
    queryFn: () => fetchCustomerPayments(userId),
  });

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

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`${basePath}/api/admin/customers/${userId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { toast({ title: "Customer deleted" }); setLocation("/admin/customers"); },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { user, audits, auditStats, credits, transactions } = data ?? {};
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
            onClick={() => lockMutation.mutate(!user?.locked)}
            disabled={lockMutation.isPending || user?.banned}
            title={user?.locked ? "Unsuspend account" : "Suspend account (keeps data, blocks login)"}
          >
            {user?.locked ? <PlayCircle className="w-4 h-4 mr-1.5 text-green-600" /> : <PauseCircle className="w-4 h-4 mr-1.5 text-yellow-600" />}
            {user?.locked ? "Activate" : "Suspend"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => banMutation.mutate(!user?.banned)}
            disabled={banMutation.isPending}
          >
            {user?.banned ? <CheckCircle className="w-4 h-4 mr-1.5" /> : <Ban className="w-4 h-4 mr-1.5" />}
            {user?.banned ? "Unban" : "Ban"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => confirm("Delete this customer and all their data?") && deleteMutation.mutate()}
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
          <TabsTrigger value="credits"><CreditCard className="w-4 h-4 mr-1.5" />Credits</TabsTrigger>
          <TabsTrigger value="subscriptions"><Package className="w-4 h-4 mr-1.5" />Subscriptions</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="w-4 h-4 mr-1.5" />Payment History</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-1.5" />Activity</TabsTrigger>
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
                  { label: "AI Credits", value: credits?.aiCredits ?? 0, key: "ai" },
                  { label: "Image Credits", value: credits?.imageCredits ?? 0, key: "image" },
                  { label: "Audit Credits", value: credits?.auditCredits ?? 0, key: "audit" },
                ].map((c) => (
                  <div key={c.key} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-slate-600">{c.label}</span>
                    <span className="font-bold text-slate-900 text-lg">{c.value}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjust Credits</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ label: "AI", key: "ai" as const }, { label: "Image", key: "image" as const }, { label: "Audit", key: "audit" as const }].map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs text-slate-500">{f.label}</Label>
                        <Input type="number" className="h-8 text-xs mt-0.5" placeholder="0"
                          value={creditForm[f.key]}
                          onChange={(e) => setCreditForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <Input className="h-8 text-xs" placeholder="Reason (optional)" value={creditForm.reason}
                    onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))} />
                  <Button size="sm" className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600"
                    onClick={() => creditMutation.mutate({ aiCredits: Number(creditForm.ai) || 0, imageCredits: Number(creditForm.image) || 0, auditCredits: Number(creditForm.audit) || 0, reason: creditForm.reason || "Admin adjustment" })}
                    disabled={creditMutation.isPending}>Apply</Button>
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
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Reason</th>
                          <th className="text-right px-4 py-2 font-medium text-slate-500">Amount</th>
                          <th className="text-right px-4 py-2 font-medium text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t: { id: number; creditType: string; amount: number; reason: string; createdAt: string }) => (
                          <tr key={t.id} className="border-b border-slate-50">
                            <td className="px-4 py-2.5 capitalize text-slate-700">{t.creditType}</td>
                            <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{t.reason || "-"}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${t.amount > 0 ? "text-green-600" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
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
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" /> Subscription & Plan Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Plan Status</p>
                  <p className="font-semibold text-slate-800">
                    {payments.some((p) => p.status === "completed") ? "Paid Subscriber" : "Free / No Active Plan"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Total Payments</p>
                  <p className="font-semibold text-slate-800">{payments.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Lifetime Spend</p>
                  <p className="font-semibold text-green-600">${totalSpend.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Current Credits (plan allocation)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "AI Credits", value: credits?.aiCredits ?? 0 },
                    { label: "Image Credits", value: credits?.imageCredits ?? 0 },
                    { label: "Audit Credits", value: credits?.auditCredits ?? 0 },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-center">
                      <p className="text-xl font-bold text-orange-600">{c.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {invoices.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Invoices</p>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Amount</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 font-medium">#{inv.id}</td>
                          <td className="px-4 py-2.5">${inv.amount.toFixed(2)} {inv.currency}</td>
                          <td className="px-4 py-2.5"><Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs">{inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {invoices.length === 0 && payments.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No subscription data yet. This user is on the free tier.</p>
              )}
            </CardContent>
          </Card>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
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
                {/* Account events from what we know */}
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
                  ...(transactions ?? []).slice(0, 3).map((t: { id: number; creditType: string; amount: number; reason: string; createdAt: string }) => ({
                    date: new Date(t.createdAt),
                    event: `Credits ${t.amount > 0 ? "added" : "deducted"}: ${Math.abs(t.amount)} ${t.creditType}${t.reason ? ` (${t.reason})` : ""}`,
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
                {!user && <p className="text-sm text-slate-400 text-center py-6">No activity data available.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
