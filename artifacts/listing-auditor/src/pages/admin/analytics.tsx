import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { ResponsiveTable } from "@/components/responsive-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Analytics {
  auditsByDay: Array<{ day: string; count: number; avgScore: string }>;
  scoreDistribution: Array<{ bucket: string; count: number }>;
  topUsers: Array<{ userId: string; auditCount: number; avgScore: string }>;
  categoryBreakdown: Array<{ category: string | null; c: number; avg: string }>;
}

function fetchAnalytics(): Promise<Analytics> {
  return fetch(`${basePath}/api/admin/analytics`, { credentials: "include" }).then((r) => r.json());
}

const COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: fetchAnalytics });

  const auditsByDay = (data?.auditsByDay ?? []).map((d) => ({
    day: format(new Date(d.day), "MMM d"),
    Audits: Number(d.count),
    "Avg Score": Math.round(Number(d.avgScore)),
  }));

  const scoreDistribution = (data?.scoreDistribution ?? []).map((d) => ({
    name: d.bucket,
    value: Number(d.count),
  }));

  const categoryBreakdown = (data?.categoryBreakdown ?? [])
    .filter((d) => d.category)
    .map((d) => ({
      name: d.category as string,
      Audits: Number(d.c),
      "Avg Score": Math.round(Number(d.avg)),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Platform usage over the last 30 days</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Audits Per Day (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            ) : auditsByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={auditsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="Audits" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Avg Score Per Day (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            ) : auditsByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={auditsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Line type="monotone" dataKey="Avg Score" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            ) : scoreDistribution.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No completed audits</div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={scoreDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                      {scoreDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {scoreDistribution.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600 flex-1">{d.name}</span>
                      <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Audits by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            ) : categoryBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No categorized audits yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryBreakdown} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="Audits" fill="#f97316" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.topUsers ?? []).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Users by Audit Volume</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveTable minWidth="28rem">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">User ID</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Audits</th>
                  <th className="text-right px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {data?.topUsers.map((u, i) => (
                  <tr key={u.userId} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-2.5 text-slate-400 text-xs font-medium">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 truncate max-w-[260px]">{u.userId}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{u.auditCount}</td>
                    <td className="px-6 py-2.5 text-right">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${Number(u.avgScore) >= 70 ? "bg-green-100 text-green-700" : Number(u.avgScore) >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {Math.round(Number(u.avgScore))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
