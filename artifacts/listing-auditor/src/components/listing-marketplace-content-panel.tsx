import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import type { GeneratedContent } from "@workspace/api-client-react";
import {
  generatedContentToListingView,
  ListingContentCard,
  ListingSuggestionsCard,
} from "@/components/listing-content-card";

export type ContentVariantRow = {
  contentMarketplaceId: number;
  generatedContent: GeneratedContent;
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
}) {
  const variantMap = useMemo(() => {
    const map = new Map<number, GeneratedContent>();
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

  const [generateMenuOpen, setGenerateMenuOpen] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!contentMarketplaces.length) return;
    if (contentMarketplaceId != null && contentMarketplaces.some((m) => m.id === contentMarketplaceId)) {
      return;
    }
    onContentMarketplaceChange(contentMarketplaces[0].id);
  }, [contentMarketplaces, contentMarketplaceId, onContentMarketplaceChange]);

  useEffect(() => {
    if (contentMarketplaceId == null) return;
    setBatchSelected((prev) => {
      if (prev.size > 0) return prev;
      return new Set([contentMarketplaceId]);
    });
  }, [contentMarketplaceId]);

  const activeContent = contentMarketplaceId != null ? variantMap.get(contentMarketplaceId) : undefined;
  const activeView = generatedContentToListingView(activeContent);
  const hasActiveContent = Boolean(activeView?.title?.trim())
    || (activeView?.attributes?.length ?? 0) > 0;

  function toggleBatch(id: number) {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllBatch() {
    setBatchSelected(new Set(contentMarketplaces.map((m) => m.id)));
  }

  const batchIds = [...batchSelected];
  const hasGenerateSelection = batchIds.length > 0;

  const generateControlsDisabled =
    optimizeDisabled
    || isOptimizing
    || (contentMarketplaceId == null && contentMarketplaces.length === 0);

  const primaryGenerateDisabled = generateControlsDisabled || !hasGenerateSelection;

  const generateBatch = () => {
    if (batchIds.length === 0) return;
    onGenerate(batchIds);
    setGenerateMenuOpen(false);
  };

  const runPrimaryGenerate = () => {
    if (!hasGenerateSelection) return;
    onGenerate(batchIds);
  };

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
              className="h-8 text-[11px] rounded-r-none border-r-0 pr-3 disabled:pointer-events-none"
              onClick={runPrimaryGenerate}
              disabled={primaryGenerateDisabled}
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1 opacity-70" />
                  Generate
                </>
              )}
            </Button>
            <Popover open={generateMenuOpen} onOpenChange={setGenerateMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 rounded-l-none"
                  disabled={generateControlsDisabled}
                  aria-label="Choose marketplaces to generate"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Generate for
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-2">
                  {contentMarketplaces.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer"
                    >
                      <Checkbox
                        checked={batchSelected.has(m.id)}
                        onCheckedChange={() => toggleBatch(m.id)}
                        disabled={isOptimizing || optimizeDisabled}
                      />
                      <span className="flex-1">{m.name}</span>
                      {variantMap.has(m.id) ? (
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden />
                      ) : null}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/80">
                  <button
                    type="button"
                    className="text-[10px] font-medium text-slate-600 hover:text-slate-900"
                    onClick={selectAllBatch}
                    disabled={isOptimizing || optimizeDisabled}
                  >
                    Select all
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={generateBatch}
                    disabled={primaryGenerateDisabled}
                  >
                    Generate
                    {batchIds.length > 1 ? ` (${batchIds.length})` : ""}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-orange-200/80 bg-white overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-orange-100 bg-orange-50/80">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
            Optimized content
          </p>
        </div>

        <div className="min-w-0">
          {isOptimizing && !hasActiveContent ? (
            <div className="px-4 py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-[11px] text-slate-600">Generating optimized listing copy and attributes…</p>
            </div>
          ) : !hasActiveContent ? (
            <div className="px-4 py-4 space-y-3">
              <ListingSuggestionsCard suggestions={suggestions} />
              {!suggestions.length && (
                <ListingContentCard
                  content={null}
                  emptyMessage="No optimized content for this marketplace yet. Choose a marketplace above and click Generate."
                  accent="orange"
                  embedded
                />
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
