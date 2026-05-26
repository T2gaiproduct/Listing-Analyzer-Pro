import { Link } from "wouter";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getAuditStats, getGetAuditStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Plus, ArrowUpRight, TrendingUp, AlertTriangle, ShieldCheck, Target, Loader2, Search, Coins } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const credits = sub?.credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const totalAi = sub?.plan?.planAiCredits ?? 0;
  const totalImage = sub?.plan?.planImageCredits ?? 0;
  const totalAudit = sub?.plan?.planAuditCredits ?? 0;
  const lowAi = totalAi > 0 && credits.aiCredits <= Math.max(1, totalAi * 0.15);
  const lowImage = totalImage > 0 && credits.imageCredits <= Math.max(1, totalImage * 0.15);
  const lowAudit = totalAudit > 0 && credits.auditCredits <= Math.max(1, totalAudit * 0.15);
  const anyLow = lowAi || lowImage || lowAudit;

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
              {lowAi && "AI credits running low. "}
              {lowImage && "Image credits running low. "}
              {lowAudit && "Audit credits running low. "}
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
        </div>
        <Button asChild size="lg" className="shadow-md">
          <Link href="/audits/new">
            <Plus className="w-5 h-5 mr-2" />
            New Audit
          </Link>
        </Button>
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
          <CardDescription>Your current credit pool across all types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 uppercase">AI Content</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{credits.aiCredits.toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ {totalAi > 0 ? totalAi.toLocaleString() : "∞"}</span></p>
              {totalAi > 0 && <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (credits.aiCredits / totalAi) * 100)}%` }} /></div>}
            </div>
            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4">
              <p className="text-xs font-medium text-purple-600 uppercase">Images</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{credits.imageCredits.toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ {totalImage > 0 ? totalImage.toLocaleString() : "∞"}</span></p>
              {totalImage > 0 && <div className="mt-2 h-1.5 bg-purple-100 rounded-full overflow-hidden"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(100, (credits.imageCredits / totalImage) * 100)}%` }} /></div>}
            </div>
            <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-medium text-orange-600 uppercase">Audits</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{credits.auditCredits.toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ {totalAudit > 0 ? totalAudit.toLocaleString() : "∞"}</span></p>
              {totalAudit > 0 && <div className="mt-2 h-1.5 bg-orange-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, (credits.auditCredits / totalAudit) * 100)}%` }} /></div>}
            </div>
          </div>
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
              <Button asChild>
                <Link href="/audits/new">Create First Audit</Link>
              </Button>
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
