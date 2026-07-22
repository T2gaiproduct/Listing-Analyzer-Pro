import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketplaceLogos } from "@/components/marketplace-logos";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { parseHeroVideoSource } from "@/lib/hero-video-url";
import {
  heroSlideDesktopImage,
  heroSlideDesktopVideo,
  heroSlideHasDesktopImage,
  heroSlideHasMobileImage,
  heroSlideIsVideo,
  heroSlideMobileImage,
  heroSlideMobileVideo,
  heroSlideVideoPoster,
  type HeroSlide,
} from "@/lib/hero-slides";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface HeroSliderProps {
  slides: HeroSlide[];
  autoplay?: boolean;
  autoplayIntervalMs?: number;
}

function HeroSlideImage({
  imageUrl,
  className,
  objectFit = "contain",
}: {
  imageUrl: string;
  className?: string;
  objectFit?: "contain" | "cover";
}) {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  const [src, setSrc] = useState(() => resolveCmsAssetUrl(trimmed, basePath));

  useEffect(() => {
    setSrc(resolveCmsAssetUrl(trimmed, basePath));
  }, [trimmed]);

  return (
    <div
      className={cn(
        "relative w-full min-w-0 h-full",
        objectFit === "contain" && "min-h-[220px] sm:min-h-[280px] lg:min-h-[480px]",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        loading="eager"
        className={cn(
          "absolute inset-0 block h-full w-full max-w-none object-center",
          objectFit === "cover" ? "object-cover bg-slate-100" : "object-contain bg-slate-50",
        )}
      />
    </div>
  );
}

function HeroVideoEmbed({ embedUrl, className }: { embedUrl: string; className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-slate-900", className)}>
      <iframe
        key={embedUrl}
        src={embedUrl}
        title="Hero video"
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute top-1/2 left-1/2 h-auto w-auto min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 border-0 aspect-video"
      />
    </div>
  );
}

function HeroSlideVideo({ slide, className, mobile, fullBleed }: { slide: HeroSlide; className?: string; mobile?: boolean; fullBleed?: boolean }) {
  const videoUrl = mobile ? heroSlideMobileVideo(slide) : heroSlideDesktopVideo(slide);
  const posterUrl = heroSlideVideoPoster(slide);
  const source = videoUrl ? parseHeroVideoSource(videoUrl) : null;

  if (!source) return null;

  const frameClass = cn(
    "relative w-full min-w-0 bg-slate-900 overflow-hidden",
    fullBleed ? "h-full w-full" : "h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[480px]",
    className,
  );

  if (source.kind === "youtube" || source.kind === "vimeo") {
    return (
      <div className={frameClass}>
        <HeroVideoEmbed embedUrl={source.embedUrl} className="absolute inset-0" />
      </div>
    );
  }

  const src = resolveCmsAssetUrl(source.url, basePath);
  const poster = posterUrl ? resolveCmsAssetUrl(posterUrl, basePath) : undefined;
  const videoFit = fullBleed ? "object-cover" : "object-contain";

  return (
    <div className={frameClass}>
      <video
        key={src}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={cn("absolute inset-0 block h-full w-full max-w-none object-center", videoFit)}
      />
    </div>
  );
}

function HeroSlideMedia({ slide, className, mobile, fullBleed }: { slide: HeroSlide; className?: string; mobile?: boolean; fullBleed?: boolean }) {
  if (heroSlideIsVideo(slide)) {
    return <HeroSlideVideo slide={slide} className={className} mobile={mobile} fullBleed={fullBleed} />;
  }

  const imageUrl = mobile ? heroSlideMobileImage(slide) : heroSlideDesktopImage(slide);
  if (!imageUrl) return null;

  return (
    <HeroSlideImage
      imageUrl={imageUrl}
      className={className}
      objectFit={mobile || fullBleed ? "cover" : "contain"}
    />
  );
}

function HeroSlideCtas({ slide, overlay }: { slide: HeroSlide; overlay?: boolean }) {
  if (!slide.ctaPrimaryText && !slide.ctaSecondaryText) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3",
        overlay
          ? "justify-center max-w-md mx-auto sm:max-w-none"
          : "justify-center lg:justify-start max-w-md mx-auto lg:mx-0 lg:max-w-none",
      )}
    >
      {slide.ctaPrimaryText && (
        <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-6 w-full sm:w-auto sm:flex-none text-sm sm:text-base h-11 sm:h-12" asChild>
          <Link href={slide.ctaPrimaryUrl || "#"}>{slide.ctaPrimaryText}</Link>
        </Button>
      )}
      {slide.ctaSecondaryText && (
        <Button
          size="lg"
          variant={overlay ? "secondary" : "outline"}
          className={cn(
            "px-6 w-full sm:w-auto sm:flex-none gap-2 text-sm sm:text-base h-11 sm:h-12",
            overlay && "bg-white/95 hover:bg-white text-slate-900 border-0",
          )}
          asChild
        >
          <Link href={slide.ctaSecondaryUrl || "#"} className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4 shrink-0" />
            {slide.ctaSecondaryText}
          </Link>
        </Button>
      )}
    </div>
  );
}

export function HeroSlider({ slides, autoplay = true, autoplayIntervalMs = 6000 }: HeroSliderProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const multiSlide = slides.length > 1;

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || !autoplay || !multiSlide) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, autoplayIntervalMs);
    return () => window.clearInterval(timer);
  }, [api, autoplay, autoplayIntervalMs, multiSlide]);

  if (slides.length === 0) return null;

  return (
    <div className="min-w-0 w-full">
      <Carousel
        setApi={setApi}
        opts={{ loop: multiSlide, align: "start", containScroll: "keepSnaps", dragFree: false }}
        className="w-full"
      >
        <CarouselContent className="ml-0 w-full">
          {slides.map((slide) => {
            const isVideoBanner = heroSlideIsVideo(slide);

            if (isVideoBanner) {
              return (
                <CarouselItem key={slide.id} className="pl-0 basis-full min-w-0 w-full">
                  <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[2.4/1] min-h-[280px] max-h-[85vh] overflow-hidden bg-slate-900">
                    <HeroSlideMedia slide={slide} className="absolute inset-0 h-full w-full" fullBleed />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end px-4 sm:px-6 lg:px-10 xl:px-16 py-8 sm:py-10 lg:py-12">
                      <HeroSlideCtas slide={slide} overlay />
                    </div>
                  </div>
                </CarouselItem>
              );
            }

            const hasDesktopImage = heroSlideHasDesktopImage(slide);
            const hasMobileImage = heroSlideHasMobileImage(slide);

            return (
              <CarouselItem key={slide.id} className="pl-0 basis-full min-w-0 w-full">
                <div className={cn("flex w-full flex-col", hasDesktopImage && "lg:flex-row lg:min-h-[480px]")}>
                  {hasMobileImage && (
                    <div className="lg:hidden w-full aspect-[5/4] sm:aspect-[16/10] min-h-[200px] max-h-[46vh] overflow-hidden bg-slate-100 shrink-0">
                      <HeroSlideMedia slide={slide} mobile fullBleed className="h-full w-full" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex w-full flex-col justify-center px-4 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 lg:py-12 text-center lg:text-left min-w-0",
                      hasDesktopImage ? "lg:w-1/2 lg:max-w-[50%]" : "max-w-4xl mx-auto",
                    )}
                  >
                    <div className="flex justify-center lg:justify-start mb-3 sm:mb-6">
                      <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2.5 sm:px-3 py-1.5">
                        <Zap className="w-3 h-3 shrink-0" />
                        <span>{slide.badgeText}</span>
                      </p>
                    </div>
                    <h1 className="font-extrabold tracking-tight text-slate-900 mb-2.5 sm:mb-5 text-[1.65rem] leading-[1.2] sm:text-4xl lg:text-[3.25rem] sm:leading-[1.1]">
                      <span className="block sm:inline">{slide.headingLine1}</span>{" "}
                      <span className="block sm:inline text-orange-500">{slide.headingHighlight}</span>
                    </h1>
                    <p className="text-sm sm:text-lg text-slate-500 mb-4 sm:mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                      {slide.subheading}
                    </p>
                    <MarketplaceLogos className="mb-4 sm:mb-8" />
                    <HeroSlideCtas slide={slide} />
                  </div>
                  {hasDesktopImage && (
                    <div className="hidden lg:block w-full min-w-0 lg:w-1/2 lg:max-w-[50%] lg:self-stretch">
                      <HeroSlideMedia slide={slide} />
                    </div>
                  )}
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {multiSlide && (
        <div className="flex items-center justify-center gap-2 mt-5 sm:mt-10 px-4" role="tablist" aria-label="Hero slides">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === current}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                index === current ? "w-6 bg-orange-500" : "w-2 bg-slate-300 hover:bg-slate-400",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
