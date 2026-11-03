import { useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ChevronRight, History, ImageIcon, Loader2, Palette } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";
import { appendReturnTo } from "@/lib/navigation-return";

const GRAPHICS_HISTORY_LIMIT = 25;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type GraphicsImageRecord = { currentUrl?: string };

export type GraphicsProjectHistoryRow = {
  id: number;
  name: string;
  productName: string;
  category?: string | null;
  status: string;
  generatedCount: number;
  imageRecords?: GraphicsImageRecord[] | null;
  sourceImageUrls?: string[] | null;
  updatedAt?: string;
  createdAt?: string;
};

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
    || trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function projectLabel(project: GraphicsProjectHistoryRow): string {
  return project.productName?.trim() || project.name?.trim() || "Untitled project";
}

function projectSubtitle(project: GraphicsProjectHistoryRow): string {
  if (project.category?.trim()) return project.category.trim();
  return "Product graphics";
}

function projectThumbnail(project: GraphicsProjectHistoryRow): string | null {
  const fromGenerated = project.imageRecords?.find((r) => r.currentUrl?.trim())?.currentUrl;
  if (fromGenerated) return resolveImageUrl(fromGenerated);
  const fromSource = project.sourceImageUrls?.find((u) => u?.trim());
  return resolveImageUrl(fromSource ?? null);
}

function statusLine(project: GraphicsProjectHistoryRow): { text: string; className?: string } | null {
  switch (project.status) {
    case "generating":
      return { text: "Generating…", className: "text-amber-600" };
    case "failed":
      return { text: "Failed", className: "text-rose-600" };
    case "completed":
      if (project.generatedCount > 0) {
        return {
          text: `${project.generatedCount} image${project.generatedCount === 1 ? "" : "s"}`,
          className: "text-emerald-600",
        };
      }
      return { text: "Completed", className: "text-emerald-600" };
    case "draft":
      return { text: "Draft", className: "text-muted-foreground" };
    default:
      return null;
  }
}

async function fetchGraphicsProjectsList(): Promise<GraphicsProjectHistoryRow[]> {
  const data = await fetchJson<{ projects: GraphicsProjectHistoryRow[] }>(
    `${basePath}/api/graphics/projects`,
  );
  return data.projects ?? [];
}

export function GraphicsProjectHistory() {
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["graphics-projects-list"],
    queryFn: fetchGraphicsProjectsList,
    staleTime: 10_000,
    refetchOnMount: "always",
  });

  const items = useMemo(
    () => (projects ?? []).slice(0, GRAPHICS_HISTORY_LIMIT),
    [projects],
  );

  if (isError) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Could not load graphics history. Refresh the page to try again.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2 justify-center sm:justify-start">
        <History className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your graphics history
        </h2>
      </div>

      <Card className="border border-border/60 shadow-none overflow-hidden">
        {isLoading ? (
          <CardContent className="p-0 divide-y divide-border/60">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="py-10 px-6 text-center">
            <p className="text-sm font-medium text-foreground">No graphics projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Click Create Images above to start your first AI graphics project. Completed work will appear here.
            </p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((project) => {
              const href = appendReturnTo(`/projects/${project.id}`, "/projects");
              const thumb = projectThumbnail(project);
              const dateRaw = project.updatedAt || project.createdAt;
              const dateLabel = dateRaw ? format(new Date(dateRaw), "MMM d, yyyy") : "—";
              const status = statusLine(project);

              return (
                <li key={project.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 sm:px-6 sm:py-4 hover:bg-orange-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Palette className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-orange-600 transition-colors">
                        {projectLabel(project)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {projectSubtitle(project)}
                        <span className="mx-1.5 text-border">·</span>
                        {dateLabel}
                        {status && (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            <span className={cn(status.className)}>{status.text}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {project.status === "generating" ? (
                      <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                    ) : project.generatedCount > 0 ? (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {project.generatedCount}
                      </span>
                    ) : null}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
