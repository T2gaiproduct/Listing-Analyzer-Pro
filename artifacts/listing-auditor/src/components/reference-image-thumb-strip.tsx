import { Check, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProtectedAppImage } from "@/components/protected-app-image";

type Props = {
  images: string[];
  onPreview?: (url: string, index: number) => void;
  /** Remove by index (prompt bar uploads + studio refs). */
  onRemove?: (index: number) => void;
  /** Tap tile to select/deselect (studio examples in customize). */
  onToggleSelect?: (url: string) => void;
  /** URLs currently in the AI reference list. */
  selectedUrls?: string[];
  /** Match Create Graphics studio + prompt bar (larger tiles). */
  prominent?: boolean;
  /** Orange borders (selected AI refs) vs muted preview tiles. */
  accent?: "orange" | "muted";
  /** When true, unselected tiles cannot be added (4 refs already chosen). */
  selectionCapReached?: boolean;
  className?: string;
};

function ReferenceThumbImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return <img src={src} alt={alt} className="h-full w-full object-contain pointer-events-none" />;
  }
  return (
    <ProtectedAppImage src={src} alt={alt} className="h-full w-full object-contain pointer-events-none" />
  );
}

export function ReferenceImageThumbStrip({
  images,
  onPreview,
  onRemove,
  onToggleSelect,
  selectedUrls = [],
  prominent = false,
  accent = "orange",
  selectionCapReached = false,
  className,
}: Props) {
  if (images.length === 0) return null;

  const selectedSet = new Set(selectedUrls);
  const selectable = Boolean(onToggleSelect);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {images.map((img, idx) => {
        const isSelected = selectedSet.has(img);
        const selectDisabled = selectable && !isSelected && selectionCapReached;
        const borderAccent =
          selectable || accent === "orange"
            ? isSelected
              ? "orange"
              : "muted"
            : accent;

        return (
          <div
            key={`${idx}-${img.slice(0, 32)}`}
            className={cn(
              "relative shrink-0 overflow-hidden bg-white",
              prominent
                ? cn(
                    "h-14 w-14 rounded-lg border-2",
                    borderAccent === "orange" ? "border-orange-500" : "border-slate-200",
                    selectable && !isSelected && !selectDisabled && "hover:border-orange-300",
                    selectDisabled && "opacity-45",
                  )
                : "h-12 w-12 rounded-xl border border-slate-200 bg-slate-50",
            )}
          >
            {selectable ? (
              <button
                type="button"
                disabled={selectDisabled}
                onClick={() => onToggleSelect!(img)}
                className="absolute inset-0 z-0 flex items-center justify-center disabled:cursor-not-allowed"
                title={
                  isSelected
                    ? "Deselect reference"
                    : selectDisabled
                      ? "Maximum references reached"
                      : "Select as reference"
                }
                aria-label={isSelected ? "Deselect reference" : "Select as reference"}
              >
                <ReferenceThumbImage src={img} alt={`Reference ${idx + 1}`} />
              </button>
            ) : onPreview ? (
              <button
                type="button"
                onClick={() => onPreview(img, idx)}
                className="absolute inset-0 z-0"
                title="View full size"
              >
                <ReferenceThumbImage src={img} alt={`Reference ${idx + 1}`} />
              </button>
            ) : (
              <div className="absolute inset-0 z-0">
                <ReferenceThumbImage src={img} alt={`Reference ${idx + 1}`} />
              </div>
            )}

            {isSelected ? (
              <span className="absolute top-0.5 left-0.5 z-[1] rounded-full bg-orange-500 text-white p-0.5 pointer-events-none">
                <Check className="h-3 w-3" />
              </span>
            ) : null}

            {selectable && isSelected ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect!(img);
                }}
                className="absolute top-0.5 right-0.5 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-red-600"
                aria-label="Deselect reference"
                title="Deselect"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {!selectable && onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute top-0.5 right-0.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
                aria-label="Remove reference"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {(selectable ? onPreview : false) && onPreview ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(img, idx);
                }}
                className="absolute bottom-0.5 right-0.5 z-[2] flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white hover:bg-black/75"
                aria-label="View full size"
                title="View full size"
              >
                <Expand className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
