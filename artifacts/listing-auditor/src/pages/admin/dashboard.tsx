import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Users, FileText, TrendingUp, AlertTriangle,
  UserPlus, Activity, Clock, CheckCircle, ArrowRight,
  CalendarDays, LogIn, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";

interface ClerkUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string | null;
  createdAt: number;
  lastSignInAt: number | null;
  banned: boolean;
}

interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
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
  recentSignups: ClerkUser[];
  recentLogins: ClerkUser[];
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchAdminStats(): Promise<AdminStats> {
  return fetch(`${basePath}/api/admin/stats`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch admin stats");
    return r.json();
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-700" :
    score >= 50 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
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

function UserRow({ user, showSignIn }: { user: ClerkUser; showSignIn?: boolean }) {
  const [, nav] = useLocation();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Anonymous";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const timestamp = showSignIn ? user.lastSignInAt : user.createdAt;

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors"
      onClick={() => nav(`/admin/customers/${user.id}`)}
    >
      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt={name} className="w-8 h-8 object-cover" />
        ) : (
          <span className="text-xs font-bold text-orange-700">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
        <p className="text-xs text-slate-400 truncate">{user.email}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {user.banned && <Badge variant="destructive" className="text-xs mb-1">Banned</Badge>}
        {timestamp ? (
          <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</p>
        ) : (
          <p className="text-xs text-slate-300">Never</p>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return <div className="h-6 w-16 bg-slate-200 rounded animate-pulse mt-1" />;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats, staleTime: 0, refetchInterval: 30_000 });
  const [, nav] = useLocation();

  const kpis = [
    {
      label: "Total Users",
      value: data?.totalUsers ?? 0,
      sub: data ? `+${data.newUsersThisMonth} this month` : "",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "New Today",
      value: data?.newUsersToday ?? 0,
      sub: data ? `+${data.newUsersThisWeek} this week` : "",
      icon: UserPlus,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Total Audits",
      value: data?.totalAudits ?? 0,
      sub: data ? `Avg score: ${data.averageScore}/100` : "",
      icon: FileText,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "High Scores",
      value: data?.highScoreCount ?? 0,
      sub: data ? `${data.lowScoreCount} low score` : "",
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Platform-wide overview — {format(new Date(), "MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => nav("/admin/customers")}>
            <Users className="w-4 h-4 mr-1.5" /> All Customers
          </Button>
          <Button variant="outline" size="sm" onClick={() => nav("/admin/audits")}>
            <FileText className="w-4 h-4 mr-1.5" /> All Audits
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
              </div>
              {isLoading ? <KpiSkeleton /> : (
                <>
                  <p className="text-3xl font-bold text-slate-900">{kpi.value.toLocaleString()}</p>
                  {kpi.sub && <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Signup trend banner */}
      {!isLoading && data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Signups today", value: data.newUsersToday, icon: CalendarDays, color: "text-emerald-600 bg-emerald-50" },
            { label: "Signups this week", value: data.newUsersThisWeek, icon: Activity, color: "text-blue-600 bg-blue-50" },
            { label: "Signups this month", value: data.newUsersThisMonth, icon: UserPlus, color: "text-orange-600 bg-orange-50" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-3 rounded-xl px-5 py-3 ${item.color.split(" ")[1]}`}>
              <item.icon className={`w-5 h-5 flex-shrink-0 ${item.color.split(" ")[0]}`} />
              <div>
                <p className={`text-xl font-bold ${item.color.split(" ")[0]}`}>{item.value}</p>
                <p className="text-xs text-slate-600">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent audits */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Recent Audits
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => nav("/admin/audits")}>
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
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
                      <tr
                        key={audit.id}
                        className="border-b border-slate-50 hover:bg-orange-50/40 cursor-pointer group"
                        onClick={() => nav(`/audits/${audit.id}`)}
                      >
                        <td className="px-6 py-3 font-medium text-slate-800 truncate max-w-[180px] group-hover:text-orange-700 transition-colors">{audit.productName}</td>
                        <td className="px-4 py-3"><ScoreBadge score={audit.overallScore} /></td>
                        <td className="px-4 py-3"><StatusBadge status={audit.status} /></td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs">
                          {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Eye className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 transition-colors inline-block" />
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

        {/* Right column */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400" /> Audits by Status
              </CardTitle>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-400" /> Score Breakdown
              </CardTitle>
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

      {/* Recent Signups + Recent Logins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-500" /> Recent Sign-ups
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => nav("/admin/customers")}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : data?.recentSignups.length ? (
              data.recentSignups.map((u) => <UserRow key={u.id} user={u} showSignIn={false} />)
            ) : (
              <p className="text-slate-400 text-sm p-4 text-center">No recent sign-ups</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Logins */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-blue-500" /> Recent Logins
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => nav("/admin/customers")}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : data?.recentLogins.length ? (
              data.recentLogins.map((u) => <UserRow key={u.id} user={u} showSignIn={true} />)
            ) : (
              <p className="text-slate-400 text-sm p-4 text-center">No recent logins</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment status note */}
      <Card className="border-0 shadow-sm bg-orange-50/60">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Payment & Subscription Status</p>
            <p className="text-xs text-slate-500 mt-1">
              Manage each customer's credits, plan, and subscription from the <button className="text-orange-600 underline font-medium" onClick={() => nav("/admin/customers")}>Customers</button> tab.
              Click any user to view their plan, audit history, and make credit adjustments.
              Payment gateway integration (Stripe) can be connected under <button className="text-orange-600 underline font-medium" onClick={() => nav("/admin/plans")}>Plans</button>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
