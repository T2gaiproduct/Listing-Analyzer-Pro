import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  heroSlideHasDesktopMedia,
  heroSlideHasMobileMedia,
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
  fillContainer = false,
}: {
  imageUrl: string;
  className?: string;
  objectFit?: "contain" | "cover";
  fillContainer?: boolean;
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
        "w-full min-w-0",
        fillContainer ? "absolute inset-0 h-full" : "relative h-full",
        objectFit === "contain" && !fillContainer && "min-h-[220px] sm:min-h-[280px] lg:min-h-[540px]",
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

function HeroVideoEmbed({
  embedUrl,
  fit = "cover",
  className,
}: {
  embedUrl: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  if (fit === "contain") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-slate-50 p-3 sm:p-4", className)}>
        <div className="relative w-full aspect-video max-h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 bg-slate-900">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="Hero video"
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

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

  const fit = fullBleed ? "cover" : "contain";

  const frameClass = cn(
    "relative w-full min-w-0",
    fullBleed
      ? "h-full w-full overflow-hidden bg-slate-900"
      : "flex h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[540px] items-center justify-center bg-slate-50 p-3 sm:p-4",
    className,
  );

  if (source.kind === "youtube" || source.kind === "vimeo") {
    return (
      <div className={frameClass}>
        <HeroVideoEmbed embedUrl={source.embedUrl} fit={fit} className={fullBleed ? "absolute inset-0" : "h-full w-full"} />
      </div>
    );
  }

  const src = resolveCmsAssetUrl(source.url, basePath);
  const poster = posterUrl ? resolveCmsAssetUrl(posterUrl, basePath) : undefined;

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
        className={cn(
          fullBleed
            ? "absolute inset-0 block h-full w-full max-w-none object-cover object-center"
            : "block w-full h-auto max-h-full object-contain object-center rounded-2xl",
        )}
      />
    </div>
  );
}

function HeroSlideMedia({
  slide,
  className,
  mobile,
  fullBleed,
}: {
  slide: HeroSlide;
  className?: string;
  mobile?: boolean;
  fullBleed?: boolean;
}) {
  if (heroSlideIsVideo(slide)) {
    const mobileImage = mobile ? heroSlideMobileImage(slide) : "";
    if (mobile && mobileImage && !heroSlideMobileVideo(slide)) {
      return (
        <HeroSlideImage
          imageUrl={mobileImage}
          className={className}
          objectFit="cover"
          fillContainer={fullBleed}
        />
      );
    }
    return <HeroSlideVideo slide={slide} className={className} mobile={mobile} fullBleed={fullBleed} />;
  }

  const imageUrl = mobile ? heroSlideMobileImage(slide) : heroSlideDesktopImage(slide);
  if (!imageUrl) return null;

  const useCover = Boolean(mobile || fullBleed);

  return (
    <HeroSlideImage
      imageUrl={imageUrl}
      className={className}
      objectFit={useCover ? "cover" : "contain"}
      fillContainer={useCover}
    />
  );
}

function HeroSlideCtas({
  slide,
  overlay,
  mobileOverlay,
}: {
  slide: HeroSlide;
  overlay?: boolean;
  mobileOverlay?: boolean;
}) {
  if (!slide.ctaPrimaryText && !slide.ctaSecondaryText) return null;

  return (
    <div
      className={cn(
        "flex flex-row items-stretch gap-2 sm:gap-3 w-full",
        mobileOverlay
          ? "max-w-sm mx-auto"
          : "justify-center max-w-lg mx-auto lg:justify-start lg:mx-0 lg:max-w-none",
      )}
    >
      {slide.ctaPrimaryText && (
        <Button
          size={mobileOverlay ? "default" : "lg"}
          className={cn(
            "bg-orange-500 hover:bg-orange-600 text-white flex-1 min-w-0 px-3 sm:px-6",
            mobileOverlay ? "h-10 text-xs sm:text-sm font-semibold shadow-sm" : "text-xs sm:text-base h-11 sm:h-12",
          )}
          asChild
        >
          <Link href={slide.ctaPrimaryUrl || "#"} className="truncate">{slide.ctaPrimaryText}</Link>
        </Button>
      )}
      {slide.ctaSecondaryText && (
        <Button
          size={mobileOverlay ? "default" : "lg"}
          variant={overlay ? "secondary" : "outline"}
          className={cn(
            "flex-1 min-w-0 px-3 sm:px-6 gap-1.5 sm:gap-2",
            mobileOverlay
              ? "h-10 text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/25"
              : "text-xs sm:text-base h-11 sm:h-12",
            overlay && !mobileOverlay && "bg-white/95 hover:bg-white text-slate-900 border-0",
          )}
          asChild
        >
          <Link href={slide.ctaSecondaryUrl || "#"} className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{slide.ctaSecondaryText}</span>
          </Link>
        </Button>
      )}
    </div>
  );
}

function HeroSlideCopy({
  slide,
  overlay,
  mobileOverlay,
}: {
  slide: HeroSlide;
  overlay?: boolean;
  mobileOverlay?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "flex",
          mobileOverlay ? "mb-2.5 justify-center" : "mb-3 sm:mb-6",
          !mobileOverlay && (overlay ? "justify-center" : "justify-center lg:justify-start"),
        )}
      >
        <p
          className={cn(
            "inline-flex items-center gap-1.5 font-bold uppercase rounded-full",
            mobileOverlay
              ? "text-[9px] tracking-[0.14em] px-2.5 py-1 text-orange-300 bg-orange-500/15 border border-orange-400/30"
              : "text-[10px] sm:text-[11px] tracking-wider sm:tracking-widest px-2.5 sm:px-3 py-1.5",
            !mobileOverlay && overlay
              ? "text-orange-200 bg-white/10 border border-white/20"
              : !mobileOverlay && "text-orange-600 bg-orange-50 border border-orange-100",
          )}
        >
          <Zap className={cn("shrink-0", mobileOverlay ? "w-2.5 h-2.5" : "w-3 h-3")} />
          <span>{slide.badgeText}</span>
        </p>
      </div>
      <h1
        className={cn(
          "font-extrabold tracking-tight",
          mobileOverlay
            ? "mb-2 text-[1.375rem] leading-[1.22] text-white"
            : "mb-2.5 sm:mb-5 text-[1.65rem] leading-[1.2] sm:text-4xl lg:text-[3.25rem] sm:leading-[1.1]",
          !mobileOverlay && (overlay ? "text-white" : "text-slate-900"),
        )}
      >
        <span className={mobileOverlay ? "block" : "block sm:inline"}>{slide.headingLine1}</span>{" "}
        <span
          className={cn(
            mobileOverlay ? "block text-orange-400" : "block sm:inline",
            !mobileOverlay && (overlay ? "text-orange-300" : "text-orange-500"),
          )}
        >
          {slide.headingHighlight}
        </span>
      </h1>
      <p
        className={cn(
          "leading-relaxed",
          mobileOverlay
            ? "text-[13px] text-slate-300 mb-3.5 mx-auto line-clamp-2 max-w-[20rem]"
            : "text-sm sm:text-lg mb-4 sm:mb-6 max-w-xl",
          !mobileOverlay && overlay
            ? "text-white/85 mx-auto line-clamp-3"
            : !mobileOverlay && "text-slate-500 mx-auto lg:mx-0",
        )}
      >
        {slide.subheading}
      </p>
      {!overlay && <MarketplaceLogos className="mb-3 sm:mb-8" />}
      <HeroSlideCtas slide={slide} overlay={overlay} mobileOverlay={mobileOverlay} />
    </>
  );
}

function HeroMobileOverlaySlide({
  slide,
  media,
}: {
  slide: HeroSlide;
  media: ReactNode;
}) {
  return (
    <div className="lg:hidden w-full shrink-0 overflow-hidden bg-slate-950">
      <div className="relative w-full aspect-[5/4] min-h-[200px] max-h-[min(38vh,320px)] overflow-hidden bg-slate-100">
        <div className="absolute inset-0">{media}</div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
      </div>
      <div className="px-4 pt-4 pb-5 sm:px-6 text-center">
        <HeroSlideCopy slide={slide} overlay mobileOverlay />
      </div>
    </div>
  );
}

export function HeroSlider({ slides, autoplay = true, autoplayIntervalMs = 6000 }: HeroSliderProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(undefined);
  const slideMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const multiSlide = slides.length > 1;

  const measureActiveSlide = useCallback(() => {
    const el = slideMeasureRefs.current[current];
    if (el) setViewportHeight(el.offsetHeight);
  }, [current]);

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
    measureActiveSlide();
    const observer = new ResizeObserver(measureActiveSlide);
    slideMeasureRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    window.addEventListener("resize", measureActiveSlide);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureActiveSlide);
    };
  }, [measureActiveSlide, slides.length]);

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
      <div
        className={cn(
          "overflow-hidden",
          multiSlide && viewportHeight !== undefined && "transition-[height] duration-200 ease-out",
        )}
        style={multiSlide && viewportHeight !== undefined ? { height: viewportHeight } : undefined}
      >
        <Carousel
          setApi={setApi}
          opts={{ loop: multiSlide, align: "start", containScroll: "keepSnaps", dragFree: false }}
          className="w-full"
        >
          <CarouselContent className="ml-0 w-full items-start">
            {slides.map((slide, slideIndex) => {
              const hasDesktopMedia = heroSlideHasDesktopMedia(slide);
              const hasMobileMedia = heroSlideHasMobileMedia(slide);

              /* Full-bleed video banner disabled — video plays in the right panel only (see hasDesktopMedia layout). */
              // const isVideoBanner = heroSlideIsVideo(slide);
              // if (isVideoBanner) { ... full-screen video ... }

              return (
                <CarouselItem key={slide.id} className="pl-0 basis-full min-w-0 w-full">
                  <div
                    ref={(el) => {
                      slideMeasureRefs.current[slideIndex] = el;
                    }}
                    className={cn("flex w-full flex-col lg:items-stretch", hasDesktopMedia && "lg:flex-row")}
                  >
                    {hasMobileMedia ? (
                      <HeroMobileOverlaySlide
                        slide={slide}
                        media={<HeroSlideMedia slide={slide} mobile fullBleed className="h-full w-full" />}
                      />
                    ) : (
                      <div className="lg:hidden px-4 sm:px-6 pt-4 pb-0 text-center">
                        <HeroSlideCopy slide={slide} />
                      </div>
                    )}
                  <div
                    className={cn(
                      "hidden lg:flex w-full flex-col justify-center px-4 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 lg:py-12 text-center lg:text-left min-w-0",
                      hasDesktopMedia ? "lg:w-1/2 lg:max-w-[50%]" : "max-w-4xl mx-auto",
                    )}
                  >
                    <HeroSlideCopy slide={slide} />
                  </div>
                  {hasDesktopMedia && (
                    <div className="hidden lg:flex w-full min-w-0 lg:w-1/2 lg:max-w-[50%] items-center py-4 lg:py-6 pr-4 sm:pr-6 lg:pr-8 xl:pr-10">
                      <div className="w-full min-h-[520px] lg:min-h-[540px] rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden bg-slate-50">
                        <HeroSlideMedia slide={slide} className="h-full w-full" />
                      </div>
                    </div>
                  )}
                </div>
              </CarouselItem>
            );
            })}
          </CarouselContent>
        </Carousel>
      </div>

      {multiSlide && (
        <div className="flex items-center justify-center gap-2 mt-4 sm:mt-10 px-4" role="tablist" aria-label="Hero slides">
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
