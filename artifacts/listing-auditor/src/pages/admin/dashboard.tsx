import { useQuery } from "@tanstack/react-query";
import { Users, FileText, TrendingUp, AlertTriangle, Star, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface AdminStats {
  totalUsers: number;
  totalAudits: number;
  averageScore: number;
  highScoreCount: number;
  lowScoreCount: number;
  auditsByStatus: Record<string, number>;
  recentAudits: Array<{
    id: number;
    userId: string;
    productName: string;
    overallScore: number;
    status: string;
    createdAt: string;
  }>;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchAdminStats(): Promise<AdminStats> {
  return fetch(`${basePath}/api/admin/stats`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch admin stats");
    return r.json();
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{score}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats });

  const kpis = [
    {
      label: "Total Users",
      value: data?.totalUsers ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Audits",
      value: data?.totalAudits ?? 0,
      icon: FileText,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Avg Score",
      value: data ? `${data.averageScore}/100` : "—",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Low Score Audits",
      value: data?.lowScoreCount ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Platform-wide overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
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
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">Recent Audits</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentAudits.map((audit) => (
                      <tr key={audit.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-800 truncate max-w-[180px]">{audit.productName}</td>
                        <td className="px-4 py-3"><ScoreBadge score={audit.overallScore} /></td>
                        <td className="px-4 py-3"><StatusBadge status={audit.status} /></td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs">
                          {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                    {!data?.recentAudits.length && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No audits yet</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">Audits by Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
                </div>
              ) : data?.auditsByStatus && Object.keys(data.auditsByStatus).length > 0 ? (
                Object.entries(data.auditsByStatus).map(([status, c]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-semibold text-slate-700">{c}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No data</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700 font-medium">High (≥70)</span>
                    <span className="font-bold text-green-700">{data?.highScoreCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700 font-medium">Low (&lt;50)</span>
                    <span className="font-bold text-red-700">{data?.lowScoreCount ?? 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
