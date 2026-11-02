import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Maximize2, Sparkles, Wand2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProtectedAppImage } from "@/components/protected-app-image";
import { downloadAppImage } from "@/lib/download-app-image";
import { getGetAuditQueryKey, useGetAudit } from "@workspace/api-client-react";
import { AplusModuleGallery, type AplusModuleItem } from "@/components/aplus-module-gallery";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_IMAGE_TYPE_PROMPT_CONFIG,
  type GraphicsQuality,
  type ImageTypePromptConfig,
} from "@/components/custom-prompt-generation-panel";
import {
  ImageTypeCustomizeDialog,
  SelectedGraphicsTypesSummary,
} from "@/components/graphics-type-customize-ui";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { cn } from "@/lib/utils";
import { useApiAuthReady } from "@/components/api-token-bridge";
import { fetchJson } from "@/lib/api-fetch";
import { useAplusModuleCards } from "@/lib/image-prompt-templates";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const APLUS_MODULE_CARDS = [
  { id: "hero", label: "Hero Banner", desc: "High-impact visual for the top of the page", icon: "🖼️" },
  { id: "features", label: "Features Highlights", desc: "Detailed breakdown of key product benefits", icon: "🔍" },
  { id: "comparison", label: "Comparison Charts", desc: "Side-by-side comparison with competitors or models", icon: "📊" },
  { id: "brand_story", label: "Brand Story", desc: "Connect with customers through your brand's mission", icon: "📖" },
];

function formatAplusApiError(status: number, apiError?: string): string {
  if (apiError) return apiError;
  if (status === 404) {
    return "A+ API endpoint not found. Rebuild and restart the API server, then try again.";
  }
  if (status === 524 || status === 504 || status === 408) {
    return "Generation timed out at the network edge. If modules are still generating, wait for progress to update.";
  }
  return `Failed (${status})`;
}

export function readAplusFromAudit(generatedImages: unknown): {
  status: "idle" | "generating" | "completed" | "failed";
  modules: AplusModuleItem[];
  progress: { done: number; total: number };
  errorMessage?: string;
} {
  const aplus = (generatedImages as {
    aplus?: {
      status?: string;
      modules?: AplusModuleItem[];
      progress?: { done: number; total: number };
      errorMessage?: string;
      content?: unknown;
    };
  } | null)?.aplus;

  if (!aplus) {
    return { status: "idle", modules: [], progress: { done: 0, total: 4 } };
  }

  if (aplus.status) {
    const status = aplus.status === "generating"
      ? "generating"
      : aplus.status === "failed"
        ? "failed"
        : aplus.modules?.length
          ? "completed"
          : "idle";
    return {
      status,
      modules: aplus.modules ?? [],
      progress: aplus.progress ?? { done: aplus.modules?.length ?? 0, total: 4 },
      errorMessage: aplus.errorMessage,
    };
  }

  if (aplus.content && aplus.modules?.length) {
    return {
      status: "completed",
      modules: aplus.modules,
      progress: { done: aplus.modules.length, total: aplus.modules.length },
    };
  }

  return { status: "idle", modules: [], progress: { done: 0, total: 4 } };
}

export function AplusContentWizard({
  auditId,
  productName,
  embedded = false,
  createOnly = false,
}: {
  auditId: number;
  productName: string;
  embedded?: boolean;
  /** Product Explorer split view: create/optimize on the right; gallery on the left. */
  createOnly?: boolean;
}) {
  const { modules: APLUS_MODULE_CARDS, isLoading: aplusModulesLoading, modulesUnavailable } = useAplusModuleCards();
  const allAplusModuleIds = useMemo(() => APLUS_MODULE_CARDS.map((m) => m.id), [APLUS_MODULE_CARDS]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTeamMember, memberCredits } = useTeam();
  const apiAuthReady = useApiAuthReady();
  const completionToastShownRef = useRef(false);

  const { data: auditData } = useGetAudit(auditId, {
    query: { queryKey: getGetAuditQueryKey(auditId), enabled: auditId > 0 && apiAuthReady },
  });

  const { data: creditRules = [] } = useQuery<{ featureType: string; creditsRequired: number }[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });
  const aplusImageCostPerModule = creditRules.find((r) => r.featureType === "graphics")?.creditsRequired ?? 8;

  const [selectedAplusModules, setSelectedAplusModules] = useState<string[]>([]);
  const [aplusModulePromptConfigs, setAplusModulePromptConfigs] = useState<Record<string, ImageTypePromptConfig>>({});
  const [aplusModules, setAplusModules] = useState<AplusModuleItem[]>([]);
  const [aplusStatus, setAplusStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [aplusProgress, setAplusProgress] = useState({ done: 0, total: 4 });
  const [aplusCustomizeModuleId, setAplusCustomizeModuleId] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const syncedAuditIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!auditData?.generatedImages || syncedAuditIdRef.current === auditId) return;
    syncedAuditIdRef.current = auditId;
    const saved = readAplusFromAudit(auditData.generatedImages);
    if (saved.modules.length) setAplusModules(saved.modules);
    setAplusStatus(saved.status);
    setAplusProgress(saved.progress);
  }, [auditId, auditData?.generatedImages]);

  useEffect(() => {
    if (!auditData?.generatedImages) return;
    const saved = readAplusFromAudit(auditData.generatedImages);
    if (saved.modules.length) setAplusModules(saved.modules);
    if (aplusStatus === "generating" || saved.status === "generating") {
      setAplusProgress(saved.progress);
      if (saved.status !== "generating") {
        setAplusStatus(saved.status);
      }
    }
  }, [auditData?.generatedImages, aplusStatus]);

  const getAplusModuleConfig = useCallback((moduleId: string): ImageTypePromptConfig => ({
    ...DEFAULT_IMAGE_TYPE_PROMPT_CONFIG,
    ...aplusModulePromptConfigs[moduleId],
  }), [aplusModulePromptConfigs]);

  const updateAplusModuleConfig = useCallback((moduleId: string, patch: Partial<ImageTypePromptConfig>) => {
    setAplusModulePromptConfigs((prev) => ({
      ...prev,
      [moduleId]: { ...DEFAULT_IMAGE_TYPE_PROMPT_CONFIG, ...prev[moduleId], ...patch },
    }));
  }, []);

  const aplusModuleConfigsPayload = useMemo(() => {
    const payload: Record<string, {
      imageCustomPrompt?: string;
      promptReferenceImageUrls?: string[];
      quality?: GraphicsQuality;
    }> = {};
    for (const moduleId of selectedAplusModules) {
      const config = { ...DEFAULT_IMAGE_TYPE_PROMPT_CONFIG, ...aplusModulePromptConfigs[moduleId] };
      payload[moduleId] = {
        imageCustomPrompt: config.customPrompt.trim() || undefined,
        promptReferenceImageUrls: config.referenceImages.length > 0 ? config.referenceImages : undefined,
        quality: config.quality,
      };
    }
    return payload;
  }, [selectedAplusModules, aplusModulePromptConfigs]);

  const generateAplus = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${basePath}/api/audits/${auditId}/generate-aplus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          moduleIds: selectedAplusModules,
          moduleConfigs: aplusModuleConfigsPayload,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatAplusApiError(res.status, (err as { error?: string }).error));
      }
      if (res.status === 202) return { started: true as const };
      return res.json() as Promise<{ modules: AplusModuleItem[] }>;
    },
    onSuccess: (data) => {
      if ("started" in data && data.started) {
        setAplusStatus("generating");
        setAplusProgress({ done: 0, total: selectedAplusModules.length || 4 });
        completionToastShownRef.current = false;
        refreshCreditBalances(queryClient);
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
        return;
      }
      if ("modules" in data) {
        setAplusModules(data.modules);
        setAplusStatus("completed");
        refreshCreditBalances(queryClient);
        toast({ title: "A+ content generated!", description: "Copy and module images are ready." });
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
      }
    },
    onError: (err) => {
      setAplusStatus("failed");
      toast({
        title: "A+ generation failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!auditId || aplusStatus !== "generating" || !apiAuthReady) return;

    const poll = async () => {
      try {
        const audit = await fetchJson<{ generatedImages?: unknown }>(
          `${basePath}/api/audits/${auditId}`,
        );
        const aplus = readAplusFromAudit(audit.generatedImages);

        if (aplus.modules.length) setAplusModules(aplus.modules);
        setAplusProgress(aplus.progress);

        if (aplus.status === "generating") return;

        setAplusStatus(aplus.status === "failed" ? "failed" : "completed");

        if (aplus.status === "completed" && !completionToastShownRef.current) {
          completionToastShownRef.current = true;
          refreshCreditBalances(queryClient);
          toast({
            title: "A+ content generated!",
            description: `${aplus.modules.length} module images are ready.`,
          });
          void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
        } else if (aplus.status === "failed") {
          toast({
            title: "A+ generation failed",
            description: aplus.errorMessage ?? "Please try again",
            variant: "destructive",
          });
        }
      } catch {
        // keep polling
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 1500);
    return () => clearInterval(interval);
  }, [auditId, aplusStatus, apiAuthReady, queryClient, toast]);

  const handleGenerateAplus = () => {
    if (!productName.trim()) {
      toast({
        title: "Product name required",
        description: "Add a product name before generating A+ content.",
        variant: "destructive",
      });
      return;
    }
    if (modulesUnavailable) {
      toast({
        title: "A+ modules unavailable",
        description: "Could not load A+ module configuration. Refresh the page or ask an admin to enable A+ modules in Settings.",
        variant: "destructive",
      });
      return;
    }
    if (selectedAplusModules.length === 0) {
      toast({
        title: "Select modules",
        description: "Choose at least one A+ module to generate.",
        variant: "destructive",
      });
      return;
    }
    const imageCreditsNeeded = aplusImageCostPerModule * selectedAplusModules.length;
    if (isTeamMember && (memberCredits?.imageCredits ?? 0) < imageCreditsNeeded) {
      toast({
        title: "Insufficient image credits",
        description: `You need ${imageCreditsNeeded} image credits but only have ${memberCredits?.imageCredits ?? 0}.`,
        variant: "destructive",
      });
      return;
    }
    generateAplus.mutate();
  };

  const isGenerating = generateAplus.isPending || aplusStatus === "generating";
  const hasExistingModules = aplusModules.length > 0;
  const headingClass = embedded ? "text-lg font-bold" : "text-2xl font-bold";
  const subClass = embedded ? "text-xs text-slate-500 mt-0.5" : "text-base text-slate-500 mt-0.5";

  const generatedAplusModuleIds = useMemo(
    () => new Set(aplusModules.map((m) => m.id)),
    [aplusModules],
  );

  const handleDownloadAllAplus = () => {
    aplusModules.forEach((module, index) => {
      setTimeout(
        () => void downloadAppImage(module.imageUrl, `aplus-${module.id}.png`),
        index * 300,
      );
    });
  };

  const aplusGenerateProgress = aplusProgress.total > 0
    ? Math.min(95, (aplusProgress.done / aplusProgress.total) * 100)
    : 15;

  if (createOnly && isGenerating) {
    return (
      <div className={embedded ? "py-8" : "min-h-[40vh] flex items-center justify-center"}>
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
            <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-orange-500 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">Generating your A+ modules</h1>
            <p className="text-sm text-slate-500">
              {aplusProgress.done} / {aplusProgress.total || selectedAplusModules.length || "…"} complete
            </p>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${aplusGenerateProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const moduleSelectorGrid = (
    <div className={cn(
      "grid gap-3 w-full",
      createOnly ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
    )}>
      {(aplusModulesLoading && APLUS_MODULE_CARDS.length === 0) ? (
        <p className="text-xs text-slate-500 col-span-full py-4 text-center">Loading A+ modules…</p>
      ) : null}
      {APLUS_MODULE_CARDS.map((module) => {
        const isSelected = selectedAplusModules.includes(module.id);
        const isGenerated = generatedAplusModuleIds.has(module.id);
        const showCheck = isSelected || isGenerated;
        const cardClass = createOnly
          ? cn(
            "relative w-full rounded-xl border-2 p-4 sm:p-3 cursor-pointer transition-all text-left",
            isSelected
              ? "border-orange-500 bg-orange-50/30"
              : isGenerated
                ? "border-emerald-400/80 bg-emerald-50/25"
                : "border-slate-200 bg-white hover:border-slate-300",
            (isGenerating || modulesUnavailable) && "opacity-60 cursor-not-allowed",
          )
          : cn(
            "relative rounded-2xl border-2 p-5 text-left transition-all",
            isSelected
              ? "border-orange-500 bg-orange-50/40 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
            isGenerating && "opacity-60 cursor-not-allowed",
          );

        return (
          <button
            key={module.id}
            type="button"
            disabled={isGenerating || modulesUnavailable}
            onClick={() => {
              if (isGenerating || modulesUnavailable) return;
              if (createOnly) {
                if (!selectedAplusModules.includes(module.id)) {
                  setSelectedAplusModules((prev) => [...prev, module.id]);
                }
                setAplusCustomizeModuleId(module.id);
                return;
              }
              setSelectedAplusModules((prev) => (
                prev.includes(module.id)
                  ? prev.filter((id) => id !== module.id)
                  : [...prev, module.id]
              ));
            }}
            className={cardClass}
          >
            {createOnly ? (
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5">{module.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-orange-900" : isGenerated ? "text-emerald-900" : "text-slate-900",
                    )}
                    >
                      {module.label}
                    </h3>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        isSelected
                          ? "border-orange-500 bg-orange-500"
                          : isGenerated
                            ? "border-emerald-600 bg-emerald-600"
                            : "border-slate-300",
                      )}
                    >
                      {showCheck && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{module.desc}</p>
                  {isGenerated && !isSelected && (
                    <p className="text-[10px] font-medium text-emerald-700 mt-1">
                      Generated — select again to create another
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <span className="text-3xl leading-none block mb-3">{module.icon}</span>
                <p className={cn("text-base font-semibold", isSelected ? "text-orange-900" : "text-slate-900")}>
                  {module.label}
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-snug">{module.desc}</p>
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                {isGenerated && !isSelected && (
                  <div
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"
                    aria-label="Generated"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  const selectedSummary = selectedAplusModules.length > 0 && (
    <>
      <div className={cn("flex items-center gap-2", createOnly ? "text-sm" : "gap-3")}>
        <span className={cn(
          "rounded-full bg-orange-100 text-orange-700 font-semibold",
          createOnly ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm text-orange-600",
        )}
        >
          {selectedAplusModules.length} selected
        </span>
        {!createOnly && (
          <span className="text-xs text-slate-400">
            {selectedAplusModules.length === allAplusModuleIds.length
              ? "All modules will be generated"
              : `${selectedAplusModules.length} module${selectedAplusModules.length > 1 ? "s" : ""} will be generated`}
          </span>
        )}
        {createOnly && (
          <span className="text-slate-400 text-xs">
            ~{selectedAplusModules.length * 45}s total
          </span>
        )}
      </div>
      <SelectedGraphicsTypesSummary
        imageTypes={APLUS_MODULE_CARDS}
        selectedTypeIds={selectedAplusModules}
        getConfig={getAplusModuleConfig}
        onEdit={setAplusCustomizeModuleId}
        onRemove={(moduleId) => {
          setSelectedAplusModules((prev) => prev.filter((id) => id !== moduleId));
          if (aplusCustomizeModuleId === moduleId) setAplusCustomizeModuleId(null);
        }}
        instructionText="Selected modules — tap a row to customize prompt, references, and quality."
        hideAspectRatio
      />
    </>
  );

  const customizeDialog = (
    <ImageTypeCustomizeDialog
      open={aplusCustomizeModuleId !== null}
      onOpenChange={(open) => { if (!open) setAplusCustomizeModuleId(null); }}
      type={APLUS_MODULE_CARDS.find((m) => m.id === aplusCustomizeModuleId) ?? null}
      config={aplusCustomizeModuleId ? getAplusModuleConfig(aplusCustomizeModuleId) : DEFAULT_IMAGE_TYPE_PROMPT_CONFIG}
      onConfigChange={(patch) => {
        if (aplusCustomizeModuleId) updateAplusModuleConfig(aplusCustomizeModuleId, patch);
      }}
      hideAspectRatio
    />
  );

  const generateButton = (
    <Button
      size={createOnly ? "default" : (embedded ? "default" : "lg")}
      className={cn(
        createOnly
          ? "w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-6 min-h-11"
          : "w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2.5 shadow-lg shadow-orange-500/20 font-semibold",
        !createOnly && (embedded ? "h-11 text-sm" : "h-14 text-base"),
      )}
      disabled={
        isGenerating
        || modulesUnavailable
        || aplusModulesLoading
        || selectedAplusModules.length === 0
        || (isTeamMember && (memberCredits?.imageCredits ?? 0) < aplusImageCostPerModule * selectedAplusModules.length)
      }
      onClick={handleGenerateAplus}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating A+ Content…
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          {selectedAplusModules.length > 0
            ? (createOnly && hasExistingModules
              ? `Regenerate ${selectedAplusModules.length} Module${selectedAplusModules.length > 1 ? "s" : ""}`
              : `Generate ${selectedAplusModules.length} A+ Module${selectedAplusModules.length > 1 ? "s" : ""}`)
            : (createOnly && hasExistingModules ? "Optimize A+ Content" : "Generate A+ Content")}
        </>
      )}
    </Button>
  );

  if (createOnly) {
    return (
      <div className="w-full min-w-0 max-w-full space-y-6">
        {modulesUnavailable && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            A+ module templates are not available yet. Refresh the page; if this persists, an admin must enable A+ modules under Settings → Image prompts.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select A+ Content</h2>
              <p className="text-xs text-slate-500">Choose the modules you want to generate. You can select multiple.</p>
            </div>
          </div>
          {moduleSelectorGrid}
          {selectedSummary}
          {customizeDialog}
        </div>

        {aplusModules.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Generated A+ content ({aplusModules.length})
              </p>
              {aplusModules.length > 0 && (
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadAllAplus}>
                  <Download className="w-3 h-3" />
                  Download all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {aplusModules.map((module) => (
                <div key={module.id} className="group relative rounded-lg border overflow-hidden bg-white">
                  <div className="aspect-square relative overflow-hidden bg-slate-50">
                    <ProtectedAppImage
                      src={module.imageUrl}
                      alt={module.title}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        title="View full screen"
                        className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-sm"
                        onClick={() => setFullscreenUrl(module.imageUrl)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Download"
                        className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-sm"
                        onClick={() => void downloadAppImage(module.imageUrl, `aplus-${module.id}.png`)}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-slate-600 px-2 py-1.5 truncate border-t border-slate-100">
                    {module.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 w-full">
          {generateButton}
        </div>

        <Dialog open={fullscreenUrl !== null} onOpenChange={(open) => { if (!open) setFullscreenUrl(null); }}>
          <DialogContent className="max-w-5xl p-2 sm:p-4 border-0 bg-transparent shadow-none">
            {fullscreenUrl && (
              <ProtectedAppImage
                src={fullscreenUrl}
                alt="A+ module"
                className="w-full max-h-[85vh] object-contain rounded-xl bg-black/20 mx-auto"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-5" : "space-y-8"}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "rounded-xl bg-orange-100 flex items-center justify-center shrink-0",
          embedded ? "w-10 h-10" : "w-12 h-12",
        )}
        >
          <Sparkles className={cn("text-orange-500", embedded ? "w-5 h-5" : "w-6 h-6")} />
        </div>
        <div>
          <h2 className={cn(headingClass, "text-slate-900")}>Create A+ Content</h2>
          <p className={subClass}>Choose the modules you want to generate. You can select multiple.</p>
        </div>
      </div>

      {modulesUnavailable && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          A+ module templates are not available yet. Refresh the page; if this persists, an admin must enable A+ modules under Settings → Image prompts.
        </p>
      )}

      {moduleSelectorGrid}
      {selectedSummary}
      {customizeDialog}
      {generateButton}

      {aplusStatus === "generating" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">
              Generating {aplusProgress.total} A+ module image{aplusProgress.total > 1 ? "s" : ""}…
            </span>
            <span className="text-orange-600 font-semibold">
              {aplusProgress.done} / {aplusProgress.total}
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${aplusProgress.total > 0 ? (aplusProgress.done / aplusProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">This can take a few minutes. Keep this page open while images finish.</p>
        </div>
      )}

      {aplusModules.length > 0 && (
        <AplusModuleGallery
          auditId={auditId}
          modules={aplusModules}
          onModulesUpdate={(updated) => {
            setAplusModules(updated);
            void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
          }}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-amber-900">✦ A+ Content requires Brand Registry</p>
        <p className="text-sm text-amber-700 mt-1">
          Ensure your brand is enrolled in Amazon Brand Registry before publishing A+ Content modules.
        </p>
      </div>
    </div>
  );
}
