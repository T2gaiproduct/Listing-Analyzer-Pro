import { useRef, useState, type ReactNode } from "react";
import {
  Plus,
  X,
  Loader2,
  Paperclip,
  Check,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

function MenuRow({
  icon,
  title,
  description,
  onClick,
  selected,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        "hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none",
        selected && "bg-orange-50 hover:bg-orange-50",
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      {selected && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
    </button>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedRatio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? GRAPHICS_ASPECT_RATIOS[0];
  const selectedQuality = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === quality) ?? GRAPHICS_QUALITY_OPTIONS[0];

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
            setMenuOpen(false);
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

  const canAddMore = referenceImages.length < MAX_REFERENCE_IMAGES;

  return (
    <div className={cn("rounded-2xl border border-orange-200 bg-orange-50/30 p-4 space-y-3", className)}>
      <label className="text-base font-medium text-orange-900 block">Custom Prompt</label>

      {/* ChatGPT-style composer */}
      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        {referenceImages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {referenceImages.map((img, idx) => (
              <div
                key={`${idx}-${img.slice(0, 24)}`}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
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

        <div className="flex items-end gap-1 p-2">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  menuOpen
                    ? "bg-slate-200 text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
                aria-label="Add options"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-[min(100vw-2rem,22rem)] p-2 rounded-2xl border border-slate-200 shadow-xl bg-white"
            >
              <div className="space-y-0.5">
                <MenuRow
                  icon={<Paperclip className="w-4 h-4 text-slate-600" />}
                  title="Add photos & files"
                  description={canAddMore ? "Upload from computer" : `Limit reached (${MAX_REFERENCE_IMAGES})`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canAddMore || isUploading}
                />

                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Aspect ratio & size
                </p>
                {GRAPHICS_ASPECT_RATIOS.map((ratio) => (
                  <MenuRow
                    key={ratio.value}
                    icon={<span className="text-sm leading-none">{ratio.symbol}</span>}
                    title={`${ratio.label} (${ratio.value})`}
                    description={ratio.size}
                    onClick={() => {
                      onAspectRatioChange(ratio.value);
                      setMenuOpen(false);
                    }}
                    selected={aspectRatio === ratio.value}
                  />
                ))}

                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Quality
                </p>
                {GRAPHICS_QUALITY_OPTIONS.map((opt) => (
                  <MenuRow
                    key={opt.value}
                    icon={opt.value === "hd"
                      ? <Sparkles className="w-4 h-4 text-orange-500" />
                      : <Zap className="w-4 h-4 text-slate-500" />}
                    title={opt.label}
                    description={opt.desc}
                    onClick={() => {
                      onQualityChange(opt.value);
                      setMenuOpen(false);
                    }}
                    selected={quality === opt.value}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Describe what you want the AI to create..."
            rows={3}
            maxLength={promptMaxChars}
            className="flex-1 resize-none text-sm sm:text-base bg-transparent border-0 p-2 min-h-[4.5rem] focus:outline-none focus:ring-0 placeholder:text-slate-400"
          />
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
      </div>

      {/* Active settings summary */}
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
    </div>
  );
}
