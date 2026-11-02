import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import { formatHtmlDescriptionForPreview } from "@/lib/listing-content-format";
import type { SellerProductDetail } from "@/lib/reference-research";

function stripHtmlToPlain(html: string): string {
  const safe = sanitizeHtmlDescription(formatHtmlDescriptionForPreview(html));
  return safe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const MAIN_IMAGE_FRAME =
  "relative aspect-square w-full max-w-md mx-auto lg:mx-0 lg:max-w-full max-h-[min(420px,70vw)] lg:max-h-[min(560px,48vh)] xl:max-h-[min(640px,52vh)] rounded-lg border border-slate-100 bg-white flex items-center justify-center overflow-hidden group/main-image";

const SWEEPER_BTN_CLASS =
  "absolute top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center text-slate-900 opacity-100 sm:opacity-0 sm:group-hover/main-image:opacity-100 hover:bg-white transition-opacity";

function SpecificationsFeaturesSection({
  rows,
}: {
  rows: SellerProductDetail[];
}) {
  if (rows.length === 0) return null;
  const splitAt = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, splitAt), rows.slice(splitAt)];

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 space-y-4">
      <h4 className="text-center text-sm sm:text-base font-bold text-slate-900 tracking-tight">
        Specifications &amp; Features
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {columns.map((columnRows, colIndex) => (
          columnRows.length > 0 ? (
            <div
              key={colIndex}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
            >
              {columnRows.map((row, rowIndex) => (
                <div
                  key={`${colIndex}-${row.attribute}-${rowIndex}`}
                  className={cn(
                    "flex items-start justify-between gap-6 px-4 py-2.5 sm:py-3",
                    rowIndex < columnRows.length - 1 && "border-b border-slate-100",
                  )}
                >
                  <span className="text-[11px] sm:text-xs font-bold text-slate-900 shrink-0 max-w-[45%] leading-snug">
                    {row.attribute}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-700 text-right leading-snug break-words min-w-0 flex-1">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
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
  const images = imageUrls.filter((u) => u?.trim());
  const [activeImage, setActiveImage] = useState(0);
  const bullets = bulletPoints.filter((b) => b?.trim());
  const rows = attributes.filter((r) => r.attribute?.trim() && r.value?.trim());
  const safeIndex = images.length > 0 ? activeImage % images.length : 0;
  const mainImage = images[safeIndex];
  const plainDesc = descriptionHtml?.trim() ? stripHtmlToPlain(descriptionHtml) : "";
  const hasContent = Boolean(title.trim() || bullets.length || plainDesc);
  const hasAttributes = rows.length > 0;
  const canStepGallery = images.length > 1;

  const goPrev = () => setActiveImage((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setActiveImage((i) => (i + 1) % images.length);

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
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/30 p-3 sm:p-4", className)}>
      <div
        className={cn(
          "grid grid-cols-1 gap-4 items-start",
          "lg:grid-cols-[auto_minmax(0,min(36rem,42vw))_minmax(0,1fr)]",
          "xl:grid-cols-[auto_minmax(0,min(40rem,38vw))_minmax(0,1fr)]",
          "lg:gap-5 xl:gap-6",
        )}
      >
        {/* Amazon-style vertical thumbnails (horizontal on small screens) */}
        <div className="flex flex-col items-center gap-1 order-2 lg:order-1 shrink-0">
          {canStepGallery && (
            <button
              type="button"
              className="hidden lg:flex w-14 h-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={goPrev}
              aria-label="Previous image"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          <div
            className={cn(
              "flex lg:flex-col gap-2 w-full overflow-x-auto pb-1 lg:pb-0",
              "lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[min(380px,65vw)]",
              "[scrollbar-width:thin]",
            )}
          >
            {images.length > 0 ? (
              images.slice(0, 9).map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={cn(
                    "relative shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden bg-slate-50",
                    safeIndex === idx
                      ? "border-slate-900"
                      : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[9px] text-slate-400">
                No img
              </div>
            )}
          </div>
          {canStepGallery && (
            <button
              type="button"
              className="hidden lg:flex w-14 h-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={goNext}
              aria-label="Next image"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Main image — Amazon PDP square frame */}
        <div className={cn(MAIN_IMAGE_FRAME, "order-1 lg:order-2")}>
          {mainImage ? (
            <>
              <img src={mainImage} alt="" className="h-full w-full object-contain" />
              {canStepGallery && (
                <>
                  <button
                    type="button"
                    className={cn(SWEEPER_BTN_CLASS, "left-1.5")}
                    onClick={(e) => {
                      e.stopPropagation();
                      goPrev();
                    }}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(SWEEPER_BTN_CLASS, "right-1.5")}
                    onClick={(e) => {
                      e.stopPropagation();
                      goNext();
                    }}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-[11px] text-slate-400">No images</p>
          )}
        </div>

        {/* Listing copy + attributes */}
        <div className="min-w-0 space-y-3 order-3 lg:order-3">
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
            <p className="text-[11px] text-slate-600 leading-relaxed">{plainDesc}</p>
          ) : null}
          {!hasContent && images.length > 0 && (
            <p className="text-[11px] text-slate-400">Images only — generate or import listing copy to preview text.</p>
          )}
        </div>
      </div>

      {hasAttributes ? <SpecificationsFeaturesSection rows={rows} /> : null}
    </div>
  );
}
