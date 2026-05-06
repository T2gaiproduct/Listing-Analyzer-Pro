import { Link } from "wouter";
import { format } from "date-fns";
import { useGetAuditStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Plus, ArrowUpRight, TrendingUp, AlertTriangle, ShieldCheck, Target, Loader2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetAuditStats();

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
