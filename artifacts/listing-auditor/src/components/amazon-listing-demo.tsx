import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DemoListing } from "@/lib/demo-listings";

type ViewMode = "listing" | "aplus";

export function AmazonListingDemo({
  listings,
  ctaText,
  ctaUrl,
  className,
}: {
  listings: DemoListing[];
  ctaText?: string;
  ctaUrl?: string;
  className?: string;
}) {
  const [listingIndex, setListingIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("listing");

  if (listings.length === 0) return null;

  const listing = listings[listingIndex] ?? listings[0];
  const hasAplus = listing.aplusImages.length > 0;
  const activeImages = viewMode === "aplus" && hasAplus ? listing.aplusImages : listing.gallery;
  const activeImage = activeImages[imageIndex] ?? activeImages[0];

  function selectListing(index: number) {
    setListingIndex(index);
    setImageIndex(0);
    setViewMode("listing");
  }

  function selectImage(index: number) {
    setImageIndex(index);
  }

  function shiftImage(dir: -1 | 1) {
    if (activeImages.length <= 1) return;
    setImageIndex((prev) => {
      const next = prev + dir;
      if (next < 0) return activeImages.length - 1;
      if (next >= activeImages.length) return 0;
      return next;
    });
  }

  return (
    <div className={cn("w-full", className)}>
      {listings.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 justify-center lg:justify-start">
          {listings.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectListing(index)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                index === listingIndex
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
              )}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Interactive demo</p>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode("listing");
                setImageIndex(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                viewMode === "listing" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              Listing gallery
            </button>
            <button
              type="button"
              disabled={!hasAplus}
              onClick={() => {
                setViewMode("aplus");
                setImageIndex(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                !hasAplus && "opacity-40 cursor-not-allowed",
                viewMode === "aplus" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              A+ preview
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-0">
          <div className="p-4 sm:p-6 lg:p-8 bg-[#fafafa] border-b lg:border-b-0 lg:border-r border-slate-100">
            <div className="relative aspect-square max-w-md mx-auto bg-white rounded-xl border border-slate-200 overflow-hidden">
              {activeImage && (
                <img
                  src={activeImage.url}
                  alt={activeImage.label}
                  className="absolute inset-0 w-full h-full object-contain p-3 sm:p-4"
                />
              )}
              {activeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => shiftImage(-1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center hover:bg-white"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftImage(1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center hover:bg-white"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-700" />
                  </button>
                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-medium text-slate-600 bg-white/90 px-2.5 py-1 rounded-full border border-slate-200">
                    {activeImage?.label} · {imageIndex + 1}/{activeImages.length}
                  </p>
                </>
              )}
            </div>

            {activeImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide justify-center lg:justify-start">
                {activeImages.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => selectImage(index)}
                    className={cn(
                      "shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 overflow-hidden bg-white",
                      index === imageIndex ? "border-orange-500" : "border-slate-200 hover:border-slate-300",
                    )}
                    aria-label={img.label}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 lg:p-8 min-w-0">
            <p className="text-[11px] font-medium text-slate-400 mb-2">Demo listing preview</p>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug mb-2">
              {listing.productTitle}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs text-slate-500">1,247 ratings</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{listing.price}</p>
            <p className="text-xs text-emerald-700 font-medium mb-4">FREE delivery on qualifying orders · In Stock</p>

            {listing.bullets.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-slate-900 mb-2">About this item</p>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  {listing.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="text-slate-400 shrink-0">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-amber-400 text-sm font-medium text-slate-900">
                Add to Cart
              </span>
              <span className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-orange-500 text-sm font-medium text-white">
                Buy Now
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Static preview for demonstration — not a live Amazon listing.
            </p>
          </div>
        </div>
      </div>

      {ctaText && ctaUrl && (
        <div className="mt-6 sm:mt-8 text-center lg:text-left">
          <Button className="bg-orange-500 hover:bg-orange-600" asChild>
            <Link href={ctaUrl}>{ctaText}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
