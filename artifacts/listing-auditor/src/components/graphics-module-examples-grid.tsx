import { useRef, useState } from "react";
import { Check, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProtectedAppImage } from "@/components/protected-app-image";
import type { GraphicsModuleExampleItem } from "@/lib/graphics-module-examples";

const MAX_EXAMPLES_HINT = 12;

const MAX_REFERENCE_IMAGES = 4;

type ViewProps = {
  mode: "view";
  examples: GraphicsModuleExampleItem[];
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  includesDefaultExamples?: boolean;
  isLoading?: boolean;
  /** Reference URLs already chosen for generation (per graphics type slug). */
  getReferenceImages?: (templateSlug: string) => string[];
  /** Toggle a studio example URL into that type's reference list. */
  onToggleStudioReference?: (templateSlug: string, imageUrl: string) => void;
};

export type AdminStudioAccent = "teal" | "orange";

type AdminProps = {
  mode: "admin";
  examples: GraphicsModuleExampleItem[];
  resolvedCategory: string;
  isLoading?: boolean;
  savingSlug?: string | null;
  adminAccent?: AdminStudioAccent;
  onUpload: (templateSlug: string, dataUrl: string) => void | Promise<void>;
  onRemoveExample: (templateSlug: string, exampleId: number) => void | Promise<void>;
  onClearAll: (templateSlug: string) => void | Promise<void>;
};

function studioAccentStyle(accent: AdminStudioAccent) {
  if (accent === "orange") {
    return {
      panel: "border-orange-200/90 bg-orange-50/50",
      label: "text-orange-800/85",
      category: "text-orange-950",
      cardHover: "hover:border-orange-300/80",
      gradient: "from-orange-950/40",
      primaryBtn: "bg-orange-600 hover:bg-orange-700",
      uploadCircle: "bg-orange-600 group-hover:bg-orange-700",
      thumbRemove: "bg-orange-900/75",
    };
  }
  return {
    panel: "border-teal-200/80 bg-teal-50/30",
    label: "text-teal-800/80",
    category: "text-teal-900",
    cardHover: "hover:border-teal-200/80",
    gradient: "from-teal-950/45",
    primaryBtn: "bg-teal-700 hover:bg-teal-800",
    uploadCircle: "bg-teal-700 group-hover:bg-teal-800",
    thumbRemove: "bg-teal-900/70",
  };
}

export type GraphicsModuleExamplesGridProps = ViewProps | AdminProps;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function exampleImagesFor(item: GraphicsModuleExampleItem) {
  if (item.exampleImages?.length) return item.exampleImages;
  if (item.exampleImageUrl) return [{ id: 0, url: item.exampleImageUrl }];
  return [];
}

export function GraphicsModuleExamplesGrid(props: GraphicsModuleExamplesGridProps) {
  const { examples, resolvedCategory, isLoading } = props;
  const withImages = examples.filter((e) => exampleImagesFor(e).length > 0);
  const showGrid = isLoading || withImages.length > 0 || props.mode === "admin";

  if (!showGrid) return null;

  const adminChrome = props.mode === "admin";
  const accent = adminChrome ? studioAccentStyle(props.adminAccent ?? "teal") : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4",
        adminChrome && accent ? accent.panel : "border-slate-200 bg-slate-50/50",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              adminChrome && accent ? accent.label : "text-slate-500",
            )}
          >
            Studio examples
          </p>
          <p className="text-sm text-slate-700">
            Category:{" "}
            <span className={cn("font-medium", adminChrome && accent && accent.category)}>{resolvedCategory}</span>
          </p>
          {props.mode === "admin" ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Upload multiple reference images per module (up to {MAX_EXAMPLES_HINT}). Sellers see them
              when customizing that graphics type.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tap an example to use it as an optional AI reference when you select that graphics type below
              (up to {MAX_REFERENCE_IMAGES} references per type, including your uploads in Customize).
            </p>
          )}
        </div>
        {props.mode === "view" && props.usedDefaultFallback ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            No examples for your product category — showing Default.
          </p>
        ) : null}
        {props.mode === "view" && props.includesDefaultExamples && !props.usedDefaultFallback ? (
          <p className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">
            Includes Default studio examples where this category has fewer uploads.
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading examples…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {examples.map((item) => (
            <ExampleCard key={item.templateSlug} item={item} {...props} />
          ))}
        </div>
      )}

      {props.mode === "view" && !isLoading && withImages.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">
          Example previews will appear here once your admin uploads them for this category.
        </p>
      ) : null}
    </div>
  );
}

function ExampleCard(
  props: { item: GraphicsModuleExampleItem } & GraphicsModuleExamplesGridProps,
) {
  const { item } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const images = exampleImagesFor(item);
  const hasImages = images.length > 0;
  const atMax = images.length >= MAX_EXAMPLES_HINT;

  const isSaving =
    props.mode === "admin" &&
    (localBusy || props.savingSlug === item.templateSlug);

  async function handleFile(file: File) {
    if (props.mode !== "admin") return;
    setLocalBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await props.onUpload(item.templateSlug, dataUrl);
    } finally {
      setLocalBusy(false);
    }
  }

  const heroUrl = images[0]?.url ?? null;
  const viewRefs =
    props.mode === "view" && props.getReferenceImages
      ? props.getReferenceImages(item.templateSlug)
      : [];
  const viewSlotsLeft = MAX_REFERENCE_IMAGES - viewRefs.length;
  const canToggleView =
    props.mode === "view" && Boolean(props.onToggleStudioReference);

  const adminCard = props.mode === "admin";
  const accent =
    props.mode === "admin" ? studioAccentStyle(props.adminAccent ?? "teal") : null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white overflow-hidden flex flex-col shadow-sm",
        adminCard && accent
          ? cn("border-slate-200 transition-colors", accent.cardHover)
          : "border-slate-200",
      )}
    >
      <div className="aspect-square relative bg-slate-100 flex items-center justify-center">
        {hasImages && props.mode === "view" && images.length > 1 ? (
          <div className="absolute inset-0 p-1.5 grid grid-cols-2 gap-1">
            {images.slice(0, 4).map((img, idx) => {
              const selected = viewRefs.includes(img.url);
              const disabled = canToggleView && !selected && viewSlotsLeft <= 0;
              return (
                <button
                  key={img.id > 0 ? img.id : `${img.url}-${idx}`}
                  type="button"
                  disabled={!canToggleView || disabled}
                  onClick={() => props.mode === "view" && props.onToggleStudioReference?.(item.templateSlug, img.url)}
                  className={cn(
                    "relative rounded-md overflow-hidden bg-white border min-h-0",
                    selected ? "border-orange-500 ring-1 ring-orange-300" : "border-slate-200",
                    canToggleView && !disabled && "hover:border-orange-400 cursor-pointer",
                    !canToggleView && "cursor-default",
                    disabled && "opacity-50",
                  )}
                  title={
                    canToggleView
                      ? selected
                        ? "Remove from references"
                        : disabled
                          ? "Max references reached"
                          : "Use as reference"
                      : undefined
                  }
                >
                  <ProtectedAppImage
                    src={img.url}
                    alt={`${item.name} example ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {selected ? (
                    <span className="absolute top-1 right-1 rounded-full bg-orange-500 text-white p-0.5">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : hasImages ? (
          <>
            {props.mode === "view" && canToggleView ? (
              <button
                type="button"
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  viewRefs.includes(heroUrl!) && "ring-2 ring-inset ring-orange-400",
                )}
                onClick={() => props.onToggleStudioReference?.(item.templateSlug, heroUrl!)}
                title={viewRefs.includes(heroUrl!) ? "Remove from references" : "Use as reference"}
              >
                <ProtectedAppImage
                  src={heroUrl!}
                  alt={`${item.name} example`}
                  className="w-full h-full object-contain"
                />
                {viewRefs.includes(heroUrl!) ? (
                  <span className="absolute top-2 right-2 rounded-full bg-orange-500 text-white p-1">
                    <Check className="w-4 h-4" />
                  </span>
                ) : null}
              </button>
            ) : (
              <ProtectedAppImage
                src={heroUrl!}
                alt={`${item.name} example`}
                className="w-full h-full object-contain"
              />
            )}
          </>
        ) : (
          <span className="text-2xl opacity-40">{item.icon ?? "🖼️"}</span>
        )}
        {props.mode === "admin" ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />
            {hasImages ? (
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 flex justify-end gap-1.5 p-2 bg-gradient-to-t to-transparent",
                  accent?.gradient ?? "from-teal-950/45",
                )}
              >
                <Button
                  type="button"
                  size="icon"
                  className={cn("h-8 w-8 text-white shadow-sm", accent?.primaryBtn)}
                  disabled={isSaving || atMax}
                  title={atMax ? `Maximum ${MAX_EXAMPLES_HINT} images` : "Add another image"}
                  aria-label="Add another image"
                  onClick={() => inputRef.current?.click()}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-white/95 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                  disabled={isSaving}
                  title="Remove all images for this module"
                  aria-label="Remove all images for this module"
                  onClick={() => void props.onClearAll(item.templateSlug)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                className="absolute inset-0 flex items-center justify-center group disabled:opacity-60"
                title="Upload image"
                aria-label="Upload image"
                onClick={() => inputRef.current?.click()}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white/80 transition group-hover:scale-105",
                    accent?.uploadCircle,
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </span>
              </button>
            )}
          </>
        ) : null}
      </div>

      {props.mode === "view" && hasImages && images.length > 4 ? (
        <div className="flex flex-wrap gap-1 p-2 border-t bg-slate-50/80 max-h-24 overflow-y-auto">
          {images.slice(4).map((img, idx) => {
            const selected = viewRefs.includes(img.url);
            const disabled = canToggleView && !selected && viewSlotsLeft <= 0;
            return (
              <button
                key={img.id > 0 ? img.id : `more-${img.url}-${idx}`}
                type="button"
                disabled={!canToggleView || disabled}
                onClick={() => props.onToggleStudioReference?.(item.templateSlug, img.url)}
                className={cn(
                  "relative w-10 h-10 rounded border overflow-hidden flex-shrink-0",
                  selected ? "border-orange-500" : "border-slate-200",
                )}
              >
                <ProtectedAppImage src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      ) : null}

      {props.mode === "admin" && hasImages ? (
        <div className="flex flex-wrap gap-1.5 p-2 border-t bg-slate-50/80">
          {images.map((img, idx) => (
            <div
              key={img.id > 0 ? img.id : `${img.url}-${idx}`}
              className="relative w-12 h-12 rounded border border-slate-200 overflow-hidden bg-white"
            >
              <ProtectedAppImage src={img.url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                className={cn(
                  "absolute top-0.5 right-0.5 rounded-md text-white p-0.5 hover:bg-rose-600 disabled:opacity-50",
                  accent?.thumbRemove,
                )}
                disabled={isSaving || img.id <= 0}
                title={img.id <= 0 ? "Refresh the page to remove" : "Remove this image"}
                aria-label="Remove this image"
                onClick={() => {
                  if (img.id > 0) void props.onRemoveExample(item.templateSlug, img.id);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="px-2 py-2 border-t">
        <p className="text-xs font-medium text-slate-800 truncate" title={item.name}>
          {item.icon ? `${item.icon} ` : ""}
          {item.name}
          {hasImages && (props.mode === "admin" || images.length > 1) ? (
            <span className="text-slate-400 font-normal"> ({images.length})</span>
          ) : null}
          {props.mode === "view" && viewRefs.length > 0 ? (
            <span className="text-orange-600 font-normal text-[10px]"> · {viewRefs.length} ref</span>
          ) : null}
        </p>
        {item.description ? (
          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
        ) : null}
      </div>
    </div>
  );
}
