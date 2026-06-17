import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import {
  Upload, ArrowRight, Check, ImageIcon, Loader2, Trash2,
  Wand2, Sparkles, Search, RefreshCw, Clock, Download,
  ArrowLeft, Maximize2, AlertTriangle,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const IMAGE_TYPES = [
  { id: "hero", label: "Hero Shot", desc: "White background, product centered", icon: "🏆" },
  { id: "lifestyle", label: "Lifestyle In-Use", desc: "Product in use, real environment", icon: "🌅" },
  { id: "callouts", label: "Feature Callouts", desc: "Numbered features, arrows", icon: "🔢" },
  { id: "size", label: "Size Reference", desc: "Scale comparison with dimensions", icon: "📏" },
  { id: "beforeafter", label: "Before / After", desc: "Transformation comparison", icon: "⚡" },
  { id: "bundle", label: "Bundle Shot", desc: "All included items", icon: "📦" },
  { id: "social", label: "Social Proof", desc: "Ratings & reviews", icon: "⭐" },
  { id: "custom", label: "Generate Custom", desc: "Custom prompt", icon: "✨" },
];

const PROMPT_MAX_CHARS = 1000;

const CUSTOM_EXAMPLES = [
  "Show the product in a modern kitchen setting with warm natural lighting",
  "Create a minimalist product shot on a marble surface with soft shadows",
  "Show product being used by a family on a beach during golden hour",
  "Flat-lay overhead shot of product with complementary lifestyle props",
  "Product on a clean desk setup with laptop and coffee, work-from-home aesthetic",
];

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1, label: "Upload Product" },
  { id: 2, label: "Select Graphics" },
  { id: 3, label: "Custom Prompt" },
];

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

interface WizardProject {
  id: number;
  auditId?: number | null;
  productName: string;
  category: string | null;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  imageRecords?: ImageRecord[];
  generatedCount: number;
  errorMessage?: string | null;
  updatedAt: string;
}

interface GraphicsWizardProps {
  auditId: number;
  productName: string;
  imageUrls?: string[] | null;
  category?: string | null;
  targetKeywords?: string[] | null;
}

function fetchProjectForAudit(auditId: number): Promise<WizardProject | null> {
  return fetch(`${basePath}/api/graphics/projects?auditId=${auditId}`, { credentials: "include" })
    .then((r) => {
      if (!r.ok) return null;
      return r.json();
    })
    .then((data: { projects?: WizardProject[] }) => {
      const projects = data?.projects ?? [];
      return projects.find((p) => p.auditId === auditId) ?? null;
    });
}

const IMAGE_GENERATION_SEC = 30;
const MAX_CONCURRENT = 3;

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Almost done";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const TYPE_LABELS: Record<ImageRecord["type"], string> = {
  lifestyle: "Lifestyle",
  feature: "Infographic",
};

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-full bg-background/90 hover:bg-background text-foreground transition-colors shadow-sm"
    >
      {icon}
    </button>
  );
}

export function GraphicsWizard({ auditId, productName, imageUrls, category, targetKeywords }: GraphicsWizardProps) {
  const { toast } = useToast();
  const { canEdit } = useTeam();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  const [step, setStep] = useState<Step>(1);
  const [wizardCategory, setWizardCategory] = useState(category ?? "");
  const [categorySearch, setCategorySearch] = useState(category ?? "");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>(imageUrls ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [editRecord, setEditRecord] = useState<ImageRecord | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [historyRecord, setHistoryRecord] = useState<ImageRecord | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  // Generate More Images modal state
  const [showMore, setShowMore] = useState(false);
  const [moreStep, setMoreStep] = useState<"select" | "custom" | "generating">("select");
  const [moreImageTypes, setMoreImageTypes] = useState<string[]>([]);
  const [moreCustomPrompt, setMoreCustomPrompt] = useState("");
  const [moreEtaSeconds, setMoreEtaSeconds] = useState(0);
  const [moreProgress, setMoreProgress] = useState(0);

  const { data: existingProject } = useQuery({
    queryKey: ["graphics-project-for-audit", auditId],
    queryFn: () => fetchProjectForAudit(auditId),
    enabled: !projectId,
  });

  const activeProjectId = projectId ?? existingProject?.id ?? null;
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, refetch } = useQuery({
    queryKey: ["graphics-project", activeProjectId],
    queryFn: () => {
      if (!activeProjectId) return null;
      return fetch(`${basePath}/api/graphics/projects/${activeProjectId}`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch project");
          return r.json();
        });
    },
    enabled: !!activeProjectId && isGenerating,
    refetchInterval: 2000,
  });

  const totalImages = (project?.lifestyleCount ?? 0) + (project?.featureCount ?? 0);

  useEffect(() => {
    if (!project) return;
    if (project.status === "completed") {
      setIsGenerating(false);
      setProgress(100);
      setEtaSeconds(0);
      return;
    }
    if (project.status === "failed") {
      setIsGenerating(false);
      return;
    }
    if (project.status === "generating" && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    const realProgress = totalImages > 0 ? (project.generatedCount / totalImages) * 100 : 0;
    setProgress(realProgress);
    const remaining = totalImages - project.generatedCount;
    const eta = Math.ceil((remaining / MAX_CONCURRENT) * IMAGE_GENERATION_SEC);
    setEtaSeconds(eta);
  }, [project, totalImages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createProject = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`${basePath}/api/graphics/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create project (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (project) => {
      setProjectId(project.id);
      setIsGenerating(true);
      fetch(`${basePath}/api/graphics/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageTypes: selectedImageTypes,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });
      startTimeRef.current = Date.now();
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create", variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ imageId, pid }: { imageId: string; pid: number }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${pid}/images/${imageId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Regeneration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Image regenerated" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Regeneration failed", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ imageId, pid, prompt }: { imageId: string; pid: number; prompt: string }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${pid}/images/${imageId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Edit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Image edited" });
      setEditRecord(null);
      setEditPrompt("");
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Edit failed", variant: "destructive" });
    },
  });

  const generateMoreMutation = useMutation({
    mutationFn: async ({ pid, payload }: { pid: number; payload: { imageTypes?: string[]; customPrompt?: string } }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${pid}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Additional generation started" });
      setIsGenerating(true);
      startTimeRef.current = Date.now();
      setTimeout(() => {
        refetch();
      }, 500);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please upload image files only", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    let loaded = 0;
    const results: string[] = [];
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result as string);
        loaded++;
        if (loaded === imageFiles.length) {
          setUploadedImages((prev) => [...prev, ...results]);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };
  const removeImage = (index: number) => setUploadedImages((prev) => prev.filter((_, i) => i !== index));

  const canContinue = () => {
    if (step === 1) return productName.trim().length > 0;
    if (step === 2) return selectedImageTypes.length > 0;
    if (step === 3) return customPrompt.trim().length > 0;
    return true;
  };

  const handleContinue = () => {
    if (step === 2 && !selectedImageTypes.includes("custom")) {
      // Non-custom selected: skip Step 3, generate directly
      createProject.mutate({
        name: `${productName} Project`,
        productName,
        category: wizardCategory,
        sourceImageUrls: uploadedImages,
        imageTypes: selectedImageTypes,
        customPrompt: undefined,
        auditId,
      });
    } else if (step === 3) {
      // Custom selected: generate with prompt
      createProject.mutate({
        name: `${productName} Project`,
        productName,
        category: wizardCategory,
        sourceImageUrls: uploadedImages,
        imageTypes: selectedImageTypes,
        customPrompt: customPrompt.trim() || undefined,
        auditId,
      });
    } else {
      setStep((s) => (s + 1) as Step);
    }
  };

  const setLoading = (id: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRegenerate = (record: ImageRecord) => {
    if (!activeProjectId) return;
    setLoading(record.id, true);
    regenerateMutation.mutate(
      { imageId: record.id, pid: activeProjectId },
      { onSettled: () => setLoading(record.id, false) },
    );
  };

  const handleEdit = (record: ImageRecord) => {
    setEditRecord(record);
    setEditPrompt("");
  };

  const handleEditSubmit = () => {
    if (!editRecord || !editPrompt.trim() || !activeProjectId) return;
    setLoading(editRecord.id, true);
    editMutation.mutate(
      { imageId: editRecord.id, pid: activeProjectId, prompt: editPrompt },
      { onSettled: () => setLoading(editRecord.id, false) },
    );
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleDownloadAll = () => {
    const allRecords: ImageRecord[] = project?.imageRecords ?? existingProject?.imageRecords ?? [];
    if (allRecords.length === 0) return;
    allRecords.forEach((r, i) => {
      setTimeout(() => handleDownload(r.currentUrl, `${r.type}_${i + 1}.png`), i * 300);
    });
    toast({ title: "Downloaded all images" });
  };

  const displayProject = project ?? existingProject ?? null;
  const records: ImageRecord[] = displayProject?.imageRecords ?? [];
  const lifestyleRecords = records.filter((r) => r.type === "lifestyle");
  const featureRecords = records.filter((r) => r.type === "feature");

  // If there's a completed project (either existing or just created), show results
  const showResults = (existingProject?.status === "completed" && !projectId) || (project?.status === "completed" && !isGenerating);

  // If there's a failed project, show error
  const showFailed = (existingProject?.status === "failed" && !projectId) || (project?.status === "failed" && !isGenerating);

  // If generating, show progress
  if (isGenerating) {
    const generatingSteps = [
      { id: "upload", label: "Product uploaded", done: true },
      { id: "lifestyle", label: "Creating lifestyle images", done: progress > 30 },
      { id: "feature", label: "Creating feature graphics", done: progress > 70 },
      { id: "finalize", label: "Finalizing assets", done: progress > 95 },
    ];

    return (
      <div className="space-y-6">
        <div className="text-center space-y-4 py-8">
          <div className="relative w-20 h-20 mx-auto">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-purple-100" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-purple-600"
                strokeDasharray={226} strokeDashoffset={226 - (226 * progress) / 100} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">{Math.round(progress)}%</span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">Generating your graphics...</p>
            <p className="text-sm text-slate-500 mt-1">
              {etaSeconds > 0 ? `ETA: ${formatEta(etaSeconds)}` : "Almost done..."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {generatingSteps.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${s.done ? "border-purple-200 bg-purple-50/30" : "border-slate-100 bg-white"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.done ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                {s.done ? <Check className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
              <span className={`text-sm font-medium ${s.done ? "text-slate-900" : "text-slate-500"}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show completed results
  if (showResults && displayProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Generated Graphics</h2>
            <p className="text-sm text-slate-500">{displayProject.productName}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer gap-2"
                onClick={() => {
                  setShowMore(true);
                  setMoreStep("select");
                  setSelectedImageTypes([]);
                  setCustomPrompt("");
                }}
              >
                <Sparkles className="w-4 h-4" />
                Generate More Images
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={handleDownloadAll}>
              <Download className="w-4 h-4" />
              Download All
            </Button>
          </div>
        </div>

        {/* All Images */}
        {allRecords.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allRecords.map((record) => (
              <ImageCard
                key={record.id}
                record={record}
                canEdit={canEdit}
                isLoading={loadingIds.has(record.id)}
                onRegenerate={() => handleRegenerate(record)}
                onEdit={() => handleEdit(record)}
                onHistory={() => setHistoryRecord(record)}
                onDownload={() => handleDownload(record.currentUrl, `${record.id}.png`)}
                onView={() => setFullscreenUrl(record.currentUrl)}
              />
            ))}
          </div>
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
                  <Button variant="outline" onClick={() => setEditRecord(null)} disabled={loadingIds.has(editRecord.id)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditSubmit} disabled={!editPrompt.trim() || loadingIds.has(editRecord.id)} className="gap-2">
                    {loadingIds.has(editRecord.id) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {loadingIds.has(editRecord.id) ? "Applying..." : "Apply Edit"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={!!historyRecord} onOpenChange={(o) => { if (!o) setHistoryRecord(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Version History
                {historyRecord && (
                  <span className="text-slate-500 font-normal text-sm">- {TYPE_LABELS[historyRecord.type]} {historyRecord.index + 1}</span>
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
                  <div className="space-y-3">
                    {historyRecord.versions.map((v, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white">
                        <div className="w-16 h-16 rounded-lg border bg-slate-50 overflow-hidden flex-shrink-0">
                          <img src={v.url} alt={`Version ${i + 1}`} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{v.isEdit ? "Edit" : "Generate"}</Badge>
                            <span className="text-xs text-slate-400">{new Date(v.generatedAt).toLocaleDateString()}</span>
                          </div>
                          {v.prompt && <p className="text-xs text-slate-500 mt-1 truncate">{v.prompt}</p>}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(v.url, `version_${i + 1}.png`)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fullscreen Dialog */}
        <Dialog open={!!fullscreenUrl} onOpenChange={() => setFullscreenUrl(null)}>
          <DialogContent className="max-w-5xl p-1">
            {fullscreenUrl && (
              <img src={fullscreenUrl} alt="Full screen" className="w-full h-full object-contain rounded-lg" />
            )}
          </DialogContent>
        </Dialog>

        {/* Generate More Images Dialog */}
        <Dialog open={showMore} onOpenChange={(o) => {
          if (!o) {
            setShowMore(false);
            setMoreStep("select");
            setMoreImageTypes([]);
            setMoreCustomPrompt("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate More Images</DialogTitle>
            </DialogHeader>

            {/* Step 1: Select Image Types */}
            {moreStep === "select" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Choose the image types you want to generate. You can select multiple.</p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "hero", label: "Hero Shot", desc: "White background", icon: "🏆" },
                    { id: "lifestyle", label: "Lifestyle In-Use", desc: "Product in use", icon: "🌅" },
                    { id: "callouts", label: "Feature Callouts", desc: "Numbered features", icon: "🔢" },
                    { id: "size", label: "Size Reference", desc: "Scale comparison", icon: "📏" },
                    { id: "beforeafter", label: "Before / After", desc: "Transformation", icon: "⚡" },
                    { id: "bundle", label: "Bundle Shot", desc: "All included items", icon: "📦" },
                    { id: "social", label: "Social Proof", desc: "Ratings & reviews", icon: "⭐" },
                    { id: "custom", label: "Generate Custom", desc: "Custom prompt", icon: "✨" },
                  ].map((type) => {
                    const isSelected = moreImageTypes.includes(type.id);
                    return (
                      <div
                        key={type.id}
                        onClick={() => {
                          setMoreImageTypes((prev) =>
                            prev.includes(type.id) ? prev.filter((s) => s !== type.id) : [...prev, type.id]
                          );
                        }}
                        className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                          isSelected
                            ? "border-purple-600 bg-purple-50/30"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-xl leading-none mt-0.5">{type.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className={`text-sm font-semibold ${isSelected ? "text-purple-900" : "text-slate-900"}`}>
                                {type.label}
                              </h3>
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-tight">{type.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {moreImageTypes.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs">
                      {moreImageTypes.length} selected
                    </span>
                    <span className="text-slate-400">~{moreImageTypes.length * 30}s total</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg" onClick={() => {
                    setMoreImageTypes([]);
                    setMoreCustomPrompt("");
                  }}>
                    Clear
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
                    disabled={moreImageTypes.length === 0}
                    onClick={() => {
                      if (moreImageTypes.includes("custom")) {
                        setMoreStep("custom");
                      } else {
                        const pid = displayProject?.id ?? activeProjectId ?? 0;
                        if (pid) {
                          generateMoreMutation.mutate({
                            pid,
                            payload: {
                              imageTypes: moreImageTypes,
                            },
                          });
                        }
                        setShowMore(false);
                      }
                    }}
                  >
                    {moreImageTypes.includes("custom") ? "Continue" : "Generate"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Custom Prompt */}
            {moreStep === "custom" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-600">
                    <ArrowLeft className="w-4 h-4" />
                  </span>
                  <span className="font-medium text-slate-900">Custom Image</span>
                </div>
                <p className="text-sm text-slate-500">Describe exactly what you want your custom image to look like.</p>

                <Textarea
                  value={moreCustomPrompt}
                  onChange={(e) => setMoreCustomPrompt(e.target.value)}
                  placeholder="Describe your scene, lighting, composition, and background. Be specific and detailed."
                  rows={4}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{moreCustomPrompt.length} characters</span>
                  <span className={moreCustomPrompt.trim().length > 0 ? "text-purple-600" : "text-slate-400"}>
                    {moreCustomPrompt.trim().length > 0 ? "Ready to generate" : "Add a prompt to continue"}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Need inspiration? Try these:</p>
                  {[
                    "A sleek coffee mug on a marble countertop with morning sunlight streaming through a window",
                    "My product floating on a cloud against a pastel gradient background with soft shadows",
                    "A 3D render of my product on a rotating pedestal with dramatic rim lighting",
                  ].map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setMoreCustomPrompt(ex)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-600 hover:border-purple-300 hover:bg-purple-50/30 transition-all"
                    >
                      <span className="text-purple-400">&ldquo;</span>{ex}<span className="text-purple-400">&rdquo;</span>
                    </button>
                  ))}
                </div>

                {moreImageTypes.filter(s => s !== "custom").length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Also generating:</p>
                    <div className="flex flex-wrap gap-2">
                      {moreImageTypes.filter(s => s !== "custom").map((id) => {
                        const type = [
                          { id: "hero", label: "Hero Shot" },
                          { id: "lifestyle", label: "Lifestyle" },
                          { id: "callouts", label: "Callouts" },
                          { id: "size", label: "Size Reference" },
                          { id: "beforeafter", label: "Before/After" },
                          { id: "bundle", label: "Bundle" },
                          { id: "social", label: "Social Proof" },
                        ].find((t) => t.id === id);
                        return (
                          <span key={id} className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                            {type?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg" onClick={() => setMoreStep("select")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
                    disabled={!moreCustomPrompt.trim()}
                    onClick={() => {
                      const pid = displayProject?.id ?? activeProjectId ?? 0;
                      if (pid) {
                        generateMoreMutation.mutate({
                          pid,
                          payload: {
                            imageTypes: moreImageTypes,
                            customPrompt: moreCustomPrompt.trim(),
                          },
                        });
                      }
                      setShowMore(false);
                    }}
                  >
                    Generate {moreImageTypes.length} Image{moreImageTypes.length > 1 ? "s" : ""}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show failed state
  if (showFailed) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium">Generation failed</p>
        <p className="text-sm text-red-400">{displayProject?.errorMessage || "Please try again or contact support."}</p>
        <Button
          variant="outline"
          className="mt-2 gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
          onClick={() => {
            setProjectId(null);
            setStep(1);
            setUploadedImages(imageUrls ?? []);
            setWizardCategory(category ?? "");
            setCategorySearch(category ?? "");
          }}
        >
          <Sparkles className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Show wizard
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s.id < step ? "bg-purple-600 text-white" :
                  s.id === step ? "bg-purple-600 text-white" :
                  "bg-white text-slate-400 border-2 border-slate-200"
                }`}>
                  {s.id < step ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.id === step ? "text-purple-600" : "text-slate-400"}`}>
                    Step {s.id} of 3
                  </p>
                  <p className={`text-sm font-medium ${s.id === step ? "text-slate-900" : "text-slate-400"}`}>
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-6 ${s.id < step ? "bg-purple-600" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Product */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload Product</h2>
              <p className="text-sm text-slate-500">Upload one or more images of your product. We&apos;ll use them to create stunning graphics.</p>
            </div>
          </div>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-purple-200 rounded-xl p-12 text-center bg-purple-50/20 hover:bg-purple-50/30 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Drag & drop your product images here</p>
            <p className="text-sm text-slate-400 mb-4">or</p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Images
            </Button>
            <p className="text-xs text-slate-400 mt-3">PNG, JPG up to 20MB each. Multiple images supported.</p>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </div>

          {/* Image Preview + Form */}
          {uploadedImages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Uploaded Images ({uploadedImages.length})</p>
                <div className="flex flex-wrap gap-4">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-[140px] h-[140px] rounded-lg border border-slate-100 overflow-hidden bg-white flex-shrink-0">
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                      <button
                        className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center text-red-500 hover:text-red-600"
                        onClick={() => removeImage(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Name</label>
                  <Input
                    value={productName}
                    readOnly
                    className="border-slate-200 h-11 rounded-lg bg-slate-50"
                  />
                </div>
                <div className="relative" ref={categoryRef}>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Category</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      value={categorySearch}
                      onChange={(e) => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      placeholder="Search Amazon category..."
                      className="border-slate-200 h-11 rounded-lg pl-9"
                    />
                    {showCategoryDropdown && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto overscroll-contain">
                        {AMAZON_CATEGORIES.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                        )}
                        {AMAZON_CATEGORIES.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase())).map((c) => (
                          <div
                            key={c}
                            className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-purple-50 ${wizardCategory === c ? "bg-purple-50 text-purple-700 font-medium" : "text-slate-700"}`}
                            onClick={() => { setWizardCategory(c); setCategorySearch(c); setShowCategoryDropdown(false); }}
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Graphics */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select Graphics</h2>
              <p className="text-xs text-slate-500">Choose the image types you want to generate. You can select multiple.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {IMAGE_TYPES.map((type) => {
              const isSelected = selectedImageTypes.includes(type.id);
              return (
                <div
                  key={type.id}
                  onClick={() => {
                    setSelectedImageTypes((prev) =>
                      prev.includes(type.id) ? prev.filter((s) => s !== type.id) : [...prev, type.id]
                    );
                  }}
                  className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-purple-600 bg-purple-50/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl leading-none mt-0.5">{type.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-semibold ${isSelected ? "text-purple-900" : "text-slate-900"}`}>
                          {type.label}
                        </h3>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{type.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedImageTypes.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs">
                {selectedImageTypes.length} selected
              </span>
              <span className="text-slate-400">~{selectedImageTypes.length * 30}s total</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Custom Prompt (only if custom selected) */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Custom Prompt</h2>
              <p className="text-xs text-slate-500">Describe exactly what you want the AI to create.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/30 p-3">
            <label className="text-xs font-medium text-purple-900">
              Custom Prompt
              {customPrompt.length > 0 && (
                <span className={`ml-2 text-xs font-medium ${customPrompt.length > PROMPT_MAX_CHARS ? "text-red-500" : "text-slate-400"}`}>
                  {customPrompt.length} / {PROMPT_MAX_CHARS}
                </span>
              )}
            </label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe exactly what you want the AI to create. Be specific about the scene, lighting, composition, and mood."
              rows={3}
              className="resize-none text-xs bg-white"
            />
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Example prompts</p>
              {CUSTOM_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="block text-left text-[11px] text-purple-600 hover:text-purple-700 hover:underline w-full"
                  onClick={() => setCustomPrompt(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-6">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
            disabled={!canContinue() || createProject.isPending}
            onClick={handleContinue}
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {step === 2 && !selectedImageTypes.includes("custom") ? "Generate" : step === 3 ? "Generate" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Image Card sub-component ─── */
function ImageCard({ record, isLoading, onRegenerate, onEdit, onHistory, onDownload, onView, canEdit }: {
  record: ImageRecord;
  isLoading: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDownload: () => void;
  onView: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="group relative rounded-lg border overflow-hidden bg-white">
      <div className="aspect-square relative overflow-hidden">
        <img src={record.currentUrl} alt={`${record.type} ${record.index + 1}`} className="w-full h-full object-contain" />
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-white" />
            <span className="text-xs text-white/80">Generating...</span>
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
      <div className="px-3 py-2 border-t bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] capitalize py-0">{record.style}</Badge>
          <span className="text-xs text-slate-400">{record.aspectRatio}</span>
        </div>
        {record.versions.length > 0 && (
          <span className="text-xs text-slate-400">{record.versions.length}v</span>
        )}
      </div>
    </div>
  );
}

/* ─── Category list (shared from create.tsx) ─── */
const AMAZON_CATEGORIES = [
  "Alexa Skills", "Amazon Pharmacy", "Amazon Subscribe & Save", "Appliances", "Apps & Games",
  "Arts, Crafts & Sewing", "Automotive", "Baby", "Beauty & Personal Care", "Books", "CDs & Vinyl",
  "Camera & Photo", "Cell Phones & Accessories", "Clothing, Shoes & Jewelry", "Collectible Coins",
  "Computers & Accessories", "Costumes & Accessories", "Digital Educational Resources", "Digital Music",
  "Electronics", "Entertainment Collectibles", "Fine Art", "Food & Beverage", "Furniture & Décor",
  "Gift Cards", "Grocery & Gourmet Food", "Handmade", "Health & Household", "Health, Fitness & Dieting",
  "Home & Business Services", "Home & Kitchen", "Home & Garden", "Industrial & Scientific", "Jewelry & Watches",
  "Kindle Store", "Kitchen & Dining", "Luggage & Travel Gear", "Magazines & Newspapers", "Medical Supplies & Equipment",
  "Movies & TV", "Musical Instruments", "Office Products", "Outdoor Recreation", "Pet Supplies", "Premium Beauty",
  "Professional Dental Supplies", "Shoes", "Software", "Sports & Outdoors", "Sports Collectibles",
  "Tools & Home Improvement", "Toys & Games", "Video Games", "Watches", "Wine",
];

// category filtering is computed inline in the component
