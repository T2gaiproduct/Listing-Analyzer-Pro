import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DEFAULT_MAX_IMAGES = 4;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_FILE_SIZE = 1024;
const MIN_WIDTH = 256;
const MIN_HEIGHT = 256;

export interface ReferenceImageUploadFieldProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  className?: string;
  label?: string;
  hint?: string;
}

export function ReferenceImageUploadField({
  images,
  onImagesChange,
  maxImages = DEFAULT_MAX_IMAGES,
  className,
  label = "Reference upload",
  hint,
}: ReferenceImageUploadFieldProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const canAddMore = images.length < maxImages;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({
        title: "Reference limit reached",
        description: `You can attach up to ${maxImages} images.`,
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
              onImagesChange([...images, ...results].slice(0, maxImages));
            }
            setIsUploading(false);
          }
        };
        img.onerror = () => {
          toast({ title: "Invalid image", description: `"${file.name}" could not be loaded.`, variant: "destructive" });
          checks++;
          if (checks === validFiles.length) {
            if (results.length > 0) {
              onImagesChange([...images, ...results].slice(0, maxImages));
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
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div
        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div
                key={`${idx}-${img.slice(0, 24)}`}
                className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white"
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
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {canAddMore ? "Upload reference images" : "Upload limit reached"}
        </Button>
        <p className="text-[11px] text-slate-400">
          {hint ?? `Optional. Up to ${maxImages} images · PNG/JPG · max 20 MB each`}
        </p>
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
  );
}
