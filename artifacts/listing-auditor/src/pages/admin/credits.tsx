import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, TrendingUp, Zap, Image, BarChart3, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CreditRow {
  id: number;
  userId: string;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  updatedAt: string;
}

interface Analytics {
  transactions: {
    id: number;
    userId: string;
    creditType: string;
    amount: number;
    reason: string | null;
    featureType: string | null;
    createdAt: string;
  }[];
  topUsers: { userId: string; ai: number; image: number; audit: number; count: number; total: number }[];
  featureBreakdown: { feature: string; ai: number; image: number; audit: number; count: number; total: number }[];
}

const FEATURE_LABELS: Record<string, string> = {
  subscription: "Plan Allocation", ai_content: "AI Content Generation",
  ai_audit: "Listing Audit", image_gen: "Image Generation",
  image_edit: "Image Editing", export: "Export",
  admin_adjustment: "Admin Adjustment", other: "Other",
};

function featureLabel(ft: string) {
  return FEATURE_LABELS[ft] ?? ft;
}

function fetchCredits(): Promise<CreditRow[]> {
  return fetch(`${basePath}/api/admin/credits`, { credentials: "include" }).then((r) => r.json());
}
function fetchAnalytics(): Promise<Analytics> {
  return fetch(`${basePath}/api/admin/credits/analytics`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminCredits() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: credits = [], isLoading } = useQuery({ queryKey: ["admin-credits"], queryFn: fetchCredits });
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-credits-analytics"],
    queryFn: fetchAnalytics,
    enabled: activeTab !== "overview",
  });

  const totals = credits.reduce(
    (acc, c) => ({ ai: acc.ai + c.aiCredits, image: acc.image + c.imageCredits, audit: acc.audit + c.auditCredits }),
    { ai: 0, image: 0, audit: 0 }
  );

  const totalConsumed = (analytics?.featureBreakdown ?? []).reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Credits</h1>
        <p className="text-slate-500 text-sm mt-1">Platform-wide credit balances, usage analytics, and top consumers.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total AI Credits Remaining", value: totals.ai, icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Total Image Credits Remaining", value: totals.image, icon: Image, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Audit Credits Remaining", value: totals.audit, icon: BarChart3, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                {isLoading ? (
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{kpi.value.toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview"><CreditCard className="w-4 h-4 mr-1.5" />User Balances</TabsTrigger>
          <TabsTrigger value="feature"><Activity className="w-4 h-4 mr-1.5" />Feature Usage</TabsTrigger>
          <TabsTrigger value="top-users"><Users className="w-4 h-4 mr-1.5" />Top Consumers</TabsTrigger>
          <TabsTrigger value="transactions"><TrendingUp className="w-4 h-4 mr-1.5" />Transaction Log</TabsTrigger>
        </TabsList>

        {/* ── User Balances ── */}
        <TabsContent value="overview">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">User Credit Balances</CardTitle>
            </CardHeader>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User ID</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">AI</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Image</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Audit</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))}
                {!isLoading && credits.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500 truncate max-w-[200px]">{c.userId}</td>
                    <td className="px-4 py-3 text-right font-semibold text-purple-700">{c.aiCredits}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{c.imageCredits}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-700">{c.auditCredits}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-400">{formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}</td>
                  </tr>
                ))}
                {!isLoading && credits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400">No credit records yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ── Feature Usage ── */}
        <TabsContent value="feature">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500">
              Total credits consumed across all features: <span className="font-bold text-slate-900">{totalConsumed.toLocaleString()}</span>
            </div>
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Credit Usage by Feature</CardTitle>
              </CardHeader>
              {analyticsLoading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Feature</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">AI Used</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Image Used</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Audit Used</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Transactions</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.featureBreakdown ?? []).map((f) => (
                      <tr key={f.feature} className="border-b border-slate-50">
                        <td className="px-6 py-3">
                          <span className="text-sm font-medium text-slate-800">{featureLabel(f.feature)}</span>
                          <span className="ml-2 text-xs text-slate-400">({f.feature})</span>
                        </td>
                        <td className="px-4 py-3 text-right text-purple-700 font-semibold">{f.ai.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-blue-700 font-semibold">{f.image.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-orange-700 font-semibold">{f.audit.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{f.count}</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-900">{f.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    {!analyticsLoading && (analytics?.featureBreakdown ?? []).length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">No usage data yet</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Top Consumers ── */}
        <TabsContent value="top-users">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" />Highest Consuming Users
              </CardTitle>
            </CardHeader>
            {analyticsLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">User ID</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">AI</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Image</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Audit</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Transactions</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Total Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.topUsers ?? []).map((u, idx) => (
                    <tr key={u.userId} className="border-b border-slate-50">
                      <td className="px-6 py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-yellow-100 text-yellow-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 truncate max-w-[180px]">{u.userId}</td>
                      <td className="px-4 py-3 text-right text-purple-700 font-semibold">{u.ai.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-semibold">{u.image.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-orange-700 font-semibold">{u.audit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{u.count}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">{u.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {!analyticsLoading && (analytics?.topUsers ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-sm">No usage data yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* ── Transaction Log ── */}
        <TabsContent value="transactions">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />Recent Transactions
                <Badge variant="outline" className="ml-auto">{(analytics?.transactions ?? []).length} recent</Badge>
              </CardTitle>
            </CardHeader>
            {analyticsLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Feature</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Reason</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.transactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-400 truncate max-w-[140px]">{tx.userId.slice(0, 16)}…</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${tx.creditType === "ai" ? "bg-blue-50 text-blue-700" : tx.creditType === "image" ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"}`}>{tx.creditType}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{featureLabel(tx.featureType ?? "other")}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 truncate max-w-[150px]">{tx.reason ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        <span className={tx.amount > 0 ? "text-green-600" : "text-red-500"}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-slate-400">{format(new Date(tx.createdAt), "MMM d, HH:mm")}</td>
                    </tr>
                  ))}
                  {!analyticsLoading && (analytics?.transactions ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
