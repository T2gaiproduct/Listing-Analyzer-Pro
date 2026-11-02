import { useState } from "react";
import { cn } from "@/lib/utils";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import { formatHtmlDescriptionForPreview } from "@/lib/listing-content-format";
import { cleanListingDisplayText } from "@/lib/listing-display-sanitize";
import type { SellerProductDetail } from "@/lib/reference-research";
import { SpecificationsFeaturesSection } from "@/components/specifications-features-section";

function stripHtmlToPlain(html: string): string {
  const safe = sanitizeHtmlDescription(formatHtmlDescriptionForPreview(html));
  return safe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const MAIN_IMAGE_FRAME =
  "relative aspect-square w-full max-w-md mx-auto lg:mx-0 lg:max-w-full max-h-[min(420px,70vw)] lg:max-h-[min(560px,48vh)] xl:max-h-[min(640px,52vh)] rounded-lg border border-slate-100 bg-white flex items-center justify-center overflow-hidden";

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
  const bullets = bulletPoints
    .map((b) => cleanListingDisplayText(b ?? ""))
    .filter(Boolean);
  const rows = attributes.filter((r) => r.attribute?.trim() && r.value?.trim());
  const safeIndex = images.length > 0 ? activeImage % images.length : 0;
  const mainImage = images[safeIndex];
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
          No existing listing to show yet. Import a product or sync store data. Optimized copy appears on Listing Preview
          after you generate on Optimize Listing.
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
        {/* Thumbnails — scroll only (no arrow controls) */}
        <div className="flex flex-col items-center order-2 lg:order-1 shrink-0 w-full lg:w-auto">
          <div
            className={cn(
              "flex lg:flex-col gap-2 w-full overflow-x-auto pb-1 lg:pb-0",
              "lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[min(380px,65vw)]",
              "[scrollbar-width:thin] [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)]",
            )}
            aria-label="Product image thumbnails"
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
        </div>

        {/* Main image — Amazon PDP square frame */}
        <div className={cn(MAIN_IMAGE_FRAME, "order-1 lg:order-2")}>
          {mainImage ? (
            <img src={mainImage} alt="" className="h-full w-full object-contain" />
          ) : (
            <p className="text-[11px] text-slate-400">No images</p>
          )}
        </div>

        {/* Listing copy + attributes */}
        <div className="min-w-0 space-y-3 order-3 lg:order-3">
          {title.trim() ? (
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{cleanListingDisplayText(title)}</h3>
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
