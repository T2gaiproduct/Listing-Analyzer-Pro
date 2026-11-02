import { useMemo, useState, type ReactNode } from "react";
import { Check, CheckCircle2, Code2, Copy, Eye, FileText, Sparkles, X } from "lucide-react";
import type {
  ListingContentFieldKey,
  ListingContentFieldSource,
  ListingContentFieldSources,
} from "@/lib/listing-content-field-merge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import {
  formatHtmlDescriptionForPreview,
  normalizeBulletPoints,
} from "@/lib/listing-content-format";
import type { GeneratedContent } from "@workspace/api-client-react";

export type ListingContentAttribute = {
  attribute: string;
  value: string;
};

export type ListingContentView = {
  title: string;
  bulletPoints: string[];
  keywords: string[];
  htmlDescription: string;
  category?: string | null;
  attributes?: ListingContentAttribute[];
};

export function generatedContentToListingView(
  gc: GeneratedContent | null | undefined,
): ListingContentView | null {
  if (!gc?.title?.trim()) return null;
  const attributes = (gc.attributes ?? [])
    .filter((row) => row.attribute?.trim() && row.value?.trim())
    .map((row) => ({ attribute: row.attribute.trim(), value: row.value.trim() }));
  return {
    title: gc.title,
    bulletPoints: gc.bulletPoints?.filter(Boolean) ?? [],
    keywords: gc.keywords?.filter(Boolean) ?? [],
    htmlDescription: gc.htmlDescription?.trim() ?? "",
    category: (gc as { category?: string | null }).category?.trim() ?? null,
    attributes: attributes.length > 0 ? attributes : undefined,
  };
}

export function ListingContentCard({
  content,
  emptyMessage,
  accent = "slate",
  hideBulletPoints = false,
  embedded = false,
}: {
  content: ListingContentView | null | undefined;
  emptyMessage: string;
  accent?: "slate" | "orange";
  hideBulletPoints?: boolean;
  /** Render inside a parent card (no outer border or shadow). */
  embedded?: boolean;
}) {
  const { toast } = useToast();
  const [descViewMode, setDescViewMode] = useState<"preview" | "code">("preview");
  const contentBullets = hideBulletPoints
    ? []
    : normalizeBulletPoints(content?.bulletPoints?.filter(Boolean) ?? []);
  const keywords = content?.keywords?.filter(Boolean) ?? [];
  const htmlDescription = content?.htmlDescription?.trim() ?? "";
  const descriptionPreviewHtml = useMemo(
    () => (htmlDescription
      ? sanitizeHtmlDescription(formatHtmlDescriptionForPreview(htmlDescription))
      : ""),
    [htmlDescription],
  );
  const category = content?.category?.trim() ?? "";
  const attributeRows = (content?.attributes ?? []).filter(
    (row) => row.attribute?.trim() && row.value?.trim(),
  );
  const hasContent = Boolean(content?.title?.trim())
    || contentBullets.length > 0
    || keywords.length > 0
    || htmlDescription
    || category
    || attributeRows.length > 0;

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  }

  if (!hasContent) {
    return (
      <p className="text-[11px] text-slate-500 px-1 py-6 text-center">
        {emptyMessage}
      </p>
    );
  }

  const borderClass = accent === "orange"
    ? "border-orange-200/80"
    : "border-slate-200";
  const headerClass = accent === "orange"
    ? "bg-orange-50 border-orange-100"
    : "bg-slate-50 border-slate-100";
  const headerTextClass = accent === "orange" ? "text-orange-900" : "text-slate-700";
  const bulletBadgeClass = accent === "orange"
    ? "bg-orange-100 text-orange-600"
    : "bg-slate-100 text-slate-600";
  const keywordClass = accent === "orange"
    ? "bg-orange-50 text-orange-700 border-orange-100"
    : "bg-slate-50 text-slate-700 border-slate-200";

  const header = (
    <div className={cn("border-b px-4 py-2.5 flex items-center gap-2", headerClass)}>
      {accent === "orange" ? (
        <Sparkles className="w-3.5 h-3.5 text-orange-500" />
      ) : (
        <FileText className="w-3.5 h-3.5 text-slate-500" />
      )}
      <p className={cn("text-[10px] font-semibold", headerTextClass)}>
        {accent === "orange" ? "Generated Content" : "Current Listing"}
      </p>
    </div>
  );

  const body = (
      <div className="px-4 py-4 space-y-4">
        {content?.title?.trim() && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Product Title</p>
              <button
                type="button"
                onClick={() => copyText(content.title, "Title")}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-900 leading-snug whitespace-pre-wrap break-words">
              {content.title}
            </p>
          </div>
        )}

        {category && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Category</p>
              <button
                type="button"
                onClick={() => copyText(category, "Category")}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">{category}</p>
          </div>
        )}

        {contentBullets.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bullet Points</p>
              <button
                type="button"
                onClick={() => copyText(contentBullets.join("\n"), "Bullet points")}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <ul className="space-y-2">
              {contentBullets.map((bullet, index) => (
                <li key={`${index}-${bullet.slice(0, 24)}`} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5",
                      bulletBadgeClass,
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {keywords.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tags</p>
              <button
                type="button"
                onClick={() => copyText(keywords.join(", "), "Tags")}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                    keywordClass,
                  )}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {htmlDescription && (
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Description</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(htmlDescription, "HTML description")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
                <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => setDescViewMode("preview")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                      descViewMode === "preview"
                        ? "bg-white text-slate-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-500",
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescViewMode("code")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                      descViewMode === "code"
                        ? "bg-white text-slate-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-500",
                    )}
                  >
                    <Code2 className="w-3 h-3" />
                    Code
                  </button>
                </div>
              </div>
            </div>
            {descViewMode === "preview" ? (
              <div
                className="amazon-listing-description prose prose-sm max-w-none text-slate-800 border border-slate-200 rounded-md p-3 bg-slate-50/50"
                dangerouslySetInnerHTML={{ __html: descriptionPreviewHtml }}
              />
            ) : (
              <pre className="text-[10px] text-slate-100 leading-relaxed border border-slate-700 rounded-md p-3 bg-slate-900 whitespace-pre-wrap break-words font-mono">
                {htmlDescription}
              </pre>
            )}
          </div>
        )}

        {attributeRows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Attributes</p>
              <button
                type="button"
                onClick={() => copyText(
                  attributeRows.map((row) => `${row.attribute}: ${row.value}`).join("\n"),
                  "Attributes",
                )}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <div className="rounded-md border border-slate-200">
              <table className="w-full text-[11px] table-fixed">
                <tbody>
                  {attributeRows.map((row, index) => (
                    <tr key={`${row.attribute}-${index}`} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-800 align-top w-[38%] break-words">{row.attribute}</td>
                      <td className="px-3 py-2 text-slate-600 align-top break-words">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <div className={cn("rounded-lg border bg-white overflow-hidden", borderClass)}>
      {header}
      {body}
    </div>
  );
}

/** Adjust imported store copy per content marketplace tab (same product, channel-specific emphasis). */
export function resolveExistingContentForMarketplaceSlug(
  base: ListingContentView | null | undefined,
  slug: string | undefined,
  storeDescriptionHtml?: string | null,
): ListingContentView | null {
  if (!base?.title?.trim()
    && !(base?.bulletPoints?.length)
    && !(base?.htmlDescription?.trim())
    && !storeDescriptionHtml?.trim()) {
    return null;
  }
  const normalizedSlug = slug?.trim().toLowerCase();
  if (normalizedSlug === "shopify" || normalizedSlug === "woocommerce") {
    const title = base?.title?.trim() ?? "";
    const bulletPoints = normalizedSlug === "woocommerce"
      ? []
      : normalizeBulletPoints(base?.bulletPoints ?? []);
    return {
      title,
      bulletPoints,
      keywords: base?.keywords?.filter(Boolean) ?? [],
      htmlDescription: storeDescriptionHtml?.trim() || base?.htmlDescription?.trim() || "",
      category: base?.category ?? null,
      attributes: base?.attributes,
    };
  }
  return base ?? null;
}

function CollapsibleTextBlock({
  text,
  className,
  collapsedLines = 6,
}: {
  text: string;
  className?: string;
  collapsedLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const needsToggle = lines.length > collapsedLines;
  const visible = expanded || !needsToggle ? text : lines.slice(0, collapsedLines).join("\n");

  return (
    <div className={className}>
      <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">{visible}</p>
      {needsToggle && (
        <button
          type="button"
          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 mt-1"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function CompareFieldShell({
  label,
  showAiBadge,
  fieldSource,
  onPickSource,
  pickDisabled,
  children,
}: {
  label: string;
  showAiBadge?: boolean;
  fieldSource?: ListingContentFieldSource;
  onPickSource?: (source: ListingContentFieldSource) => void;
  pickDisabled?: boolean;
  children: ReactNode;
}) {
  const showPickers = Boolean(showAiBadge && onPickSource);
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
          {showAiBadge && (
            <span className="text-[9px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              AI suggestions
            </span>
          )}
        </div>
        {showPickers && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="Keep current listing"
              disabled={pickDisabled}
              onClick={() => onPickSource?.("current")}
              className={cn(
                "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
                fieldSource === "current"
                  ? "border-slate-400 bg-white text-slate-800 shadow-sm"
                  : "border-slate-200 bg-white text-slate-400 hover:text-slate-600",
                pickDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Use AI suggestion"
              disabled={pickDisabled}
              onClick={() => onPickSource?.("ai")}
              className={cn(
                "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
                fieldSource === "ai"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-400 hover:text-emerald-600",
                pickDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="px-3 py-3 space-y-3">{children}</div>
    </div>
  );
}

function compareBlockClass(selected: boolean): string {
  return cn(
    "rounded-md px-2 py-2 -mx-0.5 transition-colors",
    selected && "ring-1 ring-emerald-200 bg-emerald-50/40",
  );
}

export function ListingMarketplaceContentCompare({
  existing,
  optimized,
  marketplaceName,
  fieldSources,
  onFieldSourceChange,
  fieldPickDisabled,
}: {
  existing: ListingContentView | null;
  optimized: ListingContentView | null;
  marketplaceName?: string;
  fieldSources?: ListingContentFieldSources;
  onFieldSourceChange?: (field: ListingContentFieldKey, source: ListingContentFieldSource) => void;
  fieldPickDisabled?: boolean;
}) {
  const sourceFor = (field: ListingContentFieldKey): ListingContentFieldSource =>
    fieldSources?.[field] ?? "ai";
  const pick = (field: ListingContentFieldKey) => (source: ListingContentFieldSource) => {
    onFieldSourceChange?.(field, source);
  };
  const existingBullets = normalizeBulletPoints(existing?.bulletPoints ?? []);
  const optimizedBullets = normalizeBulletPoints(optimized?.bulletPoints ?? []);
  const existingKeywords = existing?.keywords?.filter(Boolean) ?? [];
  const optimizedKeywords = optimized?.keywords?.filter(Boolean) ?? [];
  const existingDesc = existing?.htmlDescription?.trim() ?? "";
  const optimizedDesc = optimized?.htmlDescription?.trim() ?? "";
  const optimizedPreview = useMemo(
    () => (optimizedDesc
      ? sanitizeHtmlDescription(formatHtmlDescriptionForPreview(optimizedDesc))
      : ""),
    [optimizedDesc],
  );
  const existingPreview = useMemo(
    () => (existingDesc
      ? sanitizeHtmlDescription(formatHtmlDescriptionForPreview(existingDesc))
      : ""),
    [existingDesc],
  );

  const hasExisting = Boolean(existing?.title?.trim())
    || existingBullets.length > 0
    || existingKeywords.length > 0
    || existingDesc
    || (existing?.attributes?.length ?? 0) > 0;
  const hasOptimized = Boolean(optimized?.title?.trim())
    || optimizedBullets.length > 0
    || optimizedKeywords.length > 0
    || optimizedDesc
    || (optimized?.attributes?.length ?? 0) > 0;

  if (!hasExisting && !hasOptimized) {
    return (
      <p className="text-[11px] text-slate-500 px-4 py-6 text-center">
        No listing content to compare yet.
      </p>
    );
  }

  const contextLabel = marketplaceName ? ` on ${marketplaceName}` : "";

  return (
    <div className="px-4 py-4 space-y-4 min-w-0">
      {hasExisting && (
        <p className="text-[10px] text-slate-500">
          Compare your current listing{contextLabel} with AI-optimized copy for this marketplace.
        </p>
      )}

      {(existing?.title?.trim() || optimized?.title?.trim()) && (() => {
        const titleDiff = Boolean(optimized?.title?.trim() && optimized.title.trim() !== (existing?.title?.trim() ?? ""));
        const titleSource = sourceFor("title");
        return (
        <CompareFieldShell
          label="Product title"
          showAiBadge={titleDiff}
          fieldSource={titleSource}
          onPickSource={titleDiff ? pick("title") : undefined}
          pickDisabled={fieldPickDisabled}
        >
          {hasExisting && existing?.title?.trim() && (
            <div className={compareBlockClass(titleSource === "current")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Current</p>
              <p className="text-[11px] text-slate-500 leading-snug">{existing.title}</p>
            </div>
          )}
          {optimized?.title?.trim() && (
            <div className={compareBlockClass(titleSource === "ai")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600 mb-1">AI suggests</p>
              <p className="text-[11px] font-medium text-slate-900 leading-snug">{optimized.title}</p>
            </div>
          )}
        </CompareFieldShell>
        );
      })()}

      {(existingBullets.length > 0 || optimizedBullets.length > 0) && (() => {
        const bulletsDiff = optimizedBullets.length > 0
          && JSON.stringify(existingBullets) !== JSON.stringify(optimizedBullets);
        const bulletSource = sourceFor("bulletPoints");
        return (
        <CompareFieldShell
          label="Bullet points"
          showAiBadge={bulletsDiff}
          fieldSource={bulletSource}
          onPickSource={bulletsDiff ? pick("bulletPoints") : undefined}
          pickDisabled={fieldPickDisabled}
        >
          {existingBullets.length > 0 && (
            <div className={compareBlockClass(bulletSource === "current")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Current</p>
              <CollapsibleTextBlock
                className="text-slate-500"
                text={existingBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}
              />
            </div>
          )}
          {optimizedBullets.length > 0 && (
            <div className={compareBlockClass(bulletSource === "ai")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600 mb-1.5">AI suggests</p>
              <ul className="space-y-2">
                {optimizedBullets.map((bullet, index) => (
                  <li key={`${index}-${bullet.slice(0, 20)}`} className="flex gap-2 text-[11px] text-slate-800 leading-relaxed">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <span className="whitespace-pre-wrap break-words">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CompareFieldShell>
        );
      })()}

      {(existingKeywords.length > 0 || optimizedKeywords.length > 0) && (() => {
        const kwDiff = optimizedKeywords.length > 0
          && JSON.stringify(existingKeywords) !== JSON.stringify(optimizedKeywords);
        const kwSource = sourceFor("keywords");
        return (
        <CompareFieldShell
          label="Tags / keywords"
          showAiBadge={kwDiff}
          fieldSource={kwSource}
          onPickSource={kwDiff ? pick("keywords") : undefined}
          pickDisabled={fieldPickDisabled}
        >
          {existingKeywords.length > 0 && (
            <div className={compareBlockClass(kwSource === "current")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Current</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{existingKeywords.join(", ")}</p>
            </div>
          )}
          {optimizedKeywords.length > 0 && (
            <div className={compareBlockClass(kwSource === "ai")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600 mb-1.5">AI suggests</p>
              <p className="text-[11px] text-slate-800 leading-relaxed">{optimizedKeywords.join(", ")}</p>
            </div>
          )}
        </CompareFieldShell>
        );
      })()}

      {(existingDesc || optimizedDesc) && (() => {
        const descDiff = Boolean(optimizedDesc && optimizedDesc !== existingDesc);
        const descSource = sourceFor("htmlDescription");
        return (
        <CompareFieldShell
          label="Description"
          showAiBadge={descDiff}
          fieldSource={descSource}
          onPickSource={descDiff ? pick("htmlDescription") : undefined}
          pickDisabled={fieldPickDisabled}
        >
          {existingDesc && (
            <div className={compareBlockClass(descSource === "current")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Current</p>
              <div
                className="text-[11px] text-slate-500 prose prose-sm max-w-none amazon-listing-description border border-slate-100 rounded-md p-2 bg-slate-50/50"
                dangerouslySetInnerHTML={{ __html: existingPreview }}
              />
            </div>
          )}
          {optimizedDesc && (
            <div className={compareBlockClass(descSource === "ai")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600 mb-1.5">AI suggests</p>
              <div
                className="text-[11px] text-slate-800 prose prose-sm max-w-none amazon-listing-description border border-orange-100 rounded-md p-2 bg-orange-50/30"
                dangerouslySetInnerHTML={{ __html: optimizedPreview }}
              />
            </div>
          )}
        </CompareFieldShell>
        );
      })()}

      {((existing?.attributes?.length ?? 0) > 0 || (optimized?.attributes?.length ?? 0) > 0) && (() => {
        const attrDiff = (optimized?.attributes?.length ?? 0) > 0
          && JSON.stringify(existing?.attributes ?? []) !== JSON.stringify(optimized?.attributes ?? []);
        const attrSource = sourceFor("attributes");
        return (
        <CompareFieldShell
          label="Attributes"
          showAiBadge={attrDiff}
          fieldSource={attrSource}
          onPickSource={attrDiff ? pick("attributes") : undefined}
          pickDisabled={fieldPickDisabled}
        >
          {(existing?.attributes?.length ?? 0) > 0 && (
            <div className={compareBlockClass(attrSource === "current")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Current</p>
              <p className="text-[11px] text-slate-500">
                {(existing?.attributes ?? []).map((row) => `${row.attribute}: ${row.value}`).join(" · ")}
              </p>
            </div>
          )}
          {(optimized?.attributes?.length ?? 0) > 0 && (
            <div className={compareBlockClass(attrSource === "ai")}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600 mb-1.5">AI suggests</p>
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-[11px]">
                  <tbody>
                    {(optimized?.attributes ?? []).map((row, index) => (
                      <tr key={`${row.attribute}-${index}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-1.5 font-medium text-slate-800 w-[38%]">{row.attribute}</td>
                        <td className="px-2 py-1.5 text-slate-600">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CompareFieldShell>
        );
      })()}

      {!hasOptimized && hasExisting && (
        <p className="text-[10px] text-slate-500 text-center pt-1">
          Click Generate to create optimized copy for this marketplace tab.
        </p>
      )}
    </div>
  );
}

export function ListingSuggestionsCard({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded-lg border border-orange-200/80 bg-orange-50/40 p-4 space-y-2.5">
      <p className="text-[11px] font-semibold text-orange-900 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-orange-500" />
        Improvement suggestions
      </p>
      <ul className="space-y-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="text-[11px] text-slate-700 leading-relaxed flex gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-orange-500/80 shrink-0 mt-0.5" />
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
