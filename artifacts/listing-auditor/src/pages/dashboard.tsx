import { Link } from "wouter";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getAuditStats, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Plus, ArrowUpRight, TrendingUp, AlertTriangle, ShieldCheck, Target, Loader2, Search, Coins } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/use-team";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useCredits() {
  return useQuery({
    queryKey: ["user-subscription"],
    queryFn: () => fetch(`${basePath}/api/user-subscription`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: getGetAuditStatsQueryKey(),
    queryFn: getAuditStats,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const { data: sub } = useCredits();
  const { canEdit, isTeamMember, role } = useTeam();
  const credits = sub?.credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const totalAi = sub?.plan?.planAiCredits ?? 0;
  const totalImage = sub?.plan?.planImageCredits ?? 0;
  const totalAudit = sub?.plan?.planAuditCredits ?? 0;
  const alloc = sub?.plan?.creditAllocations as Record<string, number> | undefined;
  const lowAudit = totalAudit > 0 && credits.auditCredits <= Math.max(1, totalAudit * 0.15);
  const lowContent = (alloc?.content ?? totalAi) > 0 && credits.aiCredits <= Math.max(1, (alloc?.content ?? totalAi) * 0.15);
  const lowImage = totalImage > 0 && credits.imageCredits <= Math.max(1, totalImage * 0.15);
  const lowEbc = (alloc?.ebc ?? 0) > 0 && credits.aiCredits <= Math.max(1, (alloc?.ebc ?? 0) * 0.15);
  const lowComp = (alloc?.competitors ?? 0) > 0 && credits.auditCredits <= Math.max(1, (alloc?.competitors ?? 0) * 0.15);
  const anyLow = lowAudit || lowContent || lowImage || lowEbc || lowComp;

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statCards = [
    { title: "Total Audits", value: stats?.totalAudits || 0, icon: Target, desc: "Listings analyzed" },
    { title: "Average Score", value: stats?.averageScore || 0, icon: TrendingUp, desc: "Across all audits", isScore: true },
    { title: "High Scores", value: stats?.highScoreCount || 0, icon: ShieldCheck, desc: "Scores 70+" },
    { title: "Needs Work", value: stats?.lowScoreCount || 0, icon: AlertTriangle, desc: "Scores < 50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Low credit banner */}
      {anyLow && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm">Low Credits Warning</p>
            <p className="text-red-600/80 text-xs mt-0.5">
              {lowAudit && "Audit credits running low. "}
              {lowContent && "Text content credits running low. "}
              {lowImage && "Image credits running low. "}
              {lowEbc && "A+ / EBC credits running low. "}
              {lowComp && "Competitor analysis credits running low. "}
              Purchase more to avoid interruptions.
            </p>
          </div>
          <Button asChild size="sm" className="bg-red-500 hover:bg-red-600 text-white flex-shrink-0">
            <Link href="/billing">Buy Credits</Link>
          </Button>
        </div>
      )}

      <div className="flex items-end justify-between border-b pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-lg">Your portfolio performance at a glance.</p>
          {isTeamMember && (
            <p className="text-xs text-muted-foreground mt-1">Team role: <span className="font-medium capitalize">{role}</span></p>
          )}
        </div>
        {canEdit && (
          <Button asChild size="lg" className="shadow-md">
            <Link href="/audits/new">
              <Plus className="w-5 h-5 mr-2" />
              New Audit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                  {stat.isScore ? (
                    <div className="text-3xl font-bold font-mono tracking-tighter">
                      <span className={stat.value >= 70 ? "text-emerald-500" : stat.value >= 50 ? "text-amber-500" : "text-rose-500"}>
                        {stat.value}
                      </span>
                      <span className="text-muted-foreground text-xl">/100</span>
                    </div>
                  ) : (
                    <p className="text-4xl font-bold font-mono tracking-tighter">{stat.value}</p>
                  )}
                </div>
                <div className="p-3 bg-secondary/5 rounded-lg text-secondary">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit summary strip */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="w-5 h-5 text-orange-500" />
            Credit Balance
          </CardTitle>
          <CardDescription>Your current credit pool across all activity types</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const a = sub?.plan?.creditAllocations as Record<string, number> | undefined;
            const colorMap: Record<string, { bg: string; border: string; text: string; barBg: string; barFill: string }> = {
              orange: { bg: "bg-orange-50/60", border: "border-orange-100", text: "text-orange-600", barBg: "bg-orange-100", barFill: "bg-orange-400" },
              blue: { bg: "bg-blue-50/60", border: "border-blue-100", text: "text-blue-600", barBg: "bg-blue-100", barFill: "bg-blue-400" },
              purple: { bg: "bg-purple-50/60", border: "border-purple-100", text: "text-purple-600", barBg: "bg-purple-100", barFill: "bg-purple-400" },
              emerald: { bg: "bg-emerald-50/60", border: "border-emerald-100", text: "text-emerald-600", barBg: "bg-emerald-100", barFill: "bg-emerald-400" },
              slate: { bg: "bg-slate-50/60", border: "border-slate-100", text: "text-slate-600", barBg: "bg-slate-100", barFill: "bg-slate-400" },
            };
            const items = [
              { label: "Audit Credits", ...colorMap["orange"], used: credits.auditCredits ?? 0, total: a?.audit ?? totalAudit ?? 0, key: "audit" },
              { label: "Text Content", ...colorMap["blue"], used: credits.aiCredits ?? 0, total: a?.content ?? totalAi ?? 0, key: "content" },
              { label: "Image Credits", ...colorMap["purple"], used: credits.imageCredits ?? 0, total: a?.images ?? totalImage ?? 0, key: "images" },
              { label: "A+ / EBC", ...colorMap["emerald"], used: credits.aiCredits ?? 0, total: a?.ebc ?? 0, key: "ebc" },
              { label: "Competitors", ...colorMap["slate"], used: credits.auditCredits ?? 0, total: a?.competitors ?? 0, key: "competitors" },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {items.map((it) => {
                  const pct = it.total > 0 ? Math.min(100, (it.used / it.total) * 100) : 0;
                  const low = it.total > 0 && it.used <= Math.max(1, it.total * 0.15);
                  return (
                    <div key={it.key} className={`${it.bg} border ${it.border} rounded-xl p-4 ${low ? "ring-2 ring-red-200" : ""}`}>
                      <p className={`text-xs font-medium ${it.text} uppercase flex items-center gap-1`}>
                        {it.label}
                        {low && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{it.used.toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ {it.total > 0 ? it.total.toLocaleString() : "∞"}</span></p>
                      {it.total > 0 && <div className={`mt-2 h-1.5 ${it.barBg} rounded-full overflow-hidden`}><div className={`h-full ${it.barFill} rounded-full`} style={{ width: `${pct}%` }} /></div>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Recent Audits</h2>

        {(!stats?.recentAudits || stats.recentAudits.length === 0) ? (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">No audits yet</h3>
              <p className="text-muted-foreground max-w-sm mb-6">Start by analyzing your first Amazon listing to uncover SEO opportunities and content improvements.</p>
              {canEdit && (
                <Button asChild>
                  <Link href="/audits/new">Create First Audit</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {stats.recentAudits.map((audit) => (
              <Link key={audit.id} href={`/audits/${audit.id}`}>
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer border-border/50">
                  <CardContent className="p-6 flex items-center gap-6">
                    <ScoreRing score={audit.overallScore} size="sm" showLabel={false} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {audit.productName}
                        </h3>
                        {audit.status === "pending" && (
                          <span className="inline-flex items-center text-xs font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing
                          </span>
                        )}
                        {audit.status === "failed" && (
                          <span className="inline-flex items-center text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {audit.asin && <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/70">ASIN: {audit.asin}</span>}
                        {audit.category && <span className="text-xs uppercase tracking-wider">{audit.category}</span>}
                        <span>•</span>
                        <span>{format(new Date(audit.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
