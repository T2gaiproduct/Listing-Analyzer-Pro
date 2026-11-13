import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { getGetRecentsQueryKey } from "@workspace/api-client-react";
import { ImageGenerationProgressPanel } from "@/components/image-generation-progress-panel";
import { graphicsScratchProjectViewPath } from "@/lib/graphics-in-detail-nav";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const IMAGE_GENERATION_SEC = 22;
const MAX_CONCURRENT = 4;

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

export default function GeneratingPage({ params }: { params?: { id?: string } }) {
  const id = params?.id ?? "";
  const [, nav] = useLocation();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const creditsRefreshedRef = useRef(false);

  const { data: project, isError: projectLoadError } = useQuery({
    queryKey: ["graphics-project", id],
    queryFn: () => fetchProject(id),
    refetchInterval: (query) => (query.state.error ? false : 1500),
    enabled: !!id,
    retry: false,
  });

  const generationFailed = projectLoadError || project?.status === "failed";

  useEffect(() => {
    if (!generationFailed) return;
    void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: ["graphics-projects-list"] });
  }, [generationFailed, queryClient]);

  const totalImages = (project?.lifestyleCount ?? 0) + (project?.featureCount ?? 0);

  useEffect(() => {
    if (!project) return;
    if (project.status === "completed") {
      if (!creditsRefreshedRef.current) {
        creditsRefreshedRef.current = true;
        refreshCreditBalances(queryClient);
        void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: ["graphics-projects-list"] });
      }
      setTimeout(
        () => nav(graphicsScratchProjectViewPath(Number(id)), { replace: true }),
        1000,
      );
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
  }, [project, id, nav, totalImages, queryClient]);

  useEffect(() => {
    if (project?.status !== "generating") return;
    const interval = setInterval(() => {
      setEtaSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [project?.status]);

  if (project?.status === "completed") {
    return (
      <ImageGenerationProgressPanel
        title="All done!"
        subtitle="Redirecting to your project…"
        progressPercent={100}
        generatedCount={project.generatedCount}
        totalImages={totalImages}
      />
    );
  }

  if (generationFailed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <h1 className="text-xl font-bold text-slate-900">Generation failed</h1>
          <div className="bg-red-50 rounded-lg p-4 border border-red-100 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-medium">Something went wrong</p>
                <p className="text-xs text-red-600 mt-1">
                  {project?.errorMessage || "An unexpected error occurred. You can try creating graphics again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-red-600 border-red-200 hover:bg-red-100"
                  onClick={() => nav("/projects/create")}
                >
                  Try again <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ImageGenerationProgressPanel
      progressPercent={progress}
      generatedCount={project?.generatedCount}
      totalImages={totalImages}
      etaSeconds={etaSeconds}
    />
  );
}
