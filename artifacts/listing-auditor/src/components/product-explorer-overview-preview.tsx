import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import { formatHtmlDescriptionForPreview } from "@/lib/listing-content-format";
import type { SellerProductDetail } from "@/lib/reference-research";

type PreviewTab = "content" | "attributes";

function stripHtmlToPlain(html: string): string {
  const safe = sanitizeHtmlDescription(formatHtmlDescriptionForPreview(html));
  return safe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function ProductExplorerOverviewPreview({
  imageUrls,
  title,
  bulletPoints,
  descriptionHtml,
  attributes,
  className,
}: {
  imageUrls: string[];
  title: string;
  bulletPoints: string[];
  descriptionHtml?: string | null;
  attributes: SellerProductDetail[];
  className?: string;
}) {
  const [tab, setTab] = useState<PreviewTab>("content");
  const images = imageUrls.filter((u) => u?.trim());
  const [activeImage, setActiveImage] = useState(0);
  const bullets = bulletPoints.filter((b) => b?.trim());
  const rows = attributes.filter((r) => r.attribute?.trim() && r.value?.trim());
  const mainImage = images[activeImage] ?? images[0];
  const plainDesc = descriptionHtml?.trim() ? stripHtmlToPlain(descriptionHtml) : "";
  const hasContent = Boolean(title.trim() || bullets.length || plainDesc);
  const hasAttributes = rows.length > 0;

  if (!hasContent && !hasAttributes && images.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center",
          className,
        )}
      >
        <p className="text-[11px] text-slate-500">
          No listing preview yet. Add images and details in Build Your Brand Upload, import from a link, or generate
          listing content on the Listing tab.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/30 p-3 sm:p-4 space-y-3", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Existing content</p>

      <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
        <div className="flex gap-2 lg:flex-col lg:w-28 shrink-0">
          {(["content", "attributes"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-[11px] font-medium transition-colors",
                tab === id
                  ? "bg-orange-100 text-orange-800"
                  : "text-slate-500 hover:bg-white hover:text-slate-800",
              )}
            >
              {id === "content" ? "Content" : "Attributes"}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {tab === "content" ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,200px)_1fr] lg:grid-cols-[minmax(0,240px)_1fr]">
              <div className="space-y-2">
                <div className="relative aspect-square w-full max-h-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {mainImage ? (
                    <img src={mainImage} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-[11px] text-slate-400">
                      No images
                    </div>
                  )}
                  {images.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full opacity-90 shadow-none"
                        onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full opacity-90 shadow-none"
                        onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {images.slice(0, 8).map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        className={cn(
                          "h-10 w-10 shrink-0 overflow-hidden rounded border",
                          idx === activeImage ? "border-orange-500 ring-1 ring-orange-300" : "border-slate-200",
                        )}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-2">
                {title.trim() ? (
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">{title}</h3>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No title yet</p>
                )}
                {bullets.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700 leading-relaxed">
                    {bullets.slice(0, 8).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                {plainDesc ? (
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-6">{plainDesc}</p>
                ) : null}
                {!hasContent && images.length > 0 && (
                  <p className="text-[11px] text-slate-400">Images only — generate or import listing copy to preview text.</p>
                )}
              </div>
            </div>
          ) : rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-600">Attribute</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-800 align-top">{row.attribute}</td>
                      <td className="px-3 py-2 text-slate-600 align-top">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 py-4">
              No attributes yet. Add them on Build Your Brand Upload or import from a marketplace link.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
