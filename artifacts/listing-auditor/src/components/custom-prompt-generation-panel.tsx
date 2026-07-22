import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  className,
}: CustomPromptGenerationPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selectedRatio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
    if (remaining <= 0) {
      toast({ title: "Reference limit reached", description: `You can attach up to ${MAX_REFERENCE_IMAGES} images.`, variant: "destructive" });
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
        toast({ title: "Image too small", description: `"${file.name}" may be corrupted or too low quality.`, variant: "destructive" });
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
    <div className={cn("rounded-2xl border border-orange-200 bg-orange-50/30 p-5 space-y-4", className)}>
      <div className="space-y-2">
        <label className="text-base font-medium text-orange-900">Custom Prompt</label>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="Describe exactly what you want the AI to create..."
          rows={4}
          maxLength={promptMaxChars}
          className="w-full resize-none text-base border border-slate-200 rounded-xl p-4 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
        {customPrompt.length > 0 && (
          <p className={cn("text-xs text-right", customPrompt.length > promptMaxChars ? "text-red-500" : "text-slate-400")}>
            {customPrompt.length} / {promptMaxChars}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-orange-900">Reference images</label>
          <span className="text-xs text-slate-500">Optional · like ChatGPT</span>
        </div>
        <p className="text-xs text-slate-500">
          Upload photos for style, layout, or product reference. The AI uses them to guide the result.
        </p>

        {referenceImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {referenceImages.map((img, idx) => (
              <div key={`${idx}-${img.slice(0, 24)}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white">
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

        {referenceImages.length < MAX_REFERENCE_IMAGES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-white/80 px-4 py-3 text-sm font-medium text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus className="w-4 h-4" />
                Add reference images ({referenceImages.length}/{MAX_REFERENCE_IMAGES})
              </>
            )}
          </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-orange-200/80">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Aspect ratio</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAPHICS_ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.value}
                type="button"
                onClick={() => onAspectRatioChange(ratio.value)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  aspectRatio === ratio.value
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white border-slate-200 text-slate-700 hover:border-orange-300",
                )}
              >
                <span className="mr-1">{ratio.symbol}</span>
                {ratio.value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Size</p>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{selectedRatio.size}</p>
            <p className="text-xs text-slate-500">{selectedRatio.label}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quality</p>
          <div className="flex gap-1.5">
            {GRAPHICS_QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onQualityChange(opt.value)}
                className={cn(
                  "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all text-left",
                  quality === opt.value
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white border-slate-200 text-slate-700 hover:border-orange-300",
                )}
              >
                <span className="block font-semibold">{opt.label}</span>
                <span className={cn("block text-[10px]", quality === opt.value ? "text-orange-100" : "text-slate-400")}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
