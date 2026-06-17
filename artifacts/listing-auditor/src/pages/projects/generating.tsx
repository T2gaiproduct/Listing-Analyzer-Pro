import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const IMAGE_GENERATION_SEC = 30;
const MAX_CONCURRENT = 3;

interface GraphicsProject {
  id: number;
  name: string;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  generatedCount: number;
  imageRecords?: Array<unknown>;
  errorMessage?: string | null;
  updatedAt: string;
}

function fetchProject(id: string): Promise<GraphicsProject> {
  return fetch(`${basePath}/api/graphics/projects/${id}`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch project");
    return r.json();
  });
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Almost done";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function GeneratingPage({ params }: { params?: { id?: string } }) {
  const id = params?.id ?? "";
  const [, nav] = useLocation();
  const [progress, setProgress] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);

  const { data: project } = useQuery({
    queryKey: ["graphics-project", id],
    queryFn: () => fetchProject(id),
    refetchInterval: 2000,
    enabled: !!id,
  });

  const totalImages = (project?.lifestyleCount ?? 0) + (project?.featureCount ?? 0);

  useEffect(() => {
    if (!project) return;
    if (project.status === "completed") {
      setTimeout(() => nav(`/projects/${id}`), 1000);
      return;
    }
    if (project.status === "failed") return;

    const realProgress = totalImages > 0 ? (project.generatedCount / totalImages) * 100 : 0;
    setProgress(realProgress);

    const remaining = totalImages - project.generatedCount;
    if (remaining > 0) {
      const batches = Math.ceil(remaining / MAX_CONCURRENT);
      const estimatedSeconds = batches * IMAGE_GENERATION_SEC;
      setEtaSeconds(estimatedSeconds);
    } else {
      setEtaSeconds(0);
    }
  }, [project, id, nav, totalImages]);

  useEffect(() => {
    if (project?.status !== "generating") return;
    const interval = setInterval(() => {
      setEtaSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [project?.status]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto">
        {/* Centered loader */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
          <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin" />
          <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-purple-600 animate-spin" />
        </div>

        {/* Status text */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">
            {project?.status === "completed"
              ? "All done!"
              : project?.status === "failed"
                ? "Generation failed"
                : "Generating your images"}
          </h1>
          <p className="text-sm text-slate-500">
            {project?.status === "generating"
              ? `${project?.generatedCount ?? 0} of ${totalImages} images • ~${formatEta(etaSeconds)} left`
              : project?.status === "completed"
                ? "Redirecting to your project..."
                : "Please wait..."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${project?.status === "failed" ? "bg-red-500" : "bg-purple-600"}`}
            style={{ width: `${project?.status === "completed" ? 100 : Math.min(progress, 95)}%` }}
          />
        </div>

        {/* Percentage */}
        <p className="text-xs text-slate-400">
          {project?.status === "failed" ? "Failed" : project?.status === "completed" ? "100%" : `${Math.round(progress)}%`}
        </p>

        {/* Error display */}
        {project?.status === "failed" && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-medium">Generation failed</p>
                <p className="text-xs text-red-600 mt-1">{project.errorMessage || "An unexpected error occurred."}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-red-600 border-red-200 hover:bg-red-100"
                  onClick={() => nav(`/projects/${id}`)}
                >
                  View Project <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
