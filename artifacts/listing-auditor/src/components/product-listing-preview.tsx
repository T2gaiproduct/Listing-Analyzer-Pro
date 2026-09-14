import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, Star, X } from "lucide-react";
import type { GeneratedContent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { readAplusFromAudit } from "@/components/aplus-content-wizard";
import {
  collectListingPreviewImages,
  resolveListingPreviewImageUrl,
} from "@/lib/collect-listing-preview-images";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchGraphicsProjectForAudit(auditId: number) {
  const res = await fetch(`${basePath}/api/graphics/projects?auditId=${auditId}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json() as {
    projects?: Array<{ auditId?: number | null; imageRecords?: Array<{ type?: string; currentUrl?: string }> }>;
  };
  return data.projects?.find((project) => project.auditId === auditId) ?? null;
}

type AuditLike = {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ type?: string; currentUrl?: string }> | null;
  generatedImages?: unknown;
  generatedContent?: GeneratedContent | null;
  title?: string | null;
  bulletPoints?: string[] | null;
  brandName?: string | null;
  category?: string | null;
  productName?: string | null;
};

export function ProductListingPreview({
  auditId,
  audit,
  generatedContent,
  productName,
  brandName,
  category,
  productImageUrl,
  fallbackImageUrls,
}: {
  auditId: number;
  audit: AuditLike | null | undefined;
  generatedContent: GeneratedContent | null | undefined;
  productName: string;
  brandName?: string | null;
  category?: string | null;
  productImageUrl?: string | null;
  fallbackImageUrls?: string[] | null;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: graphicsProject } = useQuery({
    queryKey: ["graphics-project-for-audit", auditId, refreshKey],
    queryFn: () => fetchGraphicsProjectForAudit(auditId),
    enabled: auditId > 0,
    staleTime: 10_000,
  });

  const title = useMemo(() => {
    const fromGenerated = generatedContent?.title?.trim()
      || audit?.generatedContent?.title?.trim();
    if (fromGenerated) return fromGenerated;
    return audit?.title?.trim() || productName?.trim() || "Product title";
  }, [generatedContent, audit, productName]);

  const bullets = useMemo(() => {
    const fromGenerated = generatedContent?.bulletPoints?.filter((b) => b.trim()) ?? [];
    if (fromGenerated.length) return fromGenerated;
    const fromAudit = audit?.generatedContent?.bulletPoints?.filter((b) => b.trim()) ?? [];
    if (fromAudit.length) return fromAudit;
    return (audit?.bulletPoints ?? []).filter((b) => b?.trim());
  }, [generatedContent, audit]);

  const htmlDescription = generatedContent?.htmlDescription?.trim()
    || audit?.generatedContent?.htmlDescription?.trim()
    || "";

  const displayBrand = brandName?.trim() || audit?.brandName?.trim() || "Your brand";
  const displayCategory = category?.trim() || audit?.category?.trim() || "General";

  const aplusModules = useMemo(
    () => readAplusFromAudit(audit?.generatedImages).modules.filter((m) => m.imageUrl?.trim()),
    [audit?.generatedImages],
  );

  const aplusExcludeUrls = useMemo(
    () => aplusModules.map((m) => m.imageUrl.trim()),
    [aplusModules],
  );

  const galleryImages = useMemo(
    () => collectListingPreviewImages({
      imageUrls: audit?.imageUrls,
      imageRecords: audit?.imageRecords,
      generatedImages: audit?.generatedImages,
      graphicsProjectRecords: graphicsProject?.imageRecords ?? null,
      productImageUrl,
      fallbackImageUrls,
      excludeUrls: aplusExcludeUrls,
    }),
    [
      audit?.imageUrls,
      audit?.imageRecords,
      audit?.generatedImages,
      graphicsProject?.imageRecords,
      productImageUrl,
      fallbackImageUrls,
      refreshKey,
      aplusExcludeUrls,
    ],
  );

  const openLightbox = (url: string) => {
    setLightboxUrl(resolveListingPreviewImageUrl(url));
  };

  useEffect(() => {
    if (selectedIndex >= galleryImages.length) {
      setSelectedIndex(0);
    }
  }, [galleryImages.length, selectedIndex]);

  const hasListingCopy = Boolean(title && (bullets.length > 0 || htmlDescription));
  const hasImages = galleryImages.length > 0;
  const selected = galleryImages[selectedIndex] ?? galleryImages[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-orange-500" />
          <h3 className="text-xs font-semibold text-slate-900">Listing preview</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px] rounded-lg gap-1"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh preview
        </Button>
      </div>

      {(!hasListingCopy || !hasImages) && (
        <p className="text-[11px] text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
          {!hasListingCopy && !hasImages
            ? "Generate listing content and graphics in the earlier steps to see a full preview."
            : !hasListingCopy
              ? "Add or generate listing copy on the Listing step to preview title and bullets."
              : "Add product images or generate graphics to preview the image gallery."}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_minmax(0,1.1fr)] gap-4 p-4 lg:p-5">
          {/* Thumbnails */}
          <div className="flex lg:flex-col gap-2 order-2 lg:order-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {hasImages ? (
              galleryImages.map((img, index) => (
                <button
                  key={`${img.url}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(index);
                    openLightbox(img.url);
                  }}
                  className={cn(
                    "shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden bg-slate-50 cursor-zoom-in",
                    selectedIndex === index ? "border-blue-500" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <img
                    src={resolveListingPreviewImageUrl(img.url)}
                    alt={img.label}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))
            ) : (
              <div className="w-14 h-14 rounded-md border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 text-center px-1">
                No images
              </div>
            )}
          </div>

          {/* Main image */}
          <div className="order-1 lg:order-2 aspect-square max-h-[min(420px,70vw)] w-full max-w-md mx-auto lg:mx-0 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
            {selected ? (
              <button
                type="button"
                className="w-full h-full flex items-center justify-center cursor-zoom-in"
                onClick={() => openLightbox(selected.url)}
                aria-label="View full size image"
              >
                <img
                  src={resolveListingPreviewImageUrl(selected.url)}
                  alt={selected.label}
                  className="w-full h-full object-contain"
                />
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Main image</span>
            )}
          </div>

          {/* Product details */}
          <div className="order-3 space-y-3 min-w-0">
            <h4 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">{title}</h4>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-0.5 text-amber-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <span className="text-slate-500">Preview only — not live Amazon data</span>
            </div>

            <p className="text-[11px] text-slate-600">
              <span className="font-medium text-slate-800">Brand:</span> {displayBrand}
              <span className="mx-1.5 text-slate-300">|</span>
              <span className="font-medium text-slate-800">Category:</span> {displayCategory}
            </p>

            {bullets.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-900 mb-1.5">About this item</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 leading-relaxed">
                  {bullets.map((bullet, i) => (
                    <li key={`${i}-${bullet.slice(0, 24)}`}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}

            {htmlDescription && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold text-slate-900 mb-1.5">Product description</p>
                <div
                  className="prose prose-sm max-w-none text-slate-700 text-[11px]"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlDescription(htmlDescription) }}
                />
              </div>
            )}
          </div>
        </div>

        {aplusModules.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 lg:px-5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              A+ content modules
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aplusModules.map((module) => (
                <div
                  key={module.id}
                  className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                >
                  {module.imageUrl && (
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in"
                      onClick={() => openLightbox(module.imageUrl)}
                      aria-label={`View full size ${module.title}`}
                    >
                      <img
                        src={resolveListingPreviewImageUrl(module.imageUrl)}
                        alt={module.title}
                        className="w-full h-auto object-cover max-h-48"
                      />
                    </button>
                  )}
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-800">{module.title}</p>
                    {module.headline?.trim() && (
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-2">{module.headline}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightboxUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={lightboxUrl}
              alt="Full size preview"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
              onClick={() => setLightboxUrl(null)}
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
