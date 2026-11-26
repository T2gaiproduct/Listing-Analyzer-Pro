import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  BuildBrandStartDrawer,
  type BuildBrandStartEntry,
} from "@/components/build-brand-start-drawer";
import { HERO_PRIMARY_CTA_CLASS } from "@/lib/hero-primary-cta";
import { cn } from "@/lib/utils";
import { clearAuditListingWorkflowIntent } from "@/lib/audit-listing-workflow";
import { clearCreateGraphicsWorkflowIntent } from "@/lib/create-graphics-workflow";
import {
  ArrowRight,
  Upload,
  FileText,
  Image,
  Download,
  Sparkles,
} from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Upload,
    title: "Upload Product Information",
    desc: "Upload product data or click the picture",
    gradient: "from-orange-100 to-orange-50",
    iconColor: "text-orange-500",
    border: "border-b-orange-400",
  },
  {
    number: "2",
    icon: FileText,
    title: "Listing",
    desc: "AI generates compelling product titles, bullets & descriptions",
    gradient: "from-amber-100 to-amber-50",
    iconColor: "text-amber-600",
    border: "border-b-amber-400",
  },
  {
    number: "3",
    icon: Image,
    title: "Graphics",
    desc: "Create stunning product images and infographics",
    gradient: "from-orange-100 to-rose-50",
    iconColor: "text-rose-500",
    border: "border-b-rose-400",
  },
  {
    number: "4",
    icon: Sparkles,
    title: "A+ Content",
    desc: "Generate professional A+ content to boost conversions",
    gradient: "from-amber-50 to-orange-50",
    iconColor: "text-orange-600",
    border: "border-b-orange-500",
  },
  {
    number: "5",
    icon: Download,
    title: "Export",
    desc: "Export and publish your listing to your store",
    gradient: "from-orange-50 to-amber-50",
    iconColor: "text-amber-500",
    border: "border-b-amber-500",
  },
];

type BrandStep = (typeof steps)[number];

function BuildBrandStepCard({
  step,
  layout,
}: {
  step: BrandStep;
  layout: "mobile-slide" | "desktop-grid";
}) {
  const Icon = step.icon;
  const mobileSlide = layout === "mobile-slide";

  return (
    <div
      className={cn(
        "bg-card border border-border shadow-sm transition-shadow min-w-0",
        step.border,
        mobileSlide &&
          "mx-7 flex h-full min-h-[min(46dvh,22rem)] flex-col items-center justify-center text-center gap-3.5 rounded-2xl border-b-[3px] px-5 py-8",
        !mobileSlide &&
          "flex-1 flex flex-col items-center text-center gap-4 rounded-2xl p-5 border-b-4 hover:shadow-md",
      )}
    >
      <div className={cn(mobileSlide ? "self-center" : "self-start")}>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-bold",
            mobileSlide ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs",
          )}
        >
          {step.number}
        </span>
      </div>
      <div
        className={cn(
          "rounded-full bg-gradient-to-br flex items-center justify-center shadow-inner shrink-0",
          step.gradient,
          mobileSlide ? "w-[4.5rem] h-[4.5rem]" : "w-16 h-16",
        )}
      >
        <Icon className={cn(step.iconColor, mobileSlide ? "w-8 h-8" : "w-7 h-7")} />
      </div>
      <div className={cn("w-full", mobileSlide ? "max-w-[16rem]" : "flex-1")}>
        <p
          className={cn(
            "font-bold text-foreground leading-snug",
            mobileSlide ? "text-base" : "text-sm",
          )}
        >
          {step.title}
        </p>
        <p
          className={cn(
            "mt-1.5 leading-relaxed text-muted-foreground",
            mobileSlide ? "text-sm" : "text-[11px] leading-snug",
            !mobileSlide && "mt-1.5 leading-relaxed text-foreground",
          )}
        >
          {step.desc}
        </p>
      </div>
    </div>
  );
}

function BuildBrandStepsMobileCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
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

  return (
    <div className="sm:hidden relative flex flex-1 flex-col min-h-0">
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: false, dragFree: false }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        <CarouselContent className="-ml-0 h-full">
          {steps.map((step) => (
            <CarouselItem key={step.number} className="pl-0 basis-full h-full">
              <BuildBrandStepCard step={step} layout="mobile-slide" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          variant="outline"
          className="left-0 top-1/2 -translate-y-1/2 h-8 w-8 border-orange-200 bg-background/95 shadow-sm text-orange-700"
        />
        <CarouselNext
          variant="outline"
          className="right-0 top-1/2 -translate-y-1/2 h-8 w-8 border-orange-200 bg-background/95 shadow-sm text-orange-700"
        />
      </Carousel>
      <div className="flex items-center justify-center gap-1.5 mt-3 shrink-0" role="tablist" aria-label="How it works steps">
        {steps.map((step, index) => (
          <button
            key={step.number}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Step ${step.number}: ${step.title}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              index === activeIndex ? "w-5 bg-orange-500" : "w-1.5 bg-orange-200 hover:bg-orange-300",
            )}
            onClick={() => api?.scrollTo(index)}
          />
        ))}
      </div>
      <p className="text-center text-[10px] text-muted-foreground/80 mt-1.5 tabular-nums shrink-0">
        {activeIndex + 1}/{steps.length}
      </p>
    </div>
  );
}

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const [startDrawerOpen, setStartDrawerOpen] = useState(false);

  function handleStartChoice(entry: BuildBrandStartEntry) {
    setStartDrawerOpen(false);
    if (entry === "import-link") {
      setLocation("/audits/import-from-link");
      return;
    }
    clearAuditListingWorkflowIntent();
    clearCreateGraphicsWorkflowIntent();
    setLocation(`/audits/workflow?entry=${entry}`);
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col max-sm:min-h-[calc(100dvh-6.75rem)] sm:min-h-full">
      {/* Hero */}
      <div className="text-center pt-5 pb-4 px-4 sm:pt-12 sm:pb-10 sm:px-6 relative overflow-hidden bg-card border-b border-border max-sm:shrink-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, rgba(251,191,100,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 5%, rgba(255,237,213,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative">
        <h1 className="text-[1.55rem] sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          Build Your Brand Content
        </h1>
        <h2 className="text-[1.55rem] sm:text-5xl font-extrabold tracking-tight leading-tight mt-0.5 sm:mt-1">
          <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
            Using AI
          </span>{" "}
          <Sparkles className="inline w-6 h-6 sm:w-8 sm:h-8 text-orange-400 align-middle -mt-0.5 sm:-mt-1" />
        </h2>
        <p className="text-xs text-muted-foreground sm:text-foreground mt-2.5 sm:mt-4 max-w-md mx-auto leading-relaxed px-1">
          Turn product information into high-converting listings in minutes.
        </p>

        <Button
          size="lg"
          className={cn(
            "mt-4 sm:mt-7 w-full max-w-sm mx-auto sm:w-auto sm:max-w-none max-sm:min-w-0 max-sm:py-3.5 max-sm:px-6",
            HERO_PRIMARY_CTA_CLASS,
          )}
          onClick={() => setStartDrawerOpen(true)}
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
          Start Generating
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 shrink-0" />
        </Button>
        <BuildBrandStartDrawer
          open={startDrawerOpen}
          onOpenChange={setStartDrawerOpen}
          onChoose={handleStartChoice}
        />
        </div>
      </div>

      {/* How It Works */}
      <div className="flex flex-1 flex-col min-h-0 pb-4 sm:pb-10 w-full min-w-0 px-4 sm:px-6 max-w-6xl mx-auto max-sm:pt-3">
        {/* Section header */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-8 max-sm:shrink-0">
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-orange-300 text-sm sm:text-base">✦</span>
            <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-orange-300" />
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-orange-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
            How It Works
          </span>
          <div className="hidden sm:flex items-center gap-1">
            <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-orange-300" />
            <span className="text-orange-300 text-sm sm:text-base">✦</span>
          </div>
        </div>

        <BuildBrandStepsMobileCarousel />

        {/* Step cards — tablet/desktop grid */}
        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-0 relative">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex items-stretch min-w-0">
              <BuildBrandStepCard step={step} layout="desktop-grid" />

              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-16 -right-4 z-10 items-center justify-center w-8">
                  <svg
                    width="32"
                    height="16"
                    viewBox="0 0 32 16"
                    fill="none"
                    className="text-orange-300"
                  >
                    <path
                      d="M0 8 Q8 8 16 8 Q24 8 28 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                    />
                    <polyline
                      points="25,4 30,8 25,12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
