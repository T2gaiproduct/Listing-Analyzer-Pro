import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedAppImage } from "@/components/protected-app-image";
import type { GraphicsModuleExampleItem } from "@/lib/graphics-module-examples";

type ViewProps = {
  mode: "view";
  examples: GraphicsModuleExampleItem[];
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  isLoading?: boolean;
};

type AdminProps = {
  mode: "admin";
  examples: GraphicsModuleExampleItem[];
  resolvedCategory: string;
  isLoading?: boolean;
  savingSlug?: string | null;
  onUpload: (templateSlug: string, dataUrl: string) => void | Promise<void>;
  onClear: (templateSlug: string) => void | Promise<void>;
};

export type GraphicsModuleExamplesGridProps = ViewProps | AdminProps;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function GraphicsModuleExamplesGrid(props: GraphicsModuleExamplesGridProps) {
  const { examples, resolvedCategory, isLoading } = props;
  const withImages = examples.filter((e) => e.exampleImageUrl);
  const showGrid = isLoading || withImages.length > 0 || props.mode === "admin";

  if (!showGrid) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Studio examples
          </p>
          <p className="text-sm text-slate-700">
            Category: <span className="font-medium">{resolvedCategory}</span>
          </p>
        </div>
        {props.mode === "view" && props.usedDefaultFallback ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            No examples for your product category — showing Default.
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="aspect-square relative bg-slate-100 flex items-center justify-center">
        {item.exampleImageUrl ? (
          <ProtectedAppImage
            src={item.exampleImageUrl}
            alt={`${item.name} example`}
            className="w-full h-full object-contain"
          />
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
            <div className="absolute inset-x-0 bottom-0 flex gap-1 p-2 bg-gradient-to-t from-black/50 to-transparent">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[10px] flex-1 gap-1"
                disabled={isSaving}
                onClick={() => inputRef.current?.click()}
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {item.exampleImageUrl ? "Replace" : "Upload"}
              </Button>
              {item.exampleImageUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 w-7 p-0"
                  disabled={isSaving}
                  onClick={() => void props.onClear(item.templateSlug)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="px-2 py-2 border-t">
        <p className="text-xs font-medium text-slate-800 truncate" title={item.name}>
          {item.icon ? `${item.icon} ` : ""}
          {item.name}
        </p>
        {item.description ? (
          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
        ) : null}
      </div>
    </div>
  );
}
