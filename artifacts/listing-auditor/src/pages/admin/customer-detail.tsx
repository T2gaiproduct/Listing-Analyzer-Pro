import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, CreditCard, Ban, CheckCircle, Trash2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchCustomerDetail(userId: string) {
  return fetch(`${basePath}/api/admin/customers/${userId}`, { credentials: "include" }).then((r) => r.json());
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

  const banMutation = useMutation({
    mutationFn: (ban: boolean) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${ban ? "ban" : "unban"}`, {
        method: "PATCH",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customer", userId] }); toast({ title: "Status updated" }); },
  });

  const creditMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/credits/${userId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer", userId] });
      setCreditForm({ ai: "", image: "", audit: "", reason: "" });
      toast({ title: "Credits updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/admin/customers/${userId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { toast({ title: "Customer deleted" }); setLocation("/admin/customers"); },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { user, audits, auditStats, credits, transactions } = data ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/customers")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Customers
        </Button>
      </div>

      <div className="flex items-center justify-between">
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
            <div className="flex gap-2 mt-1.5">
              {user?.banned ? <Badge variant="destructive">Banned</Badge> : <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>}
              <span className="text-xs text-slate-400">
                Joined {user?.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Audit History
                <span className="ml-auto text-sm font-normal text-slate-400">{auditStats?.total ?? 0} total · avg {auditStats?.averageScore ?? 0}/100</span>
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
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 hover:bg-orange-50/40 cursor-pointer group"
                      onClick={() => setLocation(`/audits/${a.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-slate-800 truncate max-w-[200px] group-hover:text-orange-700 transition-colors">{a.productName}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${a.overallScore >= 70 ? "bg-green-100 text-green-700" : a.overallScore >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {a.overallScore}
                        </span>
                      </td>
                      <td className="px-3 py-3 capitalize text-xs text-slate-500">{a.status}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{format(new Date(a.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-slate-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/audits/${a.id}`); }}
                          title="View full audit"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!audits?.length && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">No audits</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-500" /> Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "AI Credits", value: credits?.aiCredits ?? 0, key: "ai" },
                { label: "Image Credits", value: credits?.imageCredits ?? 0, key: "image" },
                { label: "Audit Credits", value: credits?.auditCredits ?? 0, key: "audit" },
              ].map((c) => (
                <div key={c.key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-600">{c.label}</span>
                  <span className="font-bold text-slate-900">{c.value}</span>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjust Credits</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "AI", key: "ai" as const },
                    { label: "Image", key: "image" as const },
                    { label: "Audit", key: "audit" as const },
                  ].map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs text-slate-500">{f.label}</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs mt-0.5"
                        placeholder="0"
                        value={creditForm[f.key]}
                        onChange={(e) => setCreditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <Input
                  className="h-8 text-xs"
                  placeholder="Reason (optional)"
                  value={creditForm.reason}
                  onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))}
                />
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600"
                  onClick={() =>
                    creditMutation.mutate({
                      aiCredits: Number(creditForm.ai) || 0,
                      imageCredits: Number(creditForm.image) || 0,
                      auditCredits: Number(creditForm.audit) || 0,
                      reason: creditForm.reason || "Admin adjustment",
                    })
                  }
                  disabled={creditMutation.isPending}
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          {transactions && transactions.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transactions.slice(0, 5).map((t: { id: number; creditType: string; amount: number; reason: string; createdAt: string }) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="capitalize text-slate-600">{t.creditType}</span>
                      {t.reason && <p className="text-slate-400 truncate max-w-[120px]">{t.reason}</p>}
                    </div>
                    <span className={`font-semibold ${t.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
