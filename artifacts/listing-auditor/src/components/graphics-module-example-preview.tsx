import { Loader2 } from "lucide-react";
import { ProtectedAppImage } from "@/components/protected-app-image";

type Props = {
  moduleLabel: string;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  exampleImageUrl: string | null;
  isLoading?: boolean;
};

export function GraphicsModuleExamplePreview({
  moduleLabel,
  resolvedCategory,
  usedDefaultFallback,
  exampleImageUrl,
  isLoading,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Studio example — {moduleLabel}
        </p>
        <p className="text-[11px] text-slate-500">
          Category: <span className="font-medium text-slate-700">{resolvedCategory}</span>
        </p>
      </div>
      {usedDefaultFallback ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
          No example for your product category — showing Default.
        </p>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden min-h-[200px] sm:min-h-[240px] flex items-center justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading example…
          </div>
        ) : exampleImageUrl ? (
          <ProtectedAppImage
            src={exampleImageUrl}
            alt={`${moduleLabel} studio example`}
            className="w-full max-h-[320px] object-contain"
            loading="eager"
          />
        ) : (
          <p className="text-xs text-slate-400 text-center px-6 py-12">
            No studio example uploaded yet for this module. Your workspace admin can add one in Image
            generation prompts.
          </p>
        )}
      </div>
    </div>
  );
}
