import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save, Sparkles } from "lucide-react";
import { getGetAuditQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import type { GeneratedContent } from "@workspace/api-client-react";
import {
  cloneListingContentView,
  generatedContentToListingView,
  ListingContentCard,
  ListingMarketplaceContentCompare,
  ListingSuggestionsCard,
  listingViewToGenerated,
  resolveExistingContentForMarketplaceSlug,
  type ListingContentAttribute,
  type ListingContentView,
} from "@/components/listing-content-card";
import type { ListingContentFieldKey } from "@/lib/listing-content-field-merge";
import {
  defaultFieldSourcesAi,
  LISTING_CONTENT_FIELD_KEYS,
  resolveAiSnapshot,
  type ContentVariantWithMeta,
  type ListingContentFieldSources,
} from "@/lib/listing-content-field-merge";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fieldSourcesEqual(
  a: ListingContentFieldSources,
  b: ListingContentFieldSources,
): boolean {
  return LISTING_CONTENT_FIELD_KEYS.every((key) => (a[key] ?? "ai") === (b[key] ?? "ai"));
}

export type ContentVariantRow = {
  contentMarketplaceId: number;
  generatedContent: GeneratedContent & ContentVariantWithMeta;
};

export function ListingMarketplaceContentPanel({
  contentMarketplaces,
  contentMarketplaceId,
  onContentMarketplaceChange,
  contentVariants,
  legacyGeneratedContent,
  legacyMarketplaceId,
  suggestions,
  isOptimizing,
  onGenerate,
  optimizeDisabled,
  marketplacesLoading,
  existingContent,
  storeDescriptionHtml,
  showListingCompare,
  auditId,
  onContentVariantsUpdated,
  onFieldSelectionsSaved,
}: {
  contentMarketplaces: ContentMarketplaceOption[];
  contentMarketplaceId?: number;
  onContentMarketplaceChange: (id: number) => void;
  contentVariants: ContentVariantRow[];
  legacyGeneratedContent?: GeneratedContent | null;
  legacyMarketplaceId?: number | null;
  suggestions: string[];
  isOptimizing: boolean;
  onGenerate: (marketplaceIds: number[]) => void;
  optimizeDisabled?: boolean;
  marketplacesLoading?: boolean;
  /** Imported / audit listing snapshot for side-by-side compare. */
  existingContent?: ListingContentView | null;
  storeDescriptionHtml?: string | null;
  showListingCompare?: boolean;
  auditId?: number | null;
  onContentVariantsUpdated?: (variants: ContentVariantRow[]) => void;
  onFieldSelectionsSaved?: (contentMarketplaceId: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const variantMap = useMemo(() => {
    const map = new Map<number, GeneratedContent & ContentVariantWithMeta>();
    for (const row of contentVariants) {
      map.set(row.contentMarketplaceId, row.generatedContent);
    }
    if (
      legacyGeneratedContent?.title?.trim()
      && legacyMarketplaceId != null
      && !map.has(legacyMarketplaceId)
    ) {
      map.set(legacyMarketplaceId, legacyGeneratedContent);
    }
    return map;
  }, [contentVariants, legacyGeneratedContent, legacyMarketplaceId]);

  const [generatingMarketplaceIds, setGeneratingMarketplaceIds] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!contentMarketplaces.length) return;
    if (contentMarketplaceId != null && contentMarketplaces.some((m) => m.id === contentMarketplaceId)) {
      return;
    }
    onContentMarketplaceChange(contentMarketplaces[0].id);
  }, [contentMarketplaces, contentMarketplaceId, onContentMarketplaceChange]);

  useEffect(() => {
    if (!isOptimizing) setGeneratingMarketplaceIds(new Set());
  }, [isOptimizing]);

  const activeMarketplace = contentMarketplaceId != null
    ? contentMarketplaces.find((m) => m.id === contentMarketplaceId)
    : undefined;
  const activeContent = contentMarketplaceId != null ? variantMap.get(contentMarketplaceId) : undefined;
  const activeView = generatedContentToListingView(activeContent);
  const aiView = generatedContentToListingView(
    activeContent ? resolveAiSnapshot(activeContent) : undefined,
  );
  const savedFieldSources = activeContent?.fieldSources ?? defaultFieldSourcesAi();
  const [draftFieldSources, setDraftFieldSources] = useState<ListingContentFieldSources>(savedFieldSources);

  const savedFieldSourcesKey = JSON.stringify(savedFieldSources);
  const savedAiView = useMemo(
    () => (aiView ? cloneListingContentView(aiView) : null),
    [aiView],
  );
  const savedAiViewKey = savedAiView ? JSON.stringify(savedAiView) : "";

  const [draftAiView, setDraftAiView] = useState<ListingContentView | null>(savedAiView);
  const [editingField, setEditingField] = useState<ListingContentFieldKey | null>(null);
  const [editingAttributeIndex, setEditingAttributeIndex] = useState<number | null>(null);

  useEffect(() => {
    setDraftFieldSources(savedFieldSources);
  }, [contentMarketplaceId, savedFieldSourcesKey]);

  useEffect(() => {
    setDraftAiView(savedAiView ? cloneListingContentView(savedAiView) : null);
    setEditingField(null);
    setEditingAttributeIndex(null);
  }, [contentMarketplaceId, savedAiViewKey]);

  const aiEditsDirty = Boolean(
    savedAiView
    && draftAiView
    && JSON.stringify(savedAiView) !== JSON.stringify(draftAiView),
  );
  const selectionsDirty =
    !fieldSourcesEqual(draftFieldSources, savedFieldSources) || aiEditsDirty;

  const saveFieldSelections = useMutation({
    mutationFn: async (payload: {
      sources: ListingContentFieldSources;
      aiSnapshot?: ReturnType<typeof listingViewToGenerated>;
    }) => {
      if (!auditId || contentMarketplaceId == null) {
        throw new Error("Missing audit or marketplace");
      }
      const res = await fetch(
        `${basePath}/api/audits/${auditId}/content-variants/${contentMarketplaceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fieldSources: payload.sources,
            ...(payload.aiSnapshot ? { aiSnapshot: payload.aiSnapshot } : {}),
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save selections");
      }
      return res.json() as Promise<{
        contentVariants: ContentVariantRow[];
        contentMarketplaceId: number;
      }>;
    },
    onSuccess: (data) => {
      onContentVariantsUpdated?.(data.contentVariants);
      if (contentMarketplaceId != null) {
        onFieldSelectionsSaved?.(contentMarketplaceId);
      }
      void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId!) });
      toast({
        title: "Selections saved",
        description: activeMarketplace?.name
          ? `Listing Preview for ${activeMarketplace.name} now uses your green-box choices.`
          : "Listing Preview now uses your green-box choices.",
      });
    },
    onError: (err) => {
      toast({
        title: "Could not save selections",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    },
  });
  const hasActiveContent = Boolean(activeView?.title?.trim())
    || (activeView?.bulletPoints?.length ?? 0) > 0
    || (activeView?.keywords?.length ?? 0) > 0
    || activeView?.htmlDescription?.trim()
    || (activeView?.attributes?.length ?? 0) > 0;

  const existingForTab = useMemo(
    () => resolveExistingContentForMarketplaceSlug(
      existingContent,
      activeMarketplace?.slug,
      storeDescriptionHtml,
    ),
    [existingContent, activeMarketplace?.slug, storeDescriptionHtml],
  );

  const useCompareLayout = Boolean(showListingCompare && existingForTab);

  const primaryGenerateDisabled =
    optimizeDisabled
    || isOptimizing
    || contentMarketplaceId == null
    || contentMarketplaces.length === 0;

  const runPrimaryGenerate = () => {
    if (contentMarketplaceId == null) return;
    setGeneratingMarketplaceIds(new Set([contentMarketplaceId]));
    onGenerate([contentMarketplaceId]);
  };

  const generatingActiveTab = Boolean(
    isOptimizing
    && contentMarketplaceId != null
    && (
      generatingMarketplaceIds.size === 0
      || generatingMarketplaceIds.has(contentMarketplaceId)
    ),
  );

  const primaryGenerateLabel = activeMarketplace?.name
    ? `Generate for ${activeMarketplace.name}`
    : "Generate";

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      {marketplacesLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading marketplaces…
        </div>
      ) : contentMarketplaces.length === 0 ? (
        <p className="text-[11px] text-slate-500">No content marketplaces configured. Add them in Admin.</p>
      ) : (
        <div className="flex items-end justify-between gap-3 border-b border-slate-200">
          <div className="overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-0 min-w-max">
              {contentMarketplaces.map((m) => {
                const isActive = m.id === contentMarketplaceId;
                const hasVariant = variantMap.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onContentMarketplaceChange(m.id)}
                    className={cn(
                      "relative px-4 py-2.5 text-left border-b-2 transition-colors shrink-0 -mb-px",
                      isActive
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200",
                    )}
                  >
                    <span className="text-[11px] font-semibold flex items-center gap-1.5">
                      {m.name}
                      {hasVariant && (
                        <Check className="w-3 h-3 text-emerald-600" aria-label="Has optimized content" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 mb-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] rounded-md max-w-[11rem]"
              onClick={runPrimaryGenerate}
              disabled={primaryGenerateDisabled}
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin shrink-0" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1 opacity-70 shrink-0" />
                  <span className="truncate">{primaryGenerateLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-orange-200/80 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-orange-100 bg-orange-50/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
              Optimized content
            </p>
          </div>
          {useCompareLayout && hasActiveContent && auditId && (
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-7 text-[10px] shrink-0 gap-1",
                selectionsDirty
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-slate-400 hover:bg-slate-500 cursor-default",
              )}
              disabled={!selectionsDirty || saveFieldSelections.isPending || optimizeDisabled}
              onClick={() => saveFieldSelections.mutate({
                sources: draftFieldSources,
                aiSnapshot: draftAiView ? listingViewToGenerated(draftAiView) : undefined,
              })}
            >
              {saveFieldSelections.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>

        <div className="min-w-0">
          {generatingActiveTab && !hasActiveContent ? (
            <div className="px-4 py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-[11px] text-slate-600">
                Generating optimized copy for {activeMarketplace?.name ?? "this marketplace"}…
              </p>
            </div>
          ) : useCompareLayout ? (
            <>
              {!hasActiveContent && !generatingActiveTab && (
                <div className="px-4 pt-4 pb-2 border-b border-orange-100/80">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Compare your current listing on{" "}
                    <span className="font-semibold text-slate-800">{activeMarketplace?.name}</span>{" "}
                    with AI-optimized copy for this marketplace. Use{" "}
                    <span className="font-semibold text-slate-800">{primaryGenerateLabel}</span>{" "}
                    at the top right.
                  </p>
                </div>
              )}
              <ListingMarketplaceContentCompare
                existing={existingForTab}
                optimized={draftAiView ?? aiView ?? activeView}
                marketplaceName={activeMarketplace?.name}
                fieldSources={draftFieldSources}
                fieldPickDisabled={optimizeDisabled || !auditId || saveFieldSelections.isPending}
                editDisabled={!auditId || saveFieldSelections.isPending}
                editingField={editingField}
                onEditingFieldChange={(field) => {
                  setEditingField(field);
                  if (field != null) setEditingAttributeIndex(null);
                }}
                editingAttributeIndex={editingAttributeIndex}
                onEditingAttributeIndexChange={setEditingAttributeIndex}
                onOptimizedFieldChange={(field, value) => {
                  setDraftAiView((prev) => {
                    const base = prev ?? (aiView ? cloneListingContentView(aiView) : null);
                    if (!base) return prev;
                    const next = cloneListingContentView(base);
                    if (field === "title" && typeof value === "string") next.title = value;
                    if (field === "bulletPoints" && Array.isArray(value)) {
                      next.bulletPoints = value.filter((v): v is string => typeof v === "string");
                    }
                    if (field === "keywords" && Array.isArray(value)) {
                      next.keywords = value.filter((v): v is string => typeof v === "string");
                    }
                    if (field === "htmlDescription" && typeof value === "string") next.htmlDescription = value;
                    if (field === "attributes" && Array.isArray(value)) {
                      next.attributes = value.filter(
                        (v): v is ListingContentAttribute =>
                          typeof v === "object"
                          && v !== null
                          && "attribute" in v
                          && "value" in v,
                      );
                    }
                    return next;
                  });
                }}
                onFieldSourceChange={(field, source) => {
                  setDraftFieldSources((prev) => ({ ...prev, [field]: source }));
                }}
              />
              {hasActiveContent && auditId && (
                <p className="px-4 pb-3 text-[10px] text-slate-500 text-center">
                  Green box = your choice (✓ AI or ✕ current). Click{" "}
                  <span className="font-semibold text-slate-700">Save</span>{" "}
                  for this marketplace tab — Listing Preview updates only after Save.
                  {selectionsDirty && (
                    <span className="block mt-1 text-amber-800 font-medium">Unsaved changes on this tab.</span>
                  )}
                </p>
              )}
              {generatingActiveTab && hasActiveContent && (
                <div className="px-4 pb-4 flex items-center justify-center gap-2 text-[11px] text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  Regenerating optimized copy for {activeMarketplace?.name ?? "this marketplace"}…
                </div>
              )}
            </>
          ) : !hasActiveContent ? (
            <div className="px-4 py-4 space-y-3">
              <p className="text-[11px] text-slate-600">
                No optimized content for{" "}
                <span className="font-semibold text-slate-800">{activeMarketplace?.name ?? "this marketplace"}</span>{" "}
                yet. Use <span className="font-semibold text-slate-800">{primaryGenerateLabel}</span> at the top
                right.
              </p>
              {suggestions.length > 0 && (
                <ListingSuggestionsCard suggestions={suggestions} />
              )}
            </div>
          ) : (
            <ListingContentCard
              content={activeView}
              emptyMessage="No optimized content yet."
              accent="orange"
              embedded
            />
          )}
        </div>
      </div>
    </div>
  );
}
