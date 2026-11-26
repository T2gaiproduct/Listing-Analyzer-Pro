import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Maximize2, Sparkles, Wand2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProtectedAppImage } from "@/components/protected-app-image";
import { downloadAppImage } from "@/lib/download-app-image";
import { resolveAppImageUrl } from "@/lib/protected-app-image";
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
import {
  useAplusModuleCards,
  type AplusContentTier,
  type AplusModuleCard,
} from "@/lib/image-prompt-templates";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** @deprecated Prefer useAplusModuleCards() — kept for imports that expect a static list. */
export const APLUS_MODULE_CARDS: AplusModuleCard[] = [
  {
    id: "hero",
    label: "Image & Dark Text Overlay",
    desc: "970×300 (Standard)",
    icon: "🖼️",
    aplusTier: "standard",
    imageWidth: 970,
    imageHeight: 300,
  },
  {
    id: "features",
    label: "Four Image Highlights",
    desc: "400×400 (Standard)",
    icon: "🔍",
    aplusTier: "standard",
    imageWidth: 400,
    imageHeight: 400,
  },
  {
    id: "comparison",
    label: "Comparison Chart",
    desc: "150×300 (Standard)",
    icon: "📊",
    aplusTier: "standard",
    imageWidth: 150,
    imageHeight: 300,
  },
  {
    id: "brand_story",
    label: "Brand background / story card",
    desc: "Match selected Brand Story card in A+ Content Manager",
    icon: "📖",
    aplusTier: "brand_story",
    imageWidth: 1464,
    imageHeight: 600,
  },
  {
    id: "brand_logo_identity",
    label: "Brand logo / brand identity",
    desc: "Clean high-res logo for Brand Story",
    icon: "🏷️",
    aplusTier: "brand_story",
    imageWidth: 600,
    imageHeight: 600,
  },
  {
    id: "brand_story_image_text",
    label: "Brand story image and text",
    desc: "Layout first, then match card image ratio",
    icon: "✍️",
    aplusTier: "brand_story",
    imageWidth: 1464,
    imageHeight: 600,
  },
  {
    id: "brand_asin_showcase",
    label: "Product / ASIN showcase",
    desc: "ASIN showcase imagery — verify in preview",
    icon: "📦",
    aplusTier: "brand_story",
    imageWidth: 800,
    imageHeight: 800,
  },
];

const APLUS_TIER_TABS: { id: AplusContentTier; label: string; hint: string }[] = [
  {
    id: "standard",
    label: "Standard A+",
    hint: "Basic product-description modules. Cannot mix with Premium in one Amazon document.",
  },
  {
    id: "premium",
    label: "Premium A+",
    hint: "Enhanced modules (video, hotspots, carousels). Cannot mix with Standard.",
  },
  {
    id: "brand_story",
    label: "Brand Story",
    hint: "Four Brand Story elements (background card, logo, story image+text, ASIN showcase). Separate From the Brand content — not mixed with Standard/Premium.",
  },
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

function collectOverviewImageUrlsFromAudit(audit: {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
} | undefined): string[] {
  const urls: string[] = [];
  const add = (url: string | undefined | null) => {
    const trimmed = url?.trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  };
  for (const rec of audit?.imageRecords ?? []) add(rec.currentUrl);
  for (const url of audit?.imageUrls ?? []) add(url);
  return urls;
}

export function AplusContentWizard({
  auditId,
  productName,
  embedded = false,
  createOnly = false,
  overviewImageUrls,
}: {
  auditId: number;
  productName: string;
  embedded?: boolean;
  /** Product Explorer split view: create/optimize on the right; gallery on the left. */
  createOnly?: boolean;
  /** Product Overview gallery — used as product reference during A+ image generation. */
  overviewImageUrls?: string[] | null;
}) {
  const { modules: aplusModuleCards, isLoading: aplusModulesLoading, modulesUnavailable } = useAplusModuleCards();
  const [aplusTier, setAplusTier] = useState<AplusContentTier>("standard");
  const visibleAplusModules = useMemo(
    () => aplusModuleCards.filter((m) => m.aplusTier === aplusTier),
    [aplusModuleCards, aplusTier],
  );
  const moduleById = useMemo(() => {
    const map = new Map<string, AplusModuleCard>();
    for (const m of aplusModuleCards) map.set(m.id, m);
    return map;
  }, [aplusModuleCards]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTeamMember, memberCredits } = useTeam();
  const apiAuthReady = useApiAuthReady();
  const completionToastShownRef = useRef(false);
  const failureToastShownRef = useRef(false);

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

  const switchAplusTier = useCallback((tier: AplusContentTier) => {
    setAplusTier(tier);
    setSelectedAplusModules((prev) =>
      prev.filter((id) => aplusModuleCards.find((m) => m.id === id)?.aplusTier === tier),
    );
    setAplusCustomizeModuleId(null);
  }, [aplusModuleCards]);

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
    // While locally generating, only sync progress from server "generating".
    // Do not clear the loader from a stale cached "completed" after invalidateQueries.
    if (aplusStatus === "generating") {
      if (saved.status === "generating") {
        setAplusProgress(saved.progress);
      }
      return;
    }
    if (saved.status === "generating") {
      setAplusStatus("generating");
      setAplusProgress(saved.progress);
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

  const referenceImageUrls = useMemo(() => {
    const merged = [...(overviewImageUrls ?? []), ...collectOverviewImageUrlsFromAudit(auditData)];
    const out: string[] = [];
    for (const url of merged) {
      const t = url?.trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  }, [auditData, overviewImageUrls]);

  const generateAplus = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${basePath}/api/audits/${auditId}/generate-aplus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          moduleIds: selectedAplusModules,
          moduleConfigs: aplusModuleConfigsPayload,
          imageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
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
        failureToastShownRef.current = false;
        refreshCreditBalances(queryClient);
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
        return;
      }
      if ("modules" in data) {
        setAplusModules(data.modules);
        setAplusStatus("completed");
        refreshCreditBalances(queryClient);
        if (!completionToastShownRef.current) {
          completionToastShownRef.current = true;
          toast({ title: "A+ content generated!", description: "Copy and module images are ready." });
        }
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Please try again";
      // Server already started — keep the loader and resume polling instead of failing.
      if (/already in progress/i.test(message)) {
        setAplusStatus("generating");
        setAplusProgress((prev) => ({
          done: prev.done,
          total: prev.total || selectedAplusModules.length || 4,
        }));
        toast({
          title: "Generation in progress",
          description: "Your A+ modules are still generating. Showing progress…",
        });
        void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
        return;
      }
      setAplusStatus("failed");
      toast({
        title: "A+ generation failed",
        description: message,
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
        } else if (aplus.status === "failed" && !failureToastShownRef.current) {
          failureToastShownRef.current = true;
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
    if (generateAplus.isPending || aplusStatus === "generating") return;
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
    // Show loader immediately (before the network round-trip) so regenerate
    // cannot be double-clicked while the request is in flight.
    setAplusStatus("generating");
    setAplusProgress({ done: 0, total: selectedAplusModules.length || 4 });
    completionToastShownRef.current = false;
    failureToastShownRef.current = false;
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
    <div className="space-y-3 w-full">
      <div className="flex flex-wrap gap-2">
        {APLUS_TIER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={isGenerating}
            onClick={() => switchAplusTier(tab.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
              aplusTier === tab.id
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-orange-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        {APLUS_TIER_TABS.find((t) => t.id === aplusTier)?.hint}
        {" "}
        Module prompts and instructions come from Admin → AI Skills (A+ content).
      </p>
      {aplusTier === "brand_story" ? (
        <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-3.5 py-3 sm:px-4">
          <p className="text-xs font-semibold text-orange-800">
            Brand Story — 4 production elements
          </p>
          <p className="text-[11px] text-orange-700/90 mt-1 leading-relaxed">
            Separate From the Brand content (not mixed with Standard/Premium): background/story card,
            logo/identity, story image + text, and product/ASIN showcase. Match sizes shown in A+ Content Manager.
          </p>
        </div>
      ) : null}
      <div className={cn(
        "grid gap-3 w-full",
        aplusTier === "brand_story"
          ? (createOnly ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4")
          : (createOnly ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"),
      )}>
        {(aplusModulesLoading && visibleAplusModules.length === 0) ? (
          <p className="text-xs text-slate-500 col-span-full py-4 text-center">Loading A+ modules…</p>
        ) : null}
        {!aplusModulesLoading && visibleAplusModules.length === 0 ? (
          <p className="text-xs text-slate-500 col-span-full py-4 text-center">
            No {aplusTier.replace("_", " ")} modules enabled yet. An admin can publish them under AI Skills / Image prompts.
          </p>
        ) : null}
        {visibleAplusModules.map((module) => {
          const isSelected = selectedAplusModules.includes(module.id);
          const isGenerated = generatedAplusModuleIds.has(module.id);
          const dim =
            module.imageWidth && module.imageHeight
              ? `${module.imageWidth}×${module.imageHeight}`
              : null;
          const cardClass = createOnly
            ? cn(
              "relative w-full rounded-xl border-2 p-4 sm:p-3 cursor-pointer transition-all text-left",
              isSelected
                ? "border-orange-500 bg-orange-50/30"
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
                  if (selectedAplusModules.includes(module.id)) {
                    setSelectedAplusModules((prev) => prev.filter((id) => id !== module.id));
                    if (aplusCustomizeModuleId === module.id) setAplusCustomizeModuleId(null);
                    return;
                  }
                  setSelectedAplusModules((prev) => {
                    const sameTier = prev.filter((id) => moduleById.get(id)?.aplusTier === module.aplusTier);
                    return [...sameTier, module.id];
                  });
                  setAplusCustomizeModuleId(module.id);
                  return;
                }
                setSelectedAplusModules((prev) => {
                  if (prev.includes(module.id)) return prev.filter((id) => id !== module.id);
                  const sameTier = prev.filter((id) => moduleById.get(id)?.aplusTier === module.aplusTier);
                  return [...sameTier, module.id];
                });
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
                        isSelected ? "text-orange-900" : "text-slate-900",
                      )}
                      >
                        {module.label}
                      </h3>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "border-orange-500 bg-orange-500"
                            : "border-slate-300",
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{module.desc}</p>
                    {dim && (
                      <p className="text-[10px] font-semibold text-orange-600/90 mt-1 tabular-nums">{dim}px</p>
                    )}
                    {isGenerated && !isSelected && (
                      <p className="text-[10px] font-medium text-slate-500 mt-1">
                        Already generated — select to regenerate
                      </p>
                    )}
                    {isSelected && createOnly && (
                      <p className="text-[10px] font-medium text-slate-500 mt-1">
                        Tap again to remove from selection
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
                  {dim && (
                    <p className="text-[11px] font-semibold text-orange-600 mt-2 tabular-nums">{dim} px</p>
                  )}
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
            {selectedAplusModules.length === visibleAplusModules.length && visibleAplusModules.length > 0
              ? `All ${aplusTier.replace("_", " ")} modules will be generated`
              : `${selectedAplusModules.length} module${selectedAplusModules.length > 1 ? "s" : ""} will be generated`}
          </span>
        )}
        {createOnly && (
          <span className="text-slate-400 text-xs">
            ~{selectedAplusModules.length * 45}s total
          </span>
        )}
      </div>
      {!createOnly && (
        <SelectedGraphicsTypesSummary
          imageTypes={aplusModuleCards}
          selectedTypeIds={selectedAplusModules}
          getConfig={getAplusModuleConfig}
          onEdit={setAplusCustomizeModuleId}
          onRemove={(moduleId) => {
            setSelectedAplusModules((prev) => prev.filter((id) => id !== moduleId));
            if (aplusCustomizeModuleId === moduleId) setAplusCustomizeModuleId(null);
          }}
          instructionText="Selected modules — tap a row to customize prompt, references, and quality (Admin AI Skills supply the base instruction)."
          hideAspectRatio
        />
      )}
    </>
  );

  const customizeDialog = (
    <ImageTypeCustomizeDialog
      open={aplusCustomizeModuleId !== null}
      onOpenChange={(open) => { if (!open) setAplusCustomizeModuleId(null); }}
      type={aplusModuleCards.find((m) => m.id === aplusCustomizeModuleId) ?? null}
      config={aplusCustomizeModuleId ? getAplusModuleConfig(aplusCustomizeModuleId) : DEFAULT_IMAGE_TYPE_PROMPT_CONFIG}
      onConfigChange={(patch) => {
        if (aplusCustomizeModuleId) updateAplusModuleConfig(aplusCustomizeModuleId, patch);
      }}
      hideAspectRatio
      productCategory={auditData?.category ?? null}
      templateCategory="aplus"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aplusModules.map((module) => (
                <div key={module.id} className="group relative rounded-lg border overflow-hidden bg-white">
                  <button
                    type="button"
                    className="w-full aspect-[970/300] relative overflow-hidden bg-slate-100 block cursor-zoom-in"
                    onClick={() => setFullscreenUrl(module.imageUrl)}
                    aria-label={`View ${module.title} full screen`}
                  >
                    <ProtectedAppImage
                      src={module.imageUrl}
                      alt={module.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                      <span className="p-2 rounded-full bg-white/90 text-slate-800 shadow-sm">
                        <Maximize2 className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-slate-100 bg-slate-50/80">
                    <p className="text-[10px] font-medium text-slate-600 truncate">{module.title}</p>
                    <button
                      type="button"
                      title="Download"
                      className="p-1.5 rounded-md hover:bg-white text-slate-600 shrink-0"
                      onClick={() => void downloadAppImage(module.imageUrl, `aplus-${module.id}.png`)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 w-full">
          {generateButton}
        </div>

        <Dialog open={fullscreenUrl !== null} onOpenChange={(open) => { if (!open) setFullscreenUrl(null); }}>
          <DialogContent className="max-w-[min(96vw,1200px)] w-full p-2 sm:p-4 border-0 bg-slate-950/95 shadow-none">
            {fullscreenUrl && (
              <div className="relative">
                <img
                  src={resolveAppImageUrl(fullscreenUrl)}
                  alt="A+ module full size"
                  className="w-full max-h-[88vh] object-contain rounded-lg mx-auto"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-lg hover:bg-slate-100"
                  onClick={() => setFullscreenUrl(null)}
                  aria-label="Close full screen preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
