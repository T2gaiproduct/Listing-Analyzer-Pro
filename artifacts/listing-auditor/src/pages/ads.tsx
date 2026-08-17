import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Plus, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAdsProjects } from "@/lib/ads-api";

export default function AdsPage() {
  const [, setLocation] = useLocation();
  const projectsQuery = useQuery({
    queryKey: ["ads-projects"],
    queryFn: fetchAdsProjects,
  });

  const projects = projectsQuery.data?.projects ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 flex items-center gap-2 text-sm text-sky-900">
        <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
        <span>
          <span className="font-semibold">Work in progress</span>
          — Manage Ads is available for early use. Campaign tools are still being refined.
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Manage Ads</h1>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-sky-700 border-sky-200 bg-sky-50">
              Work in Progress
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Build Sponsored Products campaigns from ASIN, Amazon keyword data, and SellerLens AI scoring.
          </p>
        </div>
        <Button onClick={() => setLocation("/ads/new")} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New campaign
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mx-auto">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">No ad campaigns yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Start with a product ASIN. We pull Amazon Ads recommendations, your campaign history, search term reports, and listing keywords — then score and launch Exact / Phrase / Broad targets.
            </p>
          </div>
          <Button onClick={() => setLocation("/ads/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            Create first campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setLocation(`/ads/${project.id}`)}
              className="w-full rounded-xl border bg-card p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium truncate">{project.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{project.asin}</Badge>
                  <Badge variant={project.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {project.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Step {project.currentStep} · {project.keywordData?.length ?? 0} keywords scored
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
