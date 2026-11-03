import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useReferenceImageUpload } from "@/components/use-reference-image-upload";

const DEFAULT_MAX_IMAGES = 4;

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
  const {
    fileInputRef,
    handleFiles,
    isUploading,
    canAddMore,
    openFilePicker,
    removeImage,
  } = useReferenceImageUpload(images, onImagesChange, maxImages);

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
          onClick={openFilePicker}
        >
          {isUploading ? (
            <span className="inline-flex items-center gap-2">
              <Upload className="w-4 h-4 animate-pulse" />
              Uploading…
            </span>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {canAddMore ? "Upload reference images" : "Upload limit reached"}
            </>
          )}
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
