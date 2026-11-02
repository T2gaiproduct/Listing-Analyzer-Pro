import { useMemo, useState } from "react";
import { CheckCircle2, Code2, Copy, Eye, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import {
  formatHtmlDescriptionForPreview,
  normalizeBulletPoints,
} from "@/lib/listing-content-format";
import type { GeneratedContent } from "@workspace/api-client-react";

export type ListingContentView = {
  title: string;
  bulletPoints: string[];
  keywords: string[];
  htmlDescription: string;
  category?: string | null;
};

export function generatedContentToListingView(
  gc: GeneratedContent | null | undefined,
): ListingContentView | null {
  if (!gc?.title?.trim()) return null;
  return {
    title: gc.title,
    bulletPoints: gc.bulletPoints?.filter(Boolean) ?? [],
    keywords: gc.keywords?.filter(Boolean) ?? [],
    htmlDescription: gc.htmlDescription?.trim() ?? "",
    category: gc.category?.trim() ?? null,
  };
}

export function ListingContentCard({
  content,
  emptyMessage,
  accent = "slate",
  hideBulletPoints = false,
}: {
  content: ListingContentView | null | undefined;
  emptyMessage: string;
  accent?: "slate" | "orange";
  hideBulletPoints?: boolean;
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
  const hasContent = Boolean(content?.title?.trim())
    || contentBullets.length > 0
    || keywords.length > 0
    || htmlDescription
    || category;

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

  return (
    <div className={cn("rounded-lg border bg-white overflow-hidden shadow-sm", borderClass)}>
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
              <pre className="text-[10px] text-slate-100 leading-relaxed border border-slate-700 rounded-md p-3 bg-slate-900 overflow-x-auto whitespace-pre-wrap font-mono">
                {htmlDescription}
              </pre>
            )}
          </div>
        )}
      </div>
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
