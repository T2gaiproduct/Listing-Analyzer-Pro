import { useRef, useState } from "react";
import { Loader2, Paperclip, Sparkles, Upload, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_FILE_SIZE = 1024;
const MIN_WIDTH = 256;
const MIN_HEIGHT = 256;

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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selectedRatio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];
  const selectedQuality = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === quality) ?? GRAPHICS_QUALITY_OPTIONS[0];
  const canAddMore = referenceImages.length < MAX_REFERENCE_IMAGES;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
    if (remaining <= 0) {
      toast({
        title: "Reference limit reached",
        description: `You can attach up to ${MAX_REFERENCE_IMAGES} images.`,
        variant: "destructive",
      });
      return;
    }

    const rawFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining);
    if (rawFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please upload image files only.", variant: "destructive" });
      return;
    }

    const validFiles: File[] = [];
    for (const file of rawFiles) {
      if (file.size < MIN_FILE_SIZE) {
        toast({
          title: "Image too small",
          description: `"${file.name}" may be corrupted or too low quality.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Image too large", description: `"${file.name}" exceeds the 20 MB limit.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    setIsUploading(true);
    const results: string[] = [];
    let checks = 0;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
            toast({
              title: "Image too small",
              description: `"${file.name}" is ${img.width}×${img.height}. Minimum ${MIN_WIDTH}×${MIN_HEIGHT}px recommended.`,
              variant: "destructive",
            });
          } else {
            results.push(dataUrl);
          }
          checks++;
          if (checks === validFiles.length) {
            if (results.length > 0) {
              onReferenceImagesChange([...referenceImages, ...results].slice(0, MAX_REFERENCE_IMAGES));
            }
            setIsUploading(false);
          }
        };
        img.onerror = () => {
          toast({ title: "Invalid image", description: `"${file.name}" could not be loaded.`, variant: "destructive" });
          checks++;
          if (checks === validFiles.length) {
            if (results.length > 0) {
              onReferenceImagesChange([...referenceImages, ...results].slice(0, MAX_REFERENCE_IMAGES));
            }
            setIsUploading(false);
          }
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        checks++;
        if (checks === validFiles.length) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("rounded-2xl border border-orange-200 bg-orange-50/30 p-4 space-y-4", className)}>
      <label className="text-base font-medium text-orange-900 block">Custom Prompt</label>

      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
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
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference upload</Label>
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            {referenceImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {referenceImages.map((img, idx) => (
                  <div
                    key={`${idx}-${img.slice(0, 24)}`}
                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                  >
                    <img src={img} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label="Remove reference image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              disabled={!canAddMore || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {canAddMore ? "Upload reference images" : "Upload limit reached"}
            </Button>
            <p className="text-[11px] text-slate-400">
              Optional. Up to {MAX_REFERENCE_IMAGES} images · PNG/JPG · max 20 MB each
            </p>
          </div>
        </div>

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
    </div>
  );
}
