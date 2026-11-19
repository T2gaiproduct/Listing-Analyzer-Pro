import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { UPLOAD_TAB_FIELD_CLASS } from "@/components/build-brand-upload-attributes-section";

type BrandLogoUploadProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  onInvalidFile?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

const MAX_BYTES = 20 * 1024 * 1024;

export function BrandLogoUpload({
  value,
  onChange,
  onInvalidFile,
  disabled,
  className,
}: BrandLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onInvalidFile?.("Please upload an image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      onInvalidFile?.("Logo file exceeds 20 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onChange(result);
    };
    reader.onerror = () => onInvalidFile?.("Could not read the logo file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-foreground">Brand logo (optional)</label>
      <p className="text-[11px] text-muted-foreground">
        Used as a visual reference when generating product gallery and A+ images.
      </p>
      <div
        className={cn(
          UPLOAD_TAB_FIELD_CLASS,
          "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 sm:p-4 bg-muted/30",
        )}
      >
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-background overflow-hidden">
          {value ? (
            <img src={value} alt="Brand logo preview" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          )}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {value ? "Replace logo" : "Upload brand logo"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}