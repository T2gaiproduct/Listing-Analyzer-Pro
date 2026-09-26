import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Link2,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import { copyTextToClipboard } from "@/lib/project-share";
import type { GeneratedContent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ListingExportButton } from "@/components/listing-export-button";
import { readAplusFromAudit } from "@/components/aplus-content-wizard";
import { ProtectedAppImage } from "@/components/protected-app-image";
import {
  collectListingPreviewImages,
  resolveListingPreviewImageUrl,
} from "@/lib/collect-listing-preview-images";
import {
  fetchProtectedAppImageBlobUrl,
  isProtectedAuditImageUrl,
} from "@/lib/protected-app-image";
import { sanitizeHtmlDescription } from "@/lib/sanitize-html";
import {
  formatHtmlDescriptionForPreview,
  normalizeBulletPoints,
} from "@/lib/listing-content-format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ReferenceIntelligenceListingPreview } from "@/components/reference-intelligence-table";
import {
  mergeListingPreviewProductDetails,
  type ReferenceIntelligenceRow,
  type SellerProductDetail,
} from "@/lib/reference-research";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Amazon A+ module stack order (top → bottom). */
const APLUS_MODULE_ORDER: Record<string, number> = {
  hero: 0,
  features: 1,
  comparison: 2,
  brand_story: 3,
};

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
  edgeToEdge = false,
  showExportButton = false,
  exportDisabled = false,
  /** Skip authenticated graphics fetch (public share page). */
  publicView = false,
  /** Show "Copy preview link" for signed-in users (generates public no-auth URL). */
  sharePreviewLink = false,
  /** Preview tab: only generated copy and graphics (no scraped listing / import fallbacks). */
  generatedOnly = false,
  /** AI reference intelligence rows (Reference Listings analyze). */
  referenceIntelligence = null,
  /** Seller-confirmed specs — shown on preview instead of AI research when present. */
  productDetails = null,
}: {
  auditId: number;
  audit: AuditLike | null | undefined;
  generatedContent: GeneratedContent | null | undefined;
  productName: string;
  brandName?: string | null;
  category?: string | null;
  productImageUrl?: string | null;
  fallbackImageUrls?: string[] | null;
  /** Extend preview card to parent edges (Product Explorer listing preview step). */
  edgeToEdge?: boolean;
  /** Amazon listing Excel export (Product Explorer listing preview). */
  showExportButton?: boolean;
  exportDisabled?: boolean;
  publicView?: boolean;
  sharePreviewLink?: boolean;
  generatedOnly?: boolean;
  referenceIntelligence?: ReferenceIntelligenceRow[] | null;
  productDetails?: SellerProductDetail[] | null;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lightboxGalleryIndex, setLightboxGalleryIndex] = useState<number | null>(null);
  const [lightboxStandaloneRawUrl, setLightboxStandaloneRawUrl] = useState<string | null>(null);
  const [lightboxDisplayUrl, setLightboxDisplayUrl] = useState<string | null>(null);
  const lightboxBlobRef = useRef<string | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const { toast } = useToast();

  const { data: graphicsProject } = useQuery({
    queryKey: ["graphics-project-for-audit", auditId, refreshKey],
    queryFn: () => fetchGraphicsProjectForAudit(auditId),
    enabled: !publicView && auditId > 0,
    staleTime: 10_000,
  });

  async function handleCopyPreviewLink() {
    try {
      const res = await fetch(`${basePath}/api/audits/${auditId}/listing-preview-share`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not create preview link");
      const { url: serverUrl } = await res.json() as { url: string };
      const token = new URL(serverUrl, window.location.href).searchParams.get("token");
      if (!token) throw new Error("Invalid share response");
      let origin = window.location.origin.replace(/\/$/, "");
      if (origin.endsWith(":8080")) {
        origin = origin.replace(/:8080$/, ":3000");
      }
      const url = `${origin}/listing-preview/${auditId}?token=${encodeURIComponent(token)}`;
      await copyTextToClipboard(url);
      toast({
        title: "Preview link copied",
        description: "Anyone with this link can view the listing preview without signing in.",
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: "Make sure you are signed in and have access to this project.",
        variant: "destructive",
      });
    }
  }

  const title = useMemo(() => {
    const fromGenerated = generatedContent?.title?.trim()
      || audit?.generatedContent?.title?.trim();
    if (fromGenerated) return fromGenerated;
    if (generatedOnly) return "";
    return audit?.title?.trim() || productName?.trim() || "Product title";
  }, [generatedContent, audit, productName, generatedOnly]);

  const bullets = useMemo(() => {
    const fromGenerated = generatedContent?.bulletPoints?.filter((b) => b.trim()) ?? [];
    if (fromGenerated.length) return normalizeBulletPoints(fromGenerated);
    const fromAudit = audit?.generatedContent?.bulletPoints?.filter((b) => b.trim()) ?? [];
    if (fromAudit.length) return normalizeBulletPoints(fromAudit);
    if (generatedOnly) return [];
    return normalizeBulletPoints((audit?.bulletPoints ?? []).filter((b) => b?.trim()));
  }, [generatedContent, audit, generatedOnly]);

  const htmlDescription = useMemo(() => {
    const fromProps = generatedContent?.htmlDescription?.trim()
      || audit?.generatedContent?.htmlDescription?.trim()
      || "";
    if (fromProps || !generatedOnly) return fromProps;
    return "";
  }, [generatedContent, audit, generatedOnly]);

  const descriptionPreviewHtml = useMemo(
    () => (htmlDescription
      ? sanitizeHtmlDescription(formatHtmlDescriptionForPreview(htmlDescription))
      : ""),
    [htmlDescription],
  );

  const displayBrand = brandName?.trim() || audit?.brandName?.trim() || "Your brand";
  const displayCategory = category?.trim() || audit?.category?.trim() || "General";

  const aplusModules = useMemo(() => {
    const modules = readAplusFromAudit(audit?.generatedImages).modules.filter((m) => m.imageUrl?.trim());
    return [...modules].sort(
      (a, b) => (APLUS_MODULE_ORDER[a.id] ?? 99) - (APLUS_MODULE_ORDER[b.id] ?? 99),
    );
  }, [audit?.generatedImages]);

  const galleryImages = useMemo(
    () => collectListingPreviewImages({
      imageUrls: generatedOnly ? null : audit?.imageUrls,
      imageRecords: audit?.imageRecords,
      generatedImages: audit?.generatedImages,
      graphicsProjectRecords: graphicsProject?.imageRecords ?? null,
      productImageUrl: generatedOnly ? null : productImageUrl,
      fallbackImageUrls: generatedOnly ? null : fallbackImageUrls,
      generatedOnly,
      // A+ modules render full-width below the PDP block (not in the thumbnail carousel).
      aplusModules: null,
    }),
    [
      audit?.imageUrls,
      audit?.imageRecords,
      audit?.generatedImages,
      graphicsProject?.imageRecords,
      productImageUrl,
      fallbackImageUrls,
      generatedOnly,
      refreshKey,
    ],
  );

  const previewDetailRows = useMemo(
    () => mergeListingPreviewProductDetails(referenceIntelligence, productDetails),
    [referenceIntelligence, productDetails],
  );

  const hasPreviewProductDetails = previewDetailRows.length > 0;

  const hasListingCopy = Boolean(
    title.trim() || bullets.length > 0 || descriptionPreviewHtml.length > 0,
  );
  const hasImages = galleryImages.length > 0;
  const imageCount = galleryImages.length;
  const safeSelectedIndex = imageCount > 0 ? Math.min(selectedIndex, imageCount - 1) : 0;
  const selected = galleryImages[safeSelectedIndex] ?? galleryImages[0];
  const canStepGallery = imageCount > 1;

  const goToGalleryIndex = useCallback((index: number) => {
    if (imageCount === 0) return;
    const next = ((index % imageCount) + imageCount) % imageCount;
    setSelectedIndex(next);
    if (lightboxGalleryIndex !== null) {
      setLightboxGalleryIndex(next);
    }
  }, [imageCount, lightboxGalleryIndex]);

  const goPrevImage = useCallback(() => {
    goToGalleryIndex(safeSelectedIndex - 1);
  }, [goToGalleryIndex, safeSelectedIndex]);

  const goNextImage = useCallback(() => {
    goToGalleryIndex(safeSelectedIndex + 1);
  }, [goToGalleryIndex, safeSelectedIndex]);

  const openGalleryLightbox = (index: number) => {
    if (imageCount === 0) return;
    const clamped = Math.max(0, Math.min(index, imageCount - 1));
    setSelectedIndex(clamped);
    setLightboxGalleryIndex(clamped);
    setLightboxStandaloneRawUrl(null);
  };

  const openStandaloneLightbox = (url: string) => {
    setLightboxStandaloneRawUrl(url);
    setLightboxGalleryIndex(null);
  };

  const closeLightbox = () => {
    if (lightboxBlobRef.current) {
      URL.revokeObjectURL(lightboxBlobRef.current);
      lightboxBlobRef.current = null;
    }
    setLightboxGalleryIndex(null);
    setLightboxStandaloneRawUrl(null);
    setLightboxDisplayUrl(null);
  };

  useEffect(() => {
    if (selectedIndex >= imageCount && imageCount > 0) {
      setSelectedIndex(0);
    }
  }, [imageCount, selectedIndex]);

  useEffect(() => {
    thumbRefs.current[safeSelectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [safeSelectedIndex]);

  const lightboxRawUrl = useMemo(() => {
    if (lightboxGalleryIndex !== null && galleryImages[lightboxGalleryIndex]) {
      return galleryImages[lightboxGalleryIndex].url;
    }
    if (lightboxStandaloneRawUrl) return lightboxStandaloneRawUrl;
    return null;
  }, [lightboxGalleryIndex, galleryImages, lightboxStandaloneRawUrl]);

  useEffect(() => {
    if (!lightboxRawUrl) {
      setLightboxDisplayUrl(null);
      return;
    }

    let cancelled = false;

    if (lightboxBlobRef.current) {
      URL.revokeObjectURL(lightboxBlobRef.current);
      lightboxBlobRef.current = null;
    }

    if (!isProtectedAuditImageUrl(lightboxRawUrl)) {
      setLightboxDisplayUrl(resolveListingPreviewImageUrl(lightboxRawUrl));
      return;
    }

    setLightboxDisplayUrl(null);
    void fetchProtectedAppImageBlobUrl(lightboxRawUrl)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        lightboxBlobRef.current = blobUrl;
        setLightboxDisplayUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setLightboxDisplayUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [lightboxRawUrl]);

  useEffect(() => {
    if (!lightboxRawUrl) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
        return;
      }
      if (lightboxGalleryIndex === null || !canStepGallery) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrevImage();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNextImage();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxRawUrl, lightboxGalleryIndex, canStepGallery, goPrevImage, goNextImage]);

  const lightboxOpen = lightboxRawUrl !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-orange-500" />
          <h3 className="text-xs font-semibold text-slate-900">Listing preview</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {showExportButton && (
            <ListingExportButton
              auditId={auditId}
              productName={productName}
              disabled={exportDisabled}
              size="sm"
              className="h-7 text-[10px] rounded-lg gap-1"
            />
          )}
          {sharePreviewLink && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] rounded-lg gap-1"
              onClick={() => void handleCopyPreviewLink()}
            >
              <Link2 className="w-3 h-3" />
              Copy preview link
            </Button>
          )}
          {!publicView && (
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
          )}
        </div>
      </div>

      {(!hasListingCopy || (!hasImages && aplusModules.length === 0)) && !hasPreviewProductDetails && (
        <p className="text-[11px] text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
          {generatedOnly
            ? !hasListingCopy && !hasImages
              ? "This preview shows generated listing copy, reference attributes, graphics, and A+ content. Complete earlier workflow steps to fill it in."
              : !hasListingCopy
                ? "Generate listing copy on the Listing step to preview title, bullets, and description here."
                : "Generate graphics on the Graphics step to preview the image gallery here."
            : !hasListingCopy && !hasImages
              ? "Generate listing content and graphics in the earlier steps to see a full preview."
              : !hasListingCopy
                ? "Add or generate listing copy on the Listing step to preview title and bullets."
                : "Add product images or generate graphics to preview the image gallery."}
        </p>
      )}

      <div
        className={cn(
          "bg-white shadow-sm overflow-hidden",
          edgeToEdge
            ? cn(
                "rounded-none border-0 border-y border-slate-200",
                publicView
                  ? "-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16"
                  : "-mx-3.5",
              )
            : "rounded-lg border border-slate-200",
        )}
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-4 items-start px-4 pt-4 pb-2 lg:gap-6 lg:px-5 lg:pt-5 lg:pb-3",
            "lg:grid-cols-[auto_minmax(0,min(36rem,42vw))_minmax(0,1fr)]",
            "xl:grid-cols-[auto_minmax(0,min(40rem,38vw))_minmax(0,1fr)]",
          )}
        >
          {/* Thumbnails */}
          <div className="flex flex-col items-center gap-1 order-2 lg:order-1 shrink-0">
            {canStepGallery && (
              <button
                type="button"
                className="hidden lg:flex w-14 h-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                onClick={goPrevImage}
                aria-label="Previous image"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
            <div
              className={cn(
                "flex lg:flex-col gap-2 w-full",
                "overflow-x-auto pb-1 lg:pb-0",
                "lg:overflow-x-hidden lg:overflow-y-auto lg:pr-0.5",
                "lg:max-h-[min(380px,65vw)]",
                "[scrollbar-width:thin]",
              )}
            >
            {hasImages ? (
              galleryImages.map((img, index) => (
                <button
                  key={`${img.url}-${index}`}
                  ref={(el) => {
                    thumbRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => openGalleryLightbox(index)}
                  className={cn(
                    "relative shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden bg-slate-50 cursor-zoom-in",
                    safeSelectedIndex === index ? "border-blue-500" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <ProtectedAppImage
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover"
                  />
                  {img.label.startsWith("A+") && (
                    <span className="absolute bottom-0 left-0 right-0 bg-orange-600/90 text-white text-[8px] font-bold uppercase tracking-wide py-0.5 truncate px-0.5">
                      A+
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="w-14 h-14 rounded-md border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 text-center px-1">
                No images
              </div>
            )}
            </div>
            {canStepGallery && (
              <>
                <button
                  type="button"
                  className="hidden lg:flex w-14 h-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  onClick={goNextImage}
                  aria-label="Next image"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="hidden lg:flex gap-1 w-14">
                  <button
                    type="button"
                    className="flex-1 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    onClick={goPrevImage}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex-1 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    onClick={goNextImage}
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Main image */}
          <div className="order-1 lg:order-2 relative aspect-square max-h-[min(420px,70vw)] w-full max-w-md mx-auto lg:mx-0 lg:max-w-full lg:max-h-[min(560px,48vh)] xl:max-h-[min(640px,52vh)] lg:justify-self-stretch rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden group/main-image">
            {selected ? (
              <>
                {canStepGallery && (
                  <>
                    <button
                      type="button"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 opacity-100 sm:opacity-0 sm:group-hover/main-image:opacity-100 hover:bg-white transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrevImage();
                      }}
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 opacity-100 sm:opacity-0 sm:group-hover/main-image:opacity-100 hover:bg-white transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        goNextImage();
                      }}
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="w-full h-full flex items-center justify-center cursor-zoom-in"
                  onClick={() => openGalleryLightbox(safeSelectedIndex)}
                  aria-label="View full size image"
                >
                  <ProtectedAppImage
                    src={selected.url}
                    alt={selected.label}
                    className="w-full h-full object-contain"
                  />
                </button>
                {canStepGallery && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/55 text-white text-[10px] px-1.5 py-0.5 tabular-nums">
                    {safeSelectedIndex + 1} / {imageCount}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-slate-400">Main image</span>
            )}
          </div>

          {/* Product details */}
          <div className="order-3 space-y-3 min-w-0 w-full max-w-none">
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
          </div>
        </div>

        {htmlDescription && (
          <div className="border-t border-slate-100 px-4 py-3 lg:px-5">
            <p className="text-[11px] font-semibold text-slate-900 mb-1.5">Product description</p>
            <div
              className="amazon-listing-description prose prose-sm max-w-none text-slate-700 text-[11px]"
              dangerouslySetInnerHTML={{ __html: descriptionPreviewHtml }}
            />
          </div>
        )}

        {hasPreviewProductDetails && (
          <section className="border-t border-slate-200 bg-white" aria-label="Product details">
            <div className="border-b border-slate-200 px-4 lg:px-5 bg-white">
              <p className="py-2.5 text-[11px] font-semibold text-slate-900">Product details</p>
            </div>
            <ReferenceIntelligenceListingPreview rows={previewDetailRows} />
          </section>
        )}

        {aplusModules.length > 0 && (
          <section className="border-t border-slate-200 bg-white" aria-label="From the brand">
            <div className="border-b border-slate-200 px-4 lg:px-5 bg-white">
              <p className="py-2.5 text-[11px] font-semibold text-slate-900 border-b-2 border-orange-500 -mb-px inline-block">
                From the brand
              </p>
            </div>
            <div className="px-4 sm:px-8 lg:px-12 py-4 bg-white">
              <div className="mx-auto w-full max-w-3xl flex flex-col gap-4">
                {aplusModules.map((module) => (
                  module.imageUrl ? (
                    <button
                      key={module.id}
                      type="button"
                      className="block w-full cursor-zoom-in p-0 m-0 border-0 bg-transparent rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      onClick={() => openStandaloneLightbox(module.imageUrl)}
                      aria-label={`View full size ${module.title}`}
                    >
                      <ProtectedAppImage
                        src={module.imageUrl}
                        alt={module.title}
                        className="w-full h-auto block"
                      />
                    </button>
                  ) : null
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center gap-2 sm:gap-4">
            {lightboxGalleryIndex !== null && canStepGallery && (
              <button
                type="button"
                className="shrink-0 w-10 h-10 rounded-full bg-white/95 text-slate-800 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrevImage();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="relative min-w-0">
              {lightboxDisplayUrl ? (
                <img
                  src={lightboxDisplayUrl}
                  alt="Full size preview"
                  className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  className="w-[min(90vw,480px)] h-[min(85vh,360px)] rounded-xl bg-slate-800/80 flex items-center justify-center text-white text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  Loading image…
                </div>
              )}
              {lightboxGalleryIndex !== null && canStepGallery && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white text-xs px-3 py-1 tabular-nums">
                  {lightboxGalleryIndex + 1} / {imageCount}
                </span>
              )}
              <button
                type="button"
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  closeLightbox();
                }}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {lightboxGalleryIndex !== null && canStepGallery && (
              <button
                type="button"
                className="shrink-0 w-10 h-10 rounded-full bg-white/95 text-slate-800 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  goNextImage();
                }}
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
