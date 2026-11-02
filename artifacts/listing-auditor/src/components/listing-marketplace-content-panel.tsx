import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import type { GeneratedContent } from "@workspace/api-client-react";

type ListingContentView = {
  title: string;
  bulletPoints: string[];
  keywords: string[];
  htmlDescription: string;
};

export type ContentVariantRow = {
  contentMarketplaceId: number;
  generatedContent: GeneratedContent;
};

function ListingContentCard({
  content,
  emptyMessage,
}: {
  content: ListingContentView | null;
  emptyMessage: string;
}) {
  if (!content?.title?.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
        <p className="text-[11px] text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const plainDesc = content.htmlDescription?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 text-[11px]">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Title</p>
        <p className="font-medium text-slate-900 leading-snug">{content.title}</p>
      </div>
      {content.bulletPoints.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Bullet points</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {content.bulletPoints.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {content.keywords.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Keywords</p>
          <p className="text-slate-600">{content.keywords.join(", ")}</p>
        </div>
      )}
      {plainDesc ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Description</p>
          <p className="text-slate-600 leading-relaxed">{plainDesc}</p>
        </div>
      ) : null}
    </div>
  );
}

function ListingSuggestionsCard({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        Improvement suggestions
      </p>
      <ul className="space-y-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="text-[11px] text-slate-700 leading-relaxed flex gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toListingView(gc: GeneratedContent | null | undefined): ListingContentView | null {
  if (!gc?.title?.trim()) return null;
  return {
    title: gc.title,
    bulletPoints: gc.bulletPoints?.filter(Boolean) ?? [],
    keywords: gc.keywords?.filter(Boolean) ?? [],
    htmlDescription: gc.htmlDescription?.trim() ?? "",
  };
}

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

  const activeMarketplace = contentMarketplaces.find((m) => m.id === contentMarketplaceId);
  const activeContent = contentMarketplaceId != null ? variantMap.get(contentMarketplaceId) : undefined;
  const activeView = toListingView(activeContent);
  const hasActiveContent = Boolean(activeView?.title?.trim());

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
  const generateCount = batchIds.length > 0 ? batchIds.length : 1;
  const generateTargets =
    batchIds.length > 0
      ? batchIds
      : contentMarketplaceId != null
        ? [contentMarketplaceId]
        : contentMarketplaces[0]
          ? [contentMarketplaces[0].id]
          : [];

  return (
    <div className="space-y-4">
      {marketplacesLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading marketplaces…
        </div>
      ) : contentMarketplaces.length === 0 ? (
        <p className="text-[11px] text-slate-500">No content marketplaces configured. Add them in Admin.</p>
      ) : (
        <>
          <div className="border-b border-slate-200 overflow-x-auto [scrollbar-width:thin]">
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
                      "relative px-4 py-2.5 text-left border-b-2 transition-colors shrink-0",
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

          {activeMarketplace?.description ? (
            <p className="text-[11px] text-slate-500">{activeMarketplace.description}</p>
          ) : null}
          {activeMarketplace ? (
            <p className="text-[11px] text-slate-500">
              Content follows <span className="font-medium text-slate-700">{activeMarketplace.name}</span> rules
              configured in Admin.
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 shrink-0">
              Generate for
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 flex-1">
              {contentMarketplaces.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={batchSelected.has(m.id)}
                    onCheckedChange={() => toggleBatch(m.id)}
                    disabled={isOptimizing || optimizeDisabled}
                  />
                  {m.name}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={selectAllBatch}
                disabled={isOptimizing || optimizeDisabled}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => onGenerate(generateTargets)}
                disabled={optimizeDisabled || isOptimizing || generateTargets.length === 0}
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1 opacity-70" />
                    {hasActiveContent ? "Regenerate" : "Generate"}
                    {generateCount > 1 ? ` (${generateCount})` : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5 text-slate-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Optimized content
            {activeMarketplace ? ` — ${activeMarketplace.name}` : ""}
          </p>
        </div>

        {isOptimizing && !hasActiveContent ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mb-2" />
            <p className="text-[11px] text-slate-600">Generating optimized listing copy…</p>
          </div>
        ) : !hasActiveContent ? (
          <>
            <ListingSuggestionsCard suggestions={suggestions} />
            {!suggestions.length && (
              <ListingContentCard
                content={null}
                emptyMessage="No optimized content for this marketplace yet. Select marketplaces above and click Generate."
              />
            )}
          </>
        ) : (
          <ListingContentCard
            content={activeView}
            emptyMessage="No optimized content yet."
          />
        )}
      </div>
    </div>
  );
}
