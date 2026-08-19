import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdsConsoleLayout } from "@/components/ads-console-layout";
import { AdsConsoleToolbar } from "@/components/ads-console-toolbar";
import { fetchAdsProjects } from "@/lib/ads-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight } from "lucide-react";

export default function AdsCampaignManagerPage() {
  const projectsQuery = useQuery({
    queryKey: ["ads-projects"],
    queryFn: fetchAdsProjects,
  });

  const projects = projectsQuery.data?.projects ?? [];

  return (
    <AdsConsoleLayout>
      <AdsConsoleToolbar
        title="Campaign Manager"
        compare={false}
        onCompareChange={() => {}}
        selectedCount={0}
        showBulk={false}
        createHref="/ads/new"
        createLabel="Create"
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <p className="text-sm text-slate-600">
            AI campaign projects created in Listing Auditor. Launch wizard campaigns or open live Amazon campaigns in the console.
          </p>
        </div>
        {projectsQuery.isLoading ? (
          <div className="flex justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No campaign projects yet.{" "}
            <Link href="/ads/new" className="text-orange-600 underline font-medium">Create one</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50/50">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {p.asin ?? "—"} · Step {p.currentStep}/4
                    {p.amazonCampaignId ? ` · Amazon ${p.amazonCampaignId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="capitalize">{p.status}</Badge>
                  <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                    <Link href={p.workflowUrl}>
                      Open
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" asChild>
          <a href="https://advertising.amazon.com/cm/campaigns" target="_blank" rel="noopener noreferrer">
            Open Amazon Campaign Manager
          </a>
        </Button>
      </div>
    </AdsConsoleLayout>
  );
}
