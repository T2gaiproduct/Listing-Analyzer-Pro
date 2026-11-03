import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProtectedAppImage } from "@/components/protected-app-image";
import type { GraphicsModuleExampleImage } from "@/lib/graphics-module-examples";

const MAX_REFERENCE_IMAGES = 4;

type Props = {
  moduleLabel: string;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  exampleImages: GraphicsModuleExampleImage[];
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  isLoading?: boolean;
};

function normalizeImages(exampleImages: GraphicsModuleExampleImage[], fallbackUrl: string | null) {
  if (exampleImages.length) return exampleImages;
  if (fallbackUrl) return [{ id: 0, url: fallbackUrl }];
  return [];
}

export function GraphicsStudioReferencePicker({
  moduleLabel,
  resolvedCategory,
  usedDefaultFallback,
  exampleImages,
  referenceImages,
  onReferenceImagesChange,
  isLoading,
}: Props) {
  const images = normalizeImages(exampleImages, null);
  const studioUrls = new Set(images.map((i) => i.url));
  const selectedStudioCount = referenceImages.filter((u) => studioUrls.has(u)).length;
  const slotsUsed = referenceImages.length;
  const slotsLeft = MAX_REFERENCE_IMAGES - slotsUsed;

  function toggleStudioUrl(url: string) {
    if (referenceImages.includes(url)) {
      onReferenceImagesChange(referenceImages.filter((u) => u !== url));
      return;
    }
    if (slotsLeft <= 0) return;
    onReferenceImagesChange([...referenceImages, url]);
  }

  function selectAllStudio() {
    const merged = [...referenceImages];
    for (const img of images) {
      if (merged.length >= MAX_REFERENCE_IMAGES) break;
      if (!merged.includes(img.url)) merged.push(img.url);
    }
    onReferenceImagesChange(merged);
  }

  function clearStudioSelection() {
    onReferenceImagesChange(referenceImages.filter((u) => !studioUrls.has(u)));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Studio references — {moduleLabel}
          </p>
          <p className="text-[11px] text-slate-500">
            Category: <span className="font-medium text-slate-700">{resolvedCategory}</span>
            {images.length > 1 ? (
              <span className="text-slate-400"> · {images.length} examples</span>
            ) : null}
          </p>
        </div>
        <p className="text-[11px] text-slate-500">
          References for AI: {slotsUsed}/{MAX_REFERENCE_IMAGES}
        </p>
      </div>

      {usedDefaultFallback ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
          No examples for your product category — showing Default.
        </p>
      ) : null}

      <p className="text-xs text-slate-600">
        Tap examples your admin uploaded to include them as optional style references for this graphic (along with
        your own uploads below).
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-h-[120px]">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading examples…
          </div>
        ) : images.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 px-4">
            No studio examples for this module yet. Your admin can add several in Image generation prompts → Product
            / gallery graphics.
          </p>
        ) : (
          <>
            {images.length > 1 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="text-[11px] font-medium text-orange-700 hover:underline disabled:opacity-40"
                  disabled={selectedStudioCount >= images.length || slotsLeft <= 0}
                  onClick={selectAllStudio}
                >
                  Select all (up to {MAX_REFERENCE_IMAGES} total refs)
                </button>
                {selectedStudioCount > 0 ? (
                  <>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-slate-600 hover:underline"
                      onClick={clearStudioSelection}
                    >
                      Clear studio selection
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((img, idx) => {
                const selected = referenceImages.includes(img.url);
                const disabled = !selected && slotsLeft <= 0;
                return (
                  <button
                    key={img.id > 0 ? img.id : `${img.url}-${idx}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleStudioUrl(img.url)}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all text-left",
                      selected
                        ? "border-orange-500 ring-2 ring-orange-200"
                        : "border-slate-200 hover:border-orange-300",
                      disabled && "opacity-50 cursor-not-allowed",
                    )}
                    title={
                      selected
                        ? "Remove from generation references"
                        : disabled
                          ? "Maximum reference images reached"
                          : "Use as generation reference"
                    }
                  >
                    <ProtectedAppImage
                      src={img.url}
                      alt={`${moduleLabel} studio example ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {selected ? (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-orange-500 text-white p-0.5 shadow">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
