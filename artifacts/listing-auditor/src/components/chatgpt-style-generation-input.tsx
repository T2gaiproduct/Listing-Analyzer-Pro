import { useEffect, useRef, useState } from "react";
import { ReferenceImagePopoutDialog } from "@/components/reference-image-popout-dialog";
import { ChevronDown, Loader2, Plus, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRAPHICS_ASPECT_RATIOS,
  GRAPHICS_QUALITY_OPTIONS,
  type GraphicsAspectRatio,
  type GraphicsQuality,
} from "@/components/graphics-output-options";
import { useReferenceImageUpload } from "@/components/use-reference-image-upload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MAX_REFERENCE_IMAGES = 4;

type ChatGptStyleGenerationInputProps = {
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  aspectRatio: GraphicsAspectRatio;
  onAspectRatioChange: (ratio: GraphicsAspectRatio) => void;
  quality: GraphicsQuality;
  onQualityChange: (quality: GraphicsQuality) => void;
  promptMaxChars?: number;
  hideAspectRatio?: boolean;
  placeholder?: string;
  className?: string;
  /** Flat border only — no drop shadow (module customize dialog). */
  flatSurface?: boolean;
};

function ToolbarPill({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-600",
        "hover:bg-slate-100 transition-colors whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ChatGptStyleGenerationInput({
  customPrompt,
  onCustomPromptChange,
  referenceImages,
  onReferenceImagesChange,
  aspectRatio,
  onAspectRatioChange,
  quality,
  onQualityChange,
  promptMaxChars = 1000,
  hideAspectRatio = false,
  placeholder = "Describe scene, lighting, composition, and mood…",
  className,
  flatSurface = false,
}: ChatGptStyleGenerationInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedRatio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];
  const selectedQuality = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === quality) ?? GRAPHICS_QUALITY_OPTIONS[0];

  const {
    fileInputRef,
    handleFiles,
    isUploading,
    canAddMore,
    openFilePicker,
    removeImage,
  } = useReferenceImageUpload(referenceImages, onReferenceImagesChange, MAX_REFERENCE_IMAGES);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [customPrompt]);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "rounded-[26px] border border-slate-200/90 bg-white transition-colors",
          flatSurface
            ? "shadow-none focus-within:border-slate-300"
            : "shadow-[0_2px_12px_rgba(15,23,42,0.08)] focus-within:border-slate-300 focus-within:shadow-[0_4px_20px_rgba(15,23,42,0.1)]",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        {referenceImages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {referenceImages.map((img, idx) => (
              <div
                key={`${idx}-${img.slice(0, 32)}`}
                className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
              >
                <button
                  type="button"
                  className="absolute inset-0 z-0"
                  onClick={() => setPreviewUrl(img)}
                  title="View full size"
                  aria-label={`View reference ${idx + 1} full size`}
                >
                  <img src={img} alt={`Reference ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
                  aria-label="Remove reference"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1 px-2 py-2 sm:px-3">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canAddMore || isUploading}
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700",
              "hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors",
            )}
            aria-label="Add reference image"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={1.75} />}
          </button>

          <textarea
            ref={textareaRef}
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder={placeholder}
            maxLength={promptMaxChars}
            rows={1}
            className={cn(
              "min-h-[2.25rem] max-h-40 flex-1 resize-none border-0 bg-transparent py-2 text-[15px] leading-snug",
              "text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0",
            )}
          />

          <div className="mb-0.5 flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-0.5 sm:max-w-none sm:flex-nowrap sm:gap-1">
            {!hideAspectRatio && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <ToolbarPill aria-label="Aspect ratio">
                      <span className="hidden sm:inline text-slate-400">Ratio</span>
                      <span>{selectedRatio.value}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </ToolbarPill>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <p className="px-2 py-1 text-xs font-semibold text-slate-500">Aspect ratio</p>
                    {GRAPHICS_ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => onAspectRatioChange(ratio.value)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100",
                          ratio.value === aspectRatio && "bg-orange-50 text-orange-900",
                        )}
                      >
                        <span>{ratio.symbol}</span>
                        <span className="font-medium">{ratio.label}</span>
                        <span className="ml-auto text-xs text-slate-400">{ratio.value}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <span
                  className="hidden sm:inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 whitespace-nowrap"
                  aria-label="Output size"
                >
                  {selectedRatio.size}
                </span>
              </>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <ToolbarPill aria-label="Quality">
                  {quality === "hd" ? (
                    <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{selectedQuality.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </ToolbarPill>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-2">
                <p className="px-2 py-1 text-xs font-semibold text-slate-500">Quality</p>
                {GRAPHICS_QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onQualityChange(opt.value)}
                    className={cn(
                      "flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100",
                      opt.value === quality && "bg-orange-50 text-orange-900",
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-slate-500">{opt.desc}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <ReferenceImagePopoutDialog
        src={previewUrl}
        open={previewUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null);
        }}
      />

      {customPrompt.length > 0 && (
        <p
          className={cn(
            "mt-1.5 text-right text-[11px] tabular-nums",
            customPrompt.length > promptMaxChars ? "text-red-500" : "text-slate-400",
          )}
        >
          {customPrompt.length} / {promptMaxChars}
        </p>
      )}
    </div>
  );
}
