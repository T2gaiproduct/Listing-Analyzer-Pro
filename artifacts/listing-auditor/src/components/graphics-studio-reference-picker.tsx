import { useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProtectedAppImage } from "@/components/protected-app-image";
import { ReferenceImagePopoutDialog } from "@/components/reference-image-popout-dialog";
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
  /** Create Graphics customize: summary + popup picker (avoids clipped inline grid). */
  openSelectionInDialog?: boolean;
};

function normalizeImages(exampleImages: GraphicsModuleExampleImage[], fallbackUrl: string | null) {
  if (exampleImages.length) return exampleImages;
  if (fallbackUrl) return [{ id: 0, url: fallbackUrl }];
  return [];
}

type BodyProps = {
  moduleLabel: string;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  images: GraphicsModuleExampleImage[];
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  isLoading?: boolean;
  spacious?: boolean;
  onPreviewUrl?: (url: string) => void;
};

function GraphicsStudioReferencePickerBody({
  moduleLabel,
  resolvedCategory,
  usedDefaultFallback,
  images,
  referenceImages,
  onReferenceImagesChange,
  isLoading,
  spacious = false,
  onPreviewUrl,
}: BodyProps) {
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
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
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
        <p className="text-[11px] text-slate-500 shrink-0">
          References for AI: {slotsUsed}/{MAX_REFERENCE_IMAGES}
        </p>
      </div>

      {usedDefaultFallback ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
          No examples for your product category — showing Default.
        </p>
      ) : null}

      <div
        className={cn(
          "rounded-xl border border-slate-200 bg-slate-50/80 p-3 min-h-[120px] shadow-none min-w-0",
          spacious && "p-4",
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading examples…
          </div>
        ) : images.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 px-4">No studio examples for this module yet.</p>
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
            <div
              className={cn(
                "grid gap-2 min-w-0",
                spacious
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
              )}
            >
              {images.map((img, idx) => {
                const selected = referenceImages.includes(img.url);
                const disabled = !selected && slotsLeft <= 0;
                return (
                  <div
                    key={img.id > 0 ? img.id : `${img.url}-${idx}`}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all min-w-0",
                      selected ? "border-orange-500" : "border-slate-200",
                      disabled && "opacity-50",
                    )}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleStudioUrl(img.url)}
                      className={cn(
                        "absolute inset-0 z-[1]",
                        !disabled && "hover:ring-2 hover:ring-inset hover:ring-orange-200",
                        disabled && "cursor-not-allowed",
                      )}
                      title={
                        selected
                          ? "Remove from generation references"
                          : disabled
                            ? "Maximum reference images reached"
                            : "Use as generation reference"
                      }
                      aria-label={
                        selected
                          ? `Deselect studio example ${idx + 1}`
                          : `Select studio example ${idx + 1}`
                      }
                    />
                    <button
                      type="button"
                      className="relative z-0 w-full h-full pointer-events-none"
                      tabIndex={-1}
                      aria-hidden
                    >
                      <ProtectedAppImage
                        src={img.url}
                        alt={`${moduleLabel} studio example ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                    {onPreviewUrl ? (
                      <button
                        type="button"
                        className="absolute bottom-1.5 left-1.5 z-[2] rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/75"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewUrl(img.url);
                        }}
                      >
                        View
                      </button>
                    ) : null}
                    {selected ? (
                      <span className="absolute top-1.5 right-1.5 z-[2] rounded-full bg-orange-500 text-white p-0.5 pointer-events-none">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function GraphicsStudioReferencePicker({
  moduleLabel,
  resolvedCategory,
  usedDefaultFallback,
  exampleImages,
  referenceImages,
  onReferenceImagesChange,
  isLoading,
  openSelectionInDialog = false,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const images = normalizeImages(exampleImages, null);
  const studioUrls = new Set(images.map((i) => i.url));
  const selectedStudio = referenceImages.filter((u) => studioUrls.has(u));

  const openPreview = (url: string) => setPreviewUrl(url);

  const body = (
    <GraphicsStudioReferencePickerBody
      moduleLabel={moduleLabel}
      resolvedCategory={resolvedCategory}
      usedDefaultFallback={usedDefaultFallback}
      images={images}
      referenceImages={referenceImages}
      onReferenceImagesChange={onReferenceImagesChange}
      isLoading={isLoading}
      onPreviewUrl={openPreview}
    />
  );

  const previewDialog = (
    <ReferenceImagePopoutDialog
      src={previewUrl}
      alt={`${moduleLabel} reference`}
      open={previewUrl !== null}
      onOpenChange={(open) => {
        if (!open) setPreviewUrl(null);
      }}
    />
  );

  if (!openSelectionInDialog) {
    return (
      <>
        {body}
        {previewDialog}
      </>
    );
  }

  const hasExamples = !isLoading && images.length > 0;
  const previewStrip = selectedStudio.length > 0 ? selectedStudio : images.map((i) => i.url);

  return (
    <>
      <div className="rounded-xl border border-orange-200/80 bg-orange-50/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={isLoading}
          className={cn(
            "w-full text-left px-3 pt-3 pb-2 transition-colors",
            "hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400",
            isLoading && "opacity-70 cursor-wait",
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Studio references — {moduleLabel}
              </p>
              <p className="text-sm font-medium text-orange-800 mt-1">
                {isLoading
                  ? "Loading examples…"
                  : hasExamples
                    ? selectedStudio.length > 0
                      ? `${selectedStudio.length} selected for AI · also shown in prompt bar below`
                      : "Tap to choose references (up to 4 total)"
                    : "No studio examples yet"}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" aria-hidden />
          </div>
        </button>

        {hasExamples && previewStrip.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1 border-t border-orange-200/60">
            {previewStrip.slice(0, MAX_REFERENCE_IMAGES).map((url, idx) => (
              <button
                key={`${idx}-${url.slice(0, 24)}`}
                type="button"
                onClick={() => openPreview(url)}
                className={cn(
                  "w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border-2 transition-transform hover:scale-105",
                  selectedStudio.includes(url) ? "border-orange-500" : "border-slate-200",
                )}
                title="View full size"
              >
                <ProtectedAppImage src={url} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[min(100vw-1.5rem,48rem)] max-h-[min(92vh,880px)] overflow-y-auto gap-4 p-5 sm:p-6 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg">Choose studio references</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Admin-configured examples for {moduleLabel}. Tap a tile to select; use View for full size. Up to{" "}
              {MAX_REFERENCE_IMAGES} references total including uploads below.
            </p>
          </DialogHeader>
          <GraphicsStudioReferencePickerBody
            moduleLabel={moduleLabel}
            resolvedCategory={resolvedCategory}
            usedDefaultFallback={usedDefaultFallback}
            images={images}
            referenceImages={referenceImages}
            onReferenceImagesChange={onReferenceImagesChange}
            isLoading={isLoading}
            spacious
            onPreviewUrl={openPreview}
          />
          <DialogFooter className="sm:justify-end pt-1">
            <Button
              type="button"
              className="bg-orange-500 hover:bg-orange-600 text-white min-w-[7rem]"
              onClick={() => setDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewDialog}
    </>
  );
}
