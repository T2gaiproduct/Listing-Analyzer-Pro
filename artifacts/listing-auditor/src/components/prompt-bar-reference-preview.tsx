import { Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReferenceImageThumbStrip } from "@/components/reference-image-thumb-strip";
import {
  GRAPHICS_ASPECT_RATIOS,
  GRAPHICS_QUALITY_OPTIONS,
  type GraphicsAspectRatio,
  type GraphicsQuality,
} from "@/components/graphics-output-options";

type Props = {
  referenceImages: string[];
  customPrompt?: string;
  aspectRatio?: GraphicsAspectRatio;
  quality?: GraphicsQuality;
  hideAspectRatio?: boolean;
  placeholder?: string;
  className?: string;
  onPreviewReference?: (url: string) => void;
};

/** Read-only preview of the Create Graphics prompt input bar (references + controls). */
export function PromptBarReferencePreview({
  referenceImages,
  customPrompt = "",
  aspectRatio = "1:1",
  quality = "standard",
  hideAspectRatio = false,
  placeholder = "Optional — scene, lighting, composition, and mood…",
  className,
  onPreviewReference,
}: Props) {
  const ratio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];
  const qualityOpt = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === quality) ?? GRAPHICS_QUALITY_OPTIONS[0];

  return (
    <div className={cn("rounded-[26px] border border-slate-200/90 bg-white shadow-none", className)}>
      {referenceImages.length > 0 ? (
        <ReferenceImageThumbStrip
          images={referenceImages}
          prominent
          onPreview={onPreviewReference ? (url) => onPreviewReference(url) : undefined}
          className="px-4 pt-3 pb-1"
        />
      ) : null}
      <div className="flex items-end gap-1 px-2 py-2 sm:px-3 pointer-events-none">
        <div className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400">
          <Plus className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <p
          className={cn(
            "min-h-[2.25rem] flex-1 py-2 text-[15px] leading-snug truncate",
            customPrompt.trim() ? "text-slate-900" : "text-slate-400",
          )}
        >
          {customPrompt.trim() || placeholder}
        </p>
        <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-1 text-xs font-medium text-slate-500">
          {!hideAspectRatio ? (
            <>
              <span className="rounded-full px-2 py-1">Ratio {ratio.value}</span>
              <span className="rounded-full px-2 py-1">{ratio.size}</span>
            </>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1">
            <Zap className="h-3.5 w-3.5 text-slate-400" />
            {qualityOpt.label}
          </span>
        </div>
      </div>
    </div>
  );
}
