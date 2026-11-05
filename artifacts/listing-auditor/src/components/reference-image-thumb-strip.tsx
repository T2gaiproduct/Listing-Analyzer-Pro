import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProtectedAppImage } from "@/components/protected-app-image";

type Props = {
  images: string[];
  onPreview?: (url: string, index: number) => void;
  onRemove?: (index: number) => void;
  /** Match Create Graphics studio + prompt bar (larger tiles). */
  prominent?: boolean;
  /** Orange borders (selected AI refs) vs muted preview tiles. */
  accent?: "orange" | "muted";
  className?: string;
};

function ReferenceThumb({
  src,
  alt,
  prominent,
  onClick,
}: {
  src: string;
  alt: string;
  prominent?: boolean;
  onClick?: () => void;
}) {
  const inner =
    src.startsWith("data:") || src.startsWith("blob:") ? (
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    ) : (
      <ProtectedAppImage src={src} alt={alt} className="h-full w-full object-contain" />
    );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="absolute inset-0 z-0" title="View full size">
        {inner}
      </button>
    );
  }

  return <div className="absolute inset-0 z-0">{inner}</div>;
}

export function ReferenceImageThumbStrip({
  images,
  onPreview,
  onRemove,
  prominent = false,
  accent = "orange",
  className,
}: Props) {
  if (images.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {images.map((img, idx) => (
        <div
          key={`${idx}-${img.slice(0, 32)}`}
          className={cn(
            "relative shrink-0 overflow-hidden bg-white",
            prominent
              ? cn(
                  "h-14 w-14 rounded-lg border-2",
                  accent === "orange" ? "border-orange-500" : "border-slate-200",
                )
              : "h-12 w-12 rounded-xl border border-slate-200 bg-slate-50",
          )}
        >
          <ReferenceThumb
            src={img}
            alt={`Reference ${idx + 1}`}
            prominent={prominent}
            onClick={onPreview ? () => onPreview(img, idx) : undefined}
          />
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-0.5 right-0.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
              aria-label="Remove reference"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
