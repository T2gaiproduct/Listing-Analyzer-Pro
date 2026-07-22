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
import {
  DEFAULT_HERO_SLIDE_IMAGE,
  heroSlideDesktopImage,
  heroSlideDesktopVideo,
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

function HeroSlideImage({ imageUrl, className }: { imageUrl: string; className?: string }) {
  const fallbackSrc = resolveCmsAssetUrl(DEFAULT_HERO_SLIDE_IMAGE, basePath);
  const [src, setSrc] = useState(() =>
    resolveCmsAssetUrl(imageUrl || DEFAULT_HERO_SLIDE_IMAGE, basePath),
  );

  useEffect(() => {
    setSrc(resolveCmsAssetUrl(imageUrl || DEFAULT_HERO_SLIDE_IMAGE, basePath));
  }, [imageUrl]);

  return (
    <div className={cn("relative w-full min-w-0 h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[480px]", className)}>
      <img
        src={src}
        alt=""
        loading="eager"
        onError={() => {
          if (src !== fallbackSrc) setSrc(fallbackSrc);
        }}
        className="absolute inset-0 block h-full w-full max-w-none object-cover object-center bg-slate-50"
      />
    </div>
  );
}

function HeroSlideVideo({ slide, className, mobile }: { slide: HeroSlide; className?: string; mobile?: boolean }) {
  const videoUrl = mobile ? heroSlideMobileVideo(slide) : heroSlideDesktopVideo(slide);
  const posterUrl = resolveCmsAssetUrl(heroSlideVideoPoster(slide), basePath);
  const src = resolveCmsAssetUrl(videoUrl, basePath);

  if (!videoUrl) {
    return <HeroSlideImage imageUrl={mobile ? heroSlideMobileImage(slide) : heroSlideDesktopImage(slide)} className={className} />;
  }

  return (
    <div className={cn("relative w-full min-w-0 h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[480px] bg-slate-900", className)}>
      <video
        key={src}
        src={src}
        poster={posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 block h-full w-full max-w-none object-cover object-center"
      />
    </div>
  );
}

function HeroSlideMedia({ slide, className, mobile }: { slide: HeroSlide; className?: string; mobile?: boolean }) {
  if (heroSlideIsVideo(slide)) {
    return <HeroSlideVideo slide={slide} className={className} mobile={mobile} />;
  }
  return (
    <HeroSlideImage
      imageUrl={mobile ? heroSlideMobileImage(slide) : heroSlideDesktopImage(slide)}
      className={className}
    />
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
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0 basis-full min-w-0 w-full">
              <div className="flex w-full flex-col lg:flex-row lg:min-h-[480px]">
                <div className="flex w-full flex-col justify-center px-4 sm:px-6 lg:px-10 xl:px-16 py-8 sm:py-10 lg:py-12 text-center lg:text-left lg:w-1/2 lg:max-w-[50%] min-w-0">
                  <div className="flex justify-center lg:justify-start mb-4 sm:mb-6">
                    <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2.5 sm:px-3 py-1.5">
                      <Zap className="w-3 h-3 shrink-0" />
                      <span>{slide.badgeText}</span>
                    </p>
                  </div>
                  <h1 className="font-extrabold tracking-tight text-slate-900 mb-3 sm:mb-5 text-[1.75rem] leading-[1.2] sm:text-4xl lg:text-[3.25rem] sm:leading-[1.1]">
                    <span className="block sm:inline">{slide.headingLine1}</span>{" "}
                    <span className="block sm:inline text-orange-500">{slide.headingHighlight}</span>
                  </h1>
                  <p className="text-sm sm:text-lg text-slate-500 mb-5 sm:mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    {slide.subheading}
                  </p>
                  <MarketplaceLogos className="mb-6 sm:mb-8" />
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3 justify-center lg:justify-start max-w-md mx-auto lg:mx-0 lg:max-w-none">
                    {slide.ctaPrimaryText && (
                      <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-6 w-full sm:w-auto sm:flex-none text-sm sm:text-base h-11 sm:h-12" asChild>
                        <Link href={slide.ctaPrimaryUrl || "#"}>{slide.ctaPrimaryText}</Link>
                      </Button>
                    )}
                    {slide.ctaSecondaryText && (
                      <Button size="lg" variant="outline" className="px-6 w-full sm:w-auto sm:flex-none gap-2 text-sm sm:text-base h-11 sm:h-12" asChild>
                        <Link href={slide.ctaSecondaryUrl || "#"} className="flex items-center justify-center gap-2">
                          <Play className="w-4 h-4 shrink-0" />
                          {slide.ctaSecondaryText}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-full min-w-0 lg:w-1/2 lg:max-w-[50%] lg:self-stretch">
                  <HeroSlideMedia slide={slide} className="lg:hidden" mobile />
                  <HeroSlideMedia slide={slide} className="hidden lg:block" />
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {multiSlide && (
        <div className="flex items-center justify-center gap-2 mt-8 sm:mt-10 px-4" role="tablist" aria-label="Hero slides">
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
