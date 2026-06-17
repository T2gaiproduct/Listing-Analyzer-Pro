import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import {
  Download, RefreshCw, Wand2, ImageIcon, Loader2, ArrowLeft,
  Trash2, Clock, Sparkles, Maximize2, Plus, Check, ArrowRight,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ImageVersion {
  url: string;
  style: string;
  aspectRatio: string;
  isEdit: boolean;
  prompt?: string;
  generatedAt: string;
}

interface ImageRecord {
  id: string;
  type: "lifestyle" | "feature";
  index: number;
  style: string;
  aspectRatio: string;
  currentUrl: string;
  versions: ImageVersion[];
}

interface GraphicsProject {
  id: number;
  name: string;
  productName: string;
  category: string | null;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  imageRecords?: ImageRecord[];
  updatedAt: string;
}

const TYPE_LABELS: Record<ImageRecord["type"], string> = {
  lifestyle: "Lifestyle",
  feature: "Feature",
};

function fetchProject(id: string): Promise<GraphicsProject> {
  return fetch(`${basePath}/api/graphics/projects/${id}`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch project");
    return r.json();
  });
}

export default function ProjectDetail({ params }: { params?: { id?: string } }) {
  const id = params?.id ?? "";
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canEdit } = useTeam();

  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/projects";

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const [editRecord, setEditRecord] = useState<ImageRecord | null>(null);
  const [editPrompt, setEditPrompt] = useState("");

  const [historyRecord, setHistoryRecord] = useState<ImageRecord | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  // Generate More modal
  const [showGenerateMore, setShowGenerateMore] = useState(false);
  const [moreStep, setMoreStep] = useState<1 | 2>(1);
  const [moreLifestyleEnabled, setMoreLifestyleEnabled] = useState(false);
  const [moreLifestyleCount, setMoreLifestyleCount] = useState(2);
  const [moreFeatureEnabled, setMoreFeatureEnabled] = useState(false);
  const [moreFeatureCount, setMoreFeatureCount] = useState(1);
  const [moreStyle, setMoreStyle] = useState("custom");
  const [moreLifestylePrompt, setMoreLifestylePrompt] = useState("");
  const [moreFeaturePrompt, setMoreFeaturePrompt] = useState("");

  const { data: project, isLoading } = useQuery({
    queryKey: ["graphics-project", id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });

  const setLoading = (imageId: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(imageId);
      else next.delete(imageId);
      return next;
    });
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["graphics-project", id] });
  };

  const generateMutation = useMutation({
    mutationFn: async (payload: { additionalLifestyleCount?: number; additionalFeatureCount?: number; style?: string; customLifestylePrompt?: string; customFeaturePrompt?: string } | undefined) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload ?? {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Generation started" });
      // Start polling for status update
      const interval = setInterval(() => {
        qc.invalidateQueries({ queryKey: ["graphics-project", id] });
      }, 3000);
      setTimeout(() => clearInterval(interval), 120000);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ imageId }: { imageId: string }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}/images/${imageId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Regeneration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Image regenerated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Regeneration failed", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ imageId, prompt }: { imageId: string; prompt: string }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}/images/${imageId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ editPrompt: prompt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Edit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditRecord(null);
      setEditPrompt("");
      toast({ title: "Image edited" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Edit failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Project deleted" });
      nav(returnTo);
    },
  });

  const handleDownload = async (url: string, filename: string) => {
    const fullUrl = url.startsWith("http") ? url : `${basePath}${url}`;
    try {
      const response = await fetch(fullUrl, { credentials: "include" });
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleDownloadAll = async () => {
    if (!project?.imageRecords) return;
    for (const record of project.imageRecords) {
      await handleDownload(record.currentUrl, `${record.id}.png`);
    }
    toast({ title: "Downloaded all images" });
  };

  const handleRegenerate = (record: ImageRecord) => {
    setLoading(record.id, true);
    regenerateMutation.mutate(
      { imageId: record.id },
      { onSettled: () => setLoading(record.id, false) },
    );
  };

  const handleOpenEdit = (record: ImageRecord) => {
    setEditRecord(record);
    setEditPrompt("");
  };

  const handleEditSubmit = () => {
    if (!editRecord || !editPrompt.trim()) return;
    setLoading(editRecord.id, true);
    editMutation.mutate(
      { imageId: editRecord.id, prompt: editPrompt },
      { onSettled: () => setLoading(editRecord.id, false) },
    );
  };

  const records = project?.imageRecords ?? [];
  const lifestyleRecords = records.filter((r) => r.type === "lifestyle");
  const featureRecords = records.filter((r) => r.type === "feature");
  const isGenerating = project?.status === "generating";
  const hasRecords = records.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-500 cursor-pointer" onClick={() => nav(returnTo)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{project?.name ?? "Project"}</h1>
            <p className="text-sm text-slate-500">
              {isGenerating ? "Generating images..." : project?.status === "completed" ? "Your graphics are ready!" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project?.status === "completed" && hasRecords && (
            <Button className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer" onClick={handleDownloadAll}>
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          )}
          {canEdit && !isGenerating && (
            <Button
              onClick={() => {
                if (hasRecords) {
                  setShowGenerateMore(true);
                  setMoreStep(1);
                  setMoreLifestyleEnabled(false);
                  setMoreLifestyleCount(2);
                  setMoreFeatureEnabled(false);
                  setMoreFeatureCount(1);
                  setMoreStyle("custom");
                  setMoreLifestylePrompt("");
                  setMoreFeaturePrompt("");
                } else {
                  generateMutation.mutate(undefined);
                }
              }}
              disabled={generateMutation.isPending || isGenerating}
              className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer gap-2"
            >
              {generateMutation.isPending || isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {hasRecords ? "Generate More Images" : "Generate All"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowDelete(true)} className="text-slate-500 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}

      {/* Generating state */}
      {!isLoading && isGenerating && (
        <div className="rounded-lg border bg-white p-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
          <p className="text-slate-700 font-medium">Generating your images...</p>
          <p className="text-sm text-slate-400">This may take a minute or two. The page will update automatically.</p>
        </div>
      )}

      {/* Failed state */}
      {!isLoading && project?.status === "failed" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center">
            <p className="text-red-600 font-medium">Generation failed</p>
            <p className="text-sm text-red-400 mt-1">Please try again or contact support.</p>
          </CardContent>
        </Card>
      )}

      {/* Lifestyle Images */}
      {!isLoading && !isGenerating && lifestyleRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Lifestyle Images ({lifestyleRecords.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lifestyleRecords.map((record) => (
              <ImageCard
                key={record.id}
                record={record}
                canEdit={canEdit}
                isLoading={loadingIds.has(record.id)}
                onRegenerate={() => handleRegenerate(record)}
                onEdit={() => handleOpenEdit(record)}
                onHistory={() => setHistoryRecord(record)}
                onDownload={() => handleDownload(record.currentUrl, `${record.id}.png`)}
                onView={() => window.open(record.currentUrl.startsWith("http") ? record.currentUrl : `${basePath}${record.currentUrl}`, "_blank")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Infographics */}
      {!isLoading && !isGenerating && featureRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Infographics ({featureRecords.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featureRecords.map((record) => (
              <ImageCard
                key={record.id}
                record={record}
                canEdit={canEdit}
                isLoading={loadingIds.has(record.id)}
                onRegenerate={() => handleRegenerate(record)}
                onEdit={() => handleOpenEdit(record)}
                onHistory={() => setHistoryRecord(record)}
                onDownload={() => handleDownload(record.currentUrl, `${record.id}.png`)}
                onView={() => window.open(record.currentUrl.startsWith("http") ? record.currentUrl : `${basePath}${record.currentUrl}`, "_blank")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isGenerating && project?.status === "completed" && records.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">No images generated</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(o) => { if (!o && !loadingIds.has(editRecord?.id ?? "")) { setEditRecord(null); setEditPrompt(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit Image with AI
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4">
              {/* Before / After */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Current</p>
                  <div className="rounded-lg border bg-slate-50 aspect-square overflow-hidden">
                    <img src={editRecord.currentUrl} alt="Current" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">After (shown on apply)</p>
                  <div className="rounded-lg border bg-slate-50/50 aspect-square flex flex-col items-center justify-center gap-3 text-slate-400">
                    {loadingIds.has(editRecord.id) ? (
                      <>
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                          <Wand2 className="absolute inset-0 m-auto h-5 w-5 text-purple-600" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm font-medium text-slate-700">Generating edit...</p>
                          <p className="text-xs mt-1">This takes 30-60 seconds</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-7 w-7 opacity-20" />
                        <span className="text-xs text-center px-4">Result appears here after applying</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Instructions</label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Add a subtle green leaf in the top-right corner, warm the background slightly..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEditRecord(null)} disabled={loadingIds.has(editRecord.id)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={!editPrompt.trim() || loadingIds.has(editRecord.id)}
                  className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer gap-2"
                >
                  {loadingIds.has(editRecord.id) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {loadingIds.has(editRecord.id) ? "Applying..." : "Apply Edit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyRecord} onOpenChange={(o) => !o && setHistoryRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Version History
              {historyRecord && (
                <span className="text-slate-400 font-normal text-sm">
                  - {TYPE_LABELS[historyRecord.type]} {historyRecord.index + 1}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {historyRecord && (
            <div className="space-y-4">
              {historyRecord.versions.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No version history (legacy image).</p>
                  <p className="text-xs">Regenerate this image to start tracking versions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {[...historyRecord.versions].reverse().map((v, i) => {
                    const isCurrent = i === 0;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border overflow-hidden ${isCurrent ? "ring-2 ring-purple-500" : ""}`}
                      >
                        <div className="aspect-square bg-slate-50">
                          <img
                            src={v.url}
                            alt={`Version ${historyRecord.versions.length - i}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-2 text-xs space-y-1 bg-white">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{v.style}</span>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-slate-400">
                            {v.aspectRatio} - {v.isEdit ? "Edit" : "Generated"}
                          </div>
                          {v.prompt && (
                            <div className="text-slate-400 italic line-clamp-2">
                              "{v.prompt}"
                            </div>
                          )}
                          <div className="text-slate-400">
                            {new Date(v.generatedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-6 text-xs mt-1 cursor-pointer"
                            onClick={() =>
                              handleDownload(
                                v.url,
                                `${project?.productName ?? "image"}-${historyRecord.id}-v${historyRecord.versions.length - i}.png`,
                              )
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setHistoryRecord(null)} className="cursor-pointer">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">Are you sure you want to delete this project? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="cursor-pointer">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate More Dialog */}
      <Dialog open={showGenerateMore} onOpenChange={(o) => { if (!o) setShowGenerateMore(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate More Images</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="mb-3">
            <div className="flex items-center">
              {[{ id: 1, label: "Select" }, { id: 2, label: "Style" }].map((s, idx, arr) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      s.id < moreStep ? "bg-purple-600 text-white" :
                      s.id === moreStep ? "bg-purple-600 text-white" :
                      "bg-white text-slate-400 border-2 border-slate-200"
                    }`}>
                      {s.id < moreStep ? <Check className="w-3.5 h-3.5" /> : s.id}
                    </div>
                    <div className="mt-1 text-center">
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.id === moreStep ? "text-purple-600" : "text-slate-400"}`}>
                        Step {s.id} of 2
                      </p>
                      <p className={`text-xs font-medium ${s.id === moreStep ? "text-slate-900" : "text-slate-400"}`}>{s.label}</p>
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 ${s.id < moreStep ? "bg-purple-600" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Select Graphics */}
          {moreStep === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Choose how many additional images to generate.</p>

              {/* Lifestyle */}
              <div className={`rounded-xl border-2 p-3 transition-all ${moreLifestyleEnabled ? "border-purple-200 bg-purple-50/20" : "border-slate-100 bg-white"}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer ${moreLifestyleEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
                    onClick={() => setMoreLifestyleEnabled(!moreLifestyleEnabled)}
                  >
                    {moreLifestyleEnabled ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">Lifestyle Images</h3>
                        <p className="text-xs text-slate-400">Additional lifestyle images</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer ${moreLifestyleEnabled ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}
                        onClick={() => setMoreLifestyleEnabled(!moreLifestyleEnabled)}
                      >
                        {moreLifestyleEnabled && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    {moreLifestyleEnabled && (
                      <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((q) => (
                          <button
                            key={q}
                            onClick={() => setMoreLifestyleCount(q)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${moreLifestyleCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feature */}
              <div className={`rounded-xl border-2 p-3 transition-all ${moreFeatureEnabled ? "border-purple-200 bg-purple-50/20" : "border-slate-100 bg-white"}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer ${moreFeatureEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
                    onClick={() => setMoreFeatureEnabled(!moreFeatureEnabled)}
                  >
                    {moreFeatureEnabled ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">Infographics</h3>
                        <p className="text-xs text-slate-400">Additional feature graphics</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer ${moreFeatureEnabled ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}
                        onClick={() => setMoreFeatureEnabled(!moreFeatureEnabled)}
                      >
                        {moreFeatureEnabled && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    {moreFeatureEnabled && (
                      <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((q) => (
                          <button
                            key={q}
                            onClick={() => setMoreFeatureCount(q)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${moreFeatureCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Design Style */}
          {moreStep === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Select a style. Add custom prompts for better results.</p>
              {moreLifestyleEnabled && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Lifestyle Prompt <span className="text-slate-400 font-normal">(optional)</span>
                    {moreLifestylePrompt.length > 0 && (
                      <span className={`ml-2 text-xs font-medium ${moreLifestylePrompt.length > 1000 ? "text-red-500" : moreLifestylePrompt.length > 800 ? "text-amber-500" : "text-slate-400"}`}>
                        {moreLifestylePrompt.length} / 1000
                      </span>
                    )}
                  </label>
                  <Textarea
                    value={moreLifestylePrompt}
                    onChange={(e) => setMoreLifestylePrompt(e.target.value)}
                    placeholder="Describe your desired scene, lighting, background, and composition. For best results, be specific and detailed. Custom prompts give you full control over the output."
                    rows={2}
                    className="resize-none text-xs"
                  />
                </div>
              )}
              {moreFeatureEnabled && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Infographic Prompt <span className="text-slate-400 font-normal">(optional)</span>
                    {moreFeaturePrompt.length > 0 && (
                      <span className={`ml-2 text-xs font-medium ${moreFeaturePrompt.length > 1000 ? "text-red-500" : moreFeaturePrompt.length > 800 ? "text-amber-500" : "text-slate-400"}`}>
                        {moreFeaturePrompt.length} / 1000
                      </span>
                    )}
                  </label>
                  <Textarea
                    value={moreFeaturePrompt}
                    onChange={(e) => setMoreFeaturePrompt(e.target.value)}
                    placeholder="Describe your desired scene, lighting, background, and composition. For best results, be specific and detailed. Custom prompts give you full control over the output."
                    rows={2}
                    className="resize-none text-xs"
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "custom", label: "Custom / Manual", desc: "Use only your prompt, no style" },
                  { id: "modern", label: "Modern", desc: "Contemporary, clean, bold" },
                  { id: "luxury", label: "Luxury", desc: "Dramatic, opulent, moody" },
                  { id: "outdoor", label: "Outdoor", desc: "Natural, scenic, adventure" },
                  { id: "minimalist", label: "Minimalist", desc: "Clean, simple, white space" },
                ].map((style) => {
                  const isCustom = style.id === "custom";
                  const isSelected = moreStyle === style.id;
                  return (
                    <div
                      key={style.id}
                      className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all p-2.5 ${isSelected ? "border-purple-600 bg-purple-50/30" : "border-slate-200 hover:border-slate-300"}`}
                      onClick={() => setMoreStyle(style.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-900">{style.label}</p>
                          <p className="text-[10px] text-slate-400 leading-tight">{style.desc}</p>
                        </div>
                        {isCustom && (
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            {moreStep > 1 && (
              <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg h-8 text-xs" onClick={() => setMoreStep(1)}>
                Back
              </Button>
            )}
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 h-8 text-xs"
              disabled={moreStep === 1 ? (!moreLifestyleEnabled && !moreFeatureEnabled) : generateMutation.isPending}
              onClick={() => {
                if (moreStep === 1) {
                  setMoreStep(2);
                } else {
                  generateMutation.mutate({
                    additionalLifestyleCount: moreLifestyleEnabled ? moreLifestyleCount : 0,
                    additionalFeatureCount: moreFeatureEnabled ? moreFeatureCount : 0,
                    style: moreStyle,
                    customLifestylePrompt: moreLifestylePrompt.trim() || undefined,
                    customFeaturePrompt: moreFeaturePrompt.trim() || undefined,
                  });
                  setShowGenerateMore(false);
                }
              }}
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {moreStep === 1 ? "Continue" : "Generate"}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageCard({
  record,
  canEdit,
  isLoading,
  onRegenerate,
  onEdit,
  onHistory,
  onDownload,
  onView,
}: {
  record: ImageRecord;
  canEdit: boolean;
  isLoading: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDownload: () => void;
  onView: () => void;
}) {
  return (
    <div className="group relative rounded-lg border border-slate-100 overflow-hidden bg-white hover:shadow-md transition-shadow">
      <div className="aspect-square relative overflow-hidden">
        <img
          src={record.currentUrl}
          alt={`${record.type} ${record.index + 1}`}
          className="w-full h-full object-cover"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/75 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
            <span className="text-xs text-slate-500">Generating...</span>
          </div>
        )}
        {!isLoading && (
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <ActionBtn icon={<Maximize2 className="h-4 w-4" />} title="View full screen" onClick={onView} />
            {canEdit && (
              <>
                <ActionBtn icon={<RefreshCw className="h-4 w-4" />} title="Regenerate" onClick={onRegenerate} />
                <ActionBtn icon={<Wand2 className="h-4 w-4" />} title="Edit with AI" onClick={onEdit} />
              </>
            )}
            <ActionBtn icon={<Clock className="h-4 w-4" />} title="Version history" onClick={onHistory} />
            <ActionBtn icon={<Download className="h-4 w-4" />} title="Download" onClick={onDownload} />
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] capitalize py-0">
            {record.style}
          </Badge>
          <span className="text-xs text-slate-400">{record.aspectRatio}</span>
        </div>
        {record.versions.length > 0 && (
          <span className="text-xs text-slate-400">{record.versions.length}v</span>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 transition-colors shadow-sm cursor-pointer"
    >
      {icon}
    </button>
  );
}
