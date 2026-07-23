import { Paperclip, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReferenceImageUploadField } from "@/components/reference-image-upload-field";

export type GraphicsAspectRatio = "1:1" | "3:2" | "2:3";
export type GraphicsQuality = "standard" | "hd";

export const GRAPHICS_ASPECT_RATIOS: {
  value: GraphicsAspectRatio;
  label: string;
  size: string;
  symbol: string;
}[] = [
  { value: "1:1", label: "Square", size: "1024 × 1024", symbol: "⬜" },
  { value: "3:2", label: "Landscape", size: "1792 × 1024", symbol: "▬" },
  { value: "2:3", label: "Portrait", size: "1024 × 1792", symbol: "▮" },
];

export const GRAPHICS_QUALITY_OPTIONS: { value: GraphicsQuality; label: string; desc: string }[] = [
  { value: "standard", label: "Standard", desc: "Faster generation" },
  { value: "hd", label: "HD", desc: "Sharper detail" },
];

const MAX_REFERENCE_IMAGES = 4;

export interface CustomPromptGenerationPanelProps {
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  aspectRatio: GraphicsAspectRatio;
  onAspectRatioChange: (ratio: GraphicsAspectRatio) => void;
  quality: GraphicsQuality;
  onQualityChange: (quality: GraphicsQuality) => void;
  promptMaxChars?: number;
  examplePrompts?: string[];
  className?: string;
}

export function CustomPromptGenerationPanel({
  customPrompt,
  onCustomPromptChange,
  referenceImages,
  onReferenceImagesChange,
  aspectRatio,
  onAspectRatioChange,
  quality,
  onQualityChange,
  promptMaxChars = 1000,
  examplePrompts = [],
  className,
}: CustomPromptGenerationPanelProps) {
  const selectedRatio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];
  const selectedQuality = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === quality) ?? GRAPHICS_QUALITY_OPTIONS[0];

  return (
    <div className={cn("rounded-2xl border border-orange-200 bg-orange-50/30 p-4 space-y-4", className)}>
      <label className="text-base font-medium text-orange-900 block">Custom Prompt</label>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="Describe exactly what you want the AI to create. Be specific about the scene, lighting, composition, and mood."
          rows={4}
          maxLength={promptMaxChars}
          className="w-full resize-none text-sm sm:text-base bg-transparent border-0 p-4 min-h-[7rem] focus:outline-none focus:ring-0 placeholder:text-slate-400"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReferenceImageUploadField
          images={referenceImages}
          onImagesChange={onReferenceImagesChange}
          maxImages={MAX_REFERENCE_IMAGES}
          label="Reference upload"
        />

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Output settings</Label>
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={(v) => onAspectRatioChange(v as GraphicsAspectRatio)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAPHICS_ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.symbol} {ratio.label} ({ratio.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Size</Label>
              <div className="h-9 px-3 rounded-md border border-slate-200 bg-slate-50 flex items-center text-sm text-slate-700">
                {selectedRatio.size}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Quality</Label>
              <Select value={quality} onValueChange={(v) => onQualityChange(v as GraphicsQuality)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAPHICS_QUALITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="inline-flex items-center gap-2">
                        {opt.value === "hd" ? (
                          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {opt.label} — {opt.desc}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {referenceImages.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
            <Paperclip className="w-3 h-3" />
            {referenceImages.length} file{referenceImages.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
          {selectedRatio.symbol} {selectedRatio.value} · {selectedRatio.size}
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
          {selectedQuality.label} quality
        </span>
        {customPrompt.length > 0 && (
          <span className={cn("ml-auto", customPrompt.length > promptMaxChars ? "text-red-500" : "text-slate-400")}>
            {customPrompt.length} / {promptMaxChars}
          </span>
        )}
      </div>

      {examplePrompts.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Example prompts</p>
          <div className="space-y-1">
            {examplePrompts.map((example) => (
              <button
                key={example}
                type="button"
                className="block text-left text-xs text-orange-600 hover:text-orange-700 hover:underline w-full"
                onClick={() => onCustomPromptChange(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
