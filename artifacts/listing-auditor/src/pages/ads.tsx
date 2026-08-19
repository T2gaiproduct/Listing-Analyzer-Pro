import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  Target,
  BarChart2,
  SlidersHorizontal,
  Wallet,
  ArrowRight,
  TrendingUp,
  Loader2,
  Megaphone,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAdsProjects } from "@/lib/ads-api";
import { MANAGE_ADS_NAV_ITEMS } from "@/lib/ads-nav";

function HeroIllustration() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-orange-50/60 border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#232F3E] flex items-center justify-center">
              <span className="text-[#FF9900] font-bold text-sm leading-none">a</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-16 rounded-full bg-slate-200" />
              <div className="h-1.5 w-10 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-100 p-4 mb-3 shadow-sm">
          <div className="flex items-end justify-between gap-1 h-20 mb-2">
            {[35, 50, 42, 65, 58, 78, 92].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/80 to-primary/40"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <svg viewBox="0 0 200 40" className="w-full h-8" aria-hidden="true">
            <polyline
              fill="none"
              stroke="hsl(28 100% 50%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,32 30,28 60,22 90,18 120,12 150,8 180,4 200,2"
            />
            <circle cx="200" cy="2" r="3" fill="hsl(28 100% 50%)" />
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "ROAS", value: "4.2x" },
            { label: "ACOS", value: "18%" },
            { label: "Spend", value: "$2.4k" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-orange-100/80 border-4 border-white shadow-sm flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-full bg-white border border-orange-100 shadow-sm flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-primary/70" />
        </div>
      </div>
    </div>
  );
}

/** Manage Ads home — hub for AI campaign wizard + SellerMate-style console */
export default function AdsPage() {
  const [, nav] = useLocation();
  const projectsQuery = useQuery({
    queryKey: ["ads-projects"],
    queryFn: fetchAdsProjects,
  });

  const projects = projectsQuery.data?.projects ?? [];
  const consoleItems = MANAGE_ADS_NAV_ITEMS.filter((item) => item.href !== "/ads");

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <div className="relative bg-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-border overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, rgba(251,191,100,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 5%, rgba(255,237,213,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/3" />

        <div className="relative flex flex-col md:flex-row items-start justify-between gap-6 md:gap-8 w-full min-w-0">
          <div className="w-full min-w-0 max-w-lg">
            <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-amber-200/60 dark:border-amber-500/30 rounded-full px-3 py-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">AI-Powered</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-3 sm:mb-4 break-words">
              Run Smarter{" "}
              <span className="text-orange-500">Amazon PPC Campaigns</span>{" "}
              Using AI
            </h1>

            <p className="text-muted-foreground text-sm md:text-base mb-6 sm:mb-8 max-w-full">
              Build Sponsored Products campaigns from your ASIN, Amazon keyword data, search terms, and listing context — or manage live campaigns in the bulk console.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6 sm:mb-8">
              <Button
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-7 py-3 h-auto min-h-11 text-sm font-semibold shadow-lg shadow-orange-500/20"
                onClick={() => nav("/ads/new")}
              >
                <Megaphone className="w-4 h-4 mr-2" />
                Create Campaign (AI)
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl border-teal-600 text-teal-700 hover:bg-teal-50"
                onClick={() => nav("/ads/campaigns")}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Open Ads Console
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Target className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Keyword recommendations</p>
                  <p className="text-xs text-muted-foreground">Amazon Ads API suggestions plus your search term reports</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Bulk campaign management</p>
                  <p className="text-xs text-muted-foreground">Campaigns, targets, search terms, and bulk actions from the left menu</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Wallet className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Launch on Amazon</p>
                  <p className="text-xs text-muted-foreground">Create campaigns, ad groups, and keyword targets in Seller Central</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block flex-shrink-0 relative w-80">
            <HeroIllustration />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-sm font-bold text-foreground mb-3">Ads console</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Use the Manage Ads menu in the left sidebar, or jump directly:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {consoleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-800 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length > 0 ? (
        <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-foreground">Your AI campaign projects</h2>
            <Button variant="outline" size="sm" onClick={() => nav("/ads/new")}>
              New campaign
            </Button>
          </div>
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => nav(`/ads/${project.id}`)}
                className="w-full rounded-lg border p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium truncate">{project.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{project.asin}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {project.status} · step {project.currentStep}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
