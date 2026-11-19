import { Check, Expand, Plus, X } from "lucide-react";
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

        const previewable = Boolean(onPreview);
        const selectWithPreview = selectable && previewable;

        return (
          <div
            key={`${idx}-${img.slice(0, 32)}`}
            className={cn(
              "relative shrink-0 overflow-hidden bg-white",
              prominent
                ? cn(
                    "h-[5.5rem] w-[5.5rem] sm:h-28 sm:w-28 rounded-xl border-2",
                    borderAccent === "orange" ? "border-orange-500" : "border-slate-200",
                    selectable && !isSelected && !selectDisabled && "hover:border-orange-300",
                    selectDisabled && "opacity-45",
                    previewable && !selectable && "cursor-zoom-in",
                  )
                : "h-12 w-12 rounded-xl border border-slate-200 bg-slate-50",
            )}
          >
            {selectWithPreview ? (
              <button
                type="button"
                onClick={() => onPreview!(img, idx)}
                className="absolute inset-0 z-0 flex items-center justify-center"
                title="View full size"
                aria-label={`View reference ${idx + 1} full size`}
              >
                <ReferenceThumbImage src={img} alt={`Reference ${idx + 1}`} />
              </button>
            ) : selectable ? (
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
            ) : previewable ? (
              <button
                type="button"
                onClick={() => onPreview!(img, idx)}
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

            {selectWithPreview ? (
              <button
                type="button"
                disabled={selectDisabled && !isSelected}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect!(img);
                }}
                className={cn(
                  "absolute top-1 left-1 z-[2] flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors",
                  isSelected
                    ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                    : "border-slate-300 bg-white/95 text-slate-700 hover:border-orange-400 hover:text-orange-700",
                  selectDisabled && !isSelected && "opacity-40 cursor-not-allowed",
                )}
                title={isSelected ? "Remove from references" : "Add to references"}
                aria-label={isSelected ? "Deselect reference" : "Select as reference"}
              >
                {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            ) : isSelected ? (
              <span className="absolute top-0.5 left-0.5 z-[1] rounded-full bg-orange-500 text-white p-0.5 pointer-events-none">
                <Check className="h-3 w-3" />
              </span>
            ) : null}

            {selectable && isSelected && !selectWithPreview ? (
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

            {prominent && previewable && !selectWithPreview ? (
              <span className="pointer-events-none absolute bottom-1 right-1 z-[1] rounded-md bg-black/45 p-1 text-white">
                <Expand className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
