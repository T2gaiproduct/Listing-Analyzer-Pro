import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const APLUS_MODULE_CARDS = [
  { id: "hero" as const, label: "Hero Banner", desc: "High-impact visual for the top of the page", icon: "🖼️" },
  { id: "features" as const, label: "Features Highlights", desc: "Detailed breakdown of key product benefits", icon: "🔍" },
  { id: "comparison" as const, label: "Comparison Charts", desc: "Side-by-side comparison with competitors or models", icon: "📊" },
  { id: "brand_story" as const, label: "Brand Story", desc: "Connect with customers through your brand's mission", icon: "📖" },
];

type AplusModuleId = (typeof APLUS_MODULE_CARDS)[number]["id"];
const ALL_APLUS_MODULE_IDS: AplusModuleId[] = APLUS_MODULE_CARDS.map((m) => m.id);

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

function readAplusFromAudit(generatedImages: unknown): {
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
}: {
  auditId: number;
  productName: string;
  embedded?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTeamMember, memberCredits } = useTeam();
  const completionToastShownRef = useRef(false);

  const { data: auditData } = useGetAudit(auditId, {
    query: { queryKey: getGetAuditQueryKey(auditId), enabled: auditId > 0 },
  });

  const { data: creditRules = [] } = useQuery<{ featureType: string; creditsRequired: number }[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });
  const aplusImageCostPerModule = creditRules.find((r) => r.featureType === "graphics")?.creditsRequired ?? 8;

  const [selectedAplusModules, setSelectedAplusModules] = useState<AplusModuleId[]>([]);
  const [aplusModulePromptConfigs, setAplusModulePromptConfigs] = useState<Record<string, ImageTypePromptConfig>>({});
  const [aplusModules, setAplusModules] = useState<AplusModuleItem[]>([]);
  const [aplusStatus, setAplusStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [aplusProgress, setAplusProgress] = useState({ done: 0, total: 4 });
  const [aplusCustomizeModuleId, setAplusCustomizeModuleId] = useState<string | null>(null);
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
        imageCustomPrompt: config.imageCustomPrompt?.trim() || undefined,
        promptReferenceImageUrls: config.promptReferenceImageUrls?.length
          ? config.promptReferenceImageUrls
          : undefined,
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
    if (!auditId || aplusStatus !== "generating") return;

    const poll = async () => {
      try {
        const res = await fetch(`${basePath}/api/audits/${auditId}`, { credentials: "include" });
        if (!res.ok) return;
        const audit = await res.json() as { generatedImages?: unknown };
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
    const interval = setInterval(() => void poll(), 2500);
    return () => clearInterval(interval);
  }, [auditId, aplusStatus, queryClient, toast]);

  const handleGenerateAplus = () => {
    if (!productName.trim()) {
      toast({
        title: "Product name required",
        description: "Add a product name before generating A+ content.",
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
  const headingClass = embedded ? "text-lg font-bold" : "text-2xl font-bold";
  const subClass = embedded ? "text-xs text-slate-500 mt-0.5" : "text-base text-slate-500 mt-0.5";

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {APLUS_MODULE_CARDS.map((module) => {
          const isSelected = selectedAplusModules.includes(module.id);
          const generated = aplusModules.find((m) => m.id === module.id);
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => {
                if (isGenerating) return;
                if (!selectedAplusModules.includes(module.id)) {
                  setSelectedAplusModules((prev) => [...prev, module.id]);
                }
                setAplusCustomizeModuleId(module.id);
              }}
              disabled={isGenerating}
              className={cn(
                "relative rounded-2xl border-2 p-5 text-left transition-all",
                isSelected
                  ? "border-orange-500 bg-orange-50/40 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
                isGenerating && "opacity-60 cursor-not-allowed",
              )}
            >
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
              {generated && !isSelected && (
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"
                  aria-label="Generated"
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedAplusModules.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 font-semibold text-sm">
            {selectedAplusModules.length} selected
          </span>
          <span className="text-xs text-slate-400">
            {selectedAplusModules.length === ALL_APLUS_MODULE_IDS.length
              ? "All modules will be generated"
              : `${selectedAplusModules.length} module${selectedAplusModules.length > 1 ? "s" : ""} will be generated`}
          </span>
        </div>
      )}

      {selectedAplusModules.length > 0 && (
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
      )}

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

      <Button
        size={embedded ? "default" : "lg"}
        className={cn(
          "w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2.5 shadow-lg shadow-orange-500/20 font-semibold",
          embedded ? "h-11 text-sm" : "h-14 text-base",
        )}
        disabled={
          isGenerating
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
              ? `Generate ${selectedAplusModules.length} A+ Module${selectedAplusModules.length > 1 ? "s" : ""}`
              : "Generate A+ Content"}
          </>
        )}
      </Button>

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
