import { Loader2 } from "lucide-react";
import { ProtectedAppImage } from "@/components/protected-app-image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { GraphicsModuleExampleImage } from "@/lib/graphics-module-examples";

type Props = {
  moduleLabel: string;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  exampleImageUrl: string | null;
  exampleImages?: GraphicsModuleExampleImage[];
  isLoading?: boolean;
};

function imagesFromProps(exampleImages: GraphicsModuleExampleImage[] | undefined, fallbackUrl: string | null) {
  if (exampleImages?.length) return exampleImages;
  if (fallbackUrl) return [{ id: 0, url: fallbackUrl }];
  return [];
}

export function GraphicsModuleExamplePreview({
  moduleLabel,
  resolvedCategory,
  usedDefaultFallback,
  exampleImageUrl,
  exampleImages,
  isLoading,
}: Props) {
  const images = imagesFromProps(exampleImages, exampleImageUrl);
  const multi = images.length > 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Studio example{multi ? "s" : ""} — {moduleLabel}
        </p>
        <p className="text-[11px] text-slate-500">
          Category: <span className="font-medium text-slate-700">{resolvedCategory}</span>
          {multi ? (
            <span className="text-slate-400"> · {images.length} images</span>
          ) : null}
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
        ) : images.length > 0 ? (
          multi ? (
            <Carousel className="w-full max-w-full" opts={{ loop: true }}>
              <CarouselContent>
                {images.map((img, idx) => (
                  <CarouselItem key={img.id || idx}>
                    <ProtectedAppImage
                      src={img.url}
                      alt={`${moduleLabel} studio example ${idx + 1}`}
                      className="w-full max-h-[320px] object-contain mx-auto"
                      loading="eager"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          ) : (
            <ProtectedAppImage
              src={images[0]!.url}
              alt={`${moduleLabel} studio example`}
              className="w-full max-h-[320px] object-contain"
              loading="eager"
            />
          )
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
