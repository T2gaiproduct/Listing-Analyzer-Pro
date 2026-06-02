import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Clock, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";

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

const STEPS = [
  { id: "upload", label: "Product uploaded" },
  { id: "lifestyle", label: "Creating lifestyle images" },
  { id: "feature", label: "Creating feature graphics" },
  { id: "finalize", label: "Finalizing assets" },
];

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
  const startTimeRef = useRef<number>(0);

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

    // Record start time when we first see "generating"
    if (project.status === "generating" && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    // Real progress from server count
    const realProgress = totalImages > 0 ? (project.generatedCount / totalImages) * 100 : 0;
    setProgress(realProgress);

    // ETA: remaining images / concurrency * per-image time
    const remaining = totalImages - project.generatedCount;
    if (remaining > 0) {
      const batches = Math.ceil(remaining / MAX_CONCURRENT);
      const estimatedSeconds = batches * IMAGE_GENERATION_SEC;
      setEtaSeconds(estimatedSeconds);
    } else {
      setEtaSeconds(0);
    }
  }, [project, id, nav, totalImages]);

  // Countdown timer
  useEffect(() => {
    if (project?.status !== "generating") return;
    const interval = setInterval(() => {
      setEtaSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [project?.status]);

  const currentStep = project?.status === "completed"
    ? 4
    : project?.status === "failed"
      ? -1
      : Math.min(Math.floor(progress / 25), 3);

  return (
    <div className="max-w-lg mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Creating Your Graphics</h1>
        <p className="text-sm text-slate-500">
          {project?.status === "generating"
            ? `Generating ${project?.generatedCount ?? 0} of ${totalImages} images • About ${formatEta(etaSeconds)} left`
            : project?.status === "completed"
              ? "All done! Redirecting…"
              : "Please wait while we generate your graphics"}
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-6 space-y-6">
          {/* Steps */}
          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const isDone = i < currentStep || project?.status === "completed";
              const isActive = i === currentStep && project?.status !== "completed" && project?.status !== "failed";
              const isFailed = project?.status === "failed" && i === currentStep;

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? "bg-green-100 text-green-600" : isFailed ? "bg-red-100 text-red-600" : isActive ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isFailed ? (
                      <span className="text-xs font-bold">!</span>
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className={`text-sm ${isDone ? "text-slate-700 line-through" : isActive ? "text-slate-900 font-medium" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${project?.status === "failed" ? "bg-red-500" : "bg-purple-600"}`}
                style={{ width: `${project?.status === "completed" ? 100 : Math.min(progress, 95)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">
                {project?.status === "failed" ? "Generation failed" : project?.status === "completed" ? "100%" : `${Math.round(progress)}%`}
              </span>
              {project?.status === "completed" && (
                <span className="text-green-600 font-medium">Complete!</span>
              )}
            </div>
          </div>

          {/* Error display */}
          {project?.status === "failed" && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 font-medium">Generation failed</p>
                  <p className="text-xs text-red-600 mt-1">{project.errorMessage || "An unexpected error occurred while generating your graphics."}</p>
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

          {/* Tip */}
          <div className="bg-purple-50 rounded-lg p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-purple-800 font-medium">Tip</p>
              <p className="text-xs text-purple-600">You can close this window. We&apos;ll email you once your graphics are ready.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
