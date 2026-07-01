import { useState } from "react";
import { Sparkles, ChevronRight, ChevronLeft, Monitor, Sun, BookOpen, Lightbulb, Megaphone, ImagePlus, Cpu, Pencil, Download, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const videoTypes = [
  {
    id: "product-showcase",
    label: "Product Showcase",
    description: "Highlight key features and benefits of your product",
    icon: Monitor,
    thumbnailBg: "from-slate-700 via-slate-800 to-slate-900",
    overlayText: null,
    accentColor: "before:from-slate-900/60",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    description: "Show your product in real-life scenarios",
    icon: Sun,
    thumbnailBg: "from-amber-400 via-orange-400 to-rose-400",
    overlayText: "MY SECRET\nRETREAT",
    accentColor: "before:from-amber-900/60",
  },
  {
    id: "explainer",
    label: "Explainer",
    description: "Explain how your product works and why it's useful",
    icon: BookOpen,
    thumbnailBg: "from-indigo-500 via-purple-600 to-indigo-900",
    overlayText: "FINALLY,\nCONCENTRATION",
    accentColor: "before:from-indigo-900/60",
  },
  {
    id: "brand-story",
    label: "Brand Story",
    description: "Build your brand with engaging storytelling videos",
    icon: Lightbulb,
    thumbnailBg: "from-emerald-400 via-teal-500 to-cyan-700",
    overlayText: "BRIGHT NIGHTS,\nECO LIGHTS",
    accentColor: "before:from-emerald-900/60",
  },
  {
    id: "promo-ad",
    label: "Promo / Ad",
    description: "Create high-converting promo videos for ads",
    icon: Megaphone,
    thumbnailBg: "from-orange-500 via-red-500 to-rose-700",
    overlayText: "ELEVATE\nEVERY COOK",
    accentColor: "before:from-rose-900/60",
  },
];

const howItWorks = [
  {
    step: 1,
    icon: ImagePlus,
    title: "Add Product",
    description: "Upload product images and provide basic information",
  },
  {
    step: 2,
    icon: Cpu,
    title: "AI Generates",
    description: "Our AI analyzes and creates a professional video",
  },
  {
    step: 3,
    icon: Pencil,
    title: "Customize",
    description: "Edit text, scenes, music and personalize your video",
  },
  {
    step: 4,
    icon: Download,
    title: "Download & Use",
    description: "Download your video and use it across Amazon and socials",
  },
];

export default function VideosPage() {
  const { toast } = useToast();
  const [carouselOffset, setCarouselOffset] = useState(0);
  const visibleCards = 4;
  const maxOffset = videoTypes.length - visibleCards;

  function handleCreate() {
    toast({
      title: "Coming Soon",
      description: "AI video generation is launching soon. Stay tuned!",
    });
  }

  function slideLeft() {
    setCarouselOffset((o) => Math.max(0, o - 1));
  }

  function slideRight() {
    setCarouselOffset((o) => Math.min(maxOffset, o + 1));
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 px-8 py-14 flex flex-col items-center text-center">
        {/* Sparkle decorations */}
        <Sparkle className="absolute top-6 left-[12%] w-7 h-7 text-orange-200/80" />
        <Sparkle className="absolute top-10 right-[18%] w-5 h-5 text-orange-300/70" />
        <Sparkle className="absolute bottom-8 left-[30%] w-4 h-4 text-orange-200/60" />
        <Sparkle className="absolute bottom-6 right-[10%] w-6 h-6 text-orange-300/50" />
        <Sparkle className="absolute top-1/2 left-[5%] w-3 h-3 text-orange-200/40" />

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
          Amazon{" "}
          <span className="text-primary">AI Video Generator</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mb-8 leading-relaxed">
          Create professional Amazon product videos with AI. Turn product images into
          engaging video ads, explainer videos, and promotional content
          without any editing experience.
        </p>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-7 py-3 rounded-full shadow-md transition-all text-sm"
        >
          <Sparkles className="w-4 h-4" />
          Create Amazon Videos For Free
        </button>
      </div>

      {/* ── Choose Video Type ── */}
      <div className="bg-white px-8 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1">Choose Video Type</h2>
          <p className="text-sm text-muted-foreground">Select a video style that best fits your product and marketing goal</p>
        </div>

        <div className="relative">
          {/* Left arrow */}
          {carouselOffset > 0 && (
            <button
              onClick={slideLeft}
              className="absolute -left-4 top-[45%] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-border flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          )}

          {/* Cards container */}
          <div className="overflow-hidden">
            <div
              className="flex gap-4 transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(calc(-${carouselOffset} * (100% / ${visibleCards} + 4px)))` }}
            >
              {videoTypes.map(({ id, label, description, icon: Icon, thumbnailBg, overlayText }) => (
                <div
                  key={id}
                  className="flex-shrink-0 rounded-xl border border-border overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                  style={{ width: `calc(${100 / visibleCards}% - ${(visibleCards - 1) * 16 / visibleCards}px)` }}
                >
                  {/* Thumbnail */}
                  <div className={`relative h-40 bg-gradient-to-br ${thumbnailBg} flex items-center justify-center`}>
                    {/* Play circle overlay for product showcase */}
                    {!overlayText && (
                      <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-1" />
                      </div>
                    )}
                    {overlayText && (
                      <p className="text-white font-black text-center text-sm leading-snug px-3 drop-shadow-lg uppercase tracking-wide">
                        {overlayText.split("\n").map((line, i) => (
                          <span key={i} className="block">{line}</span>
                        ))}
                      </p>
                    )}
                    {/* Bottom fade */}
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{description}</p>
                    <button
                      onClick={handleCreate}
                      className="w-full text-xs font-medium border border-border rounded-lg py-1.5 text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Create Video
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right arrow */}
          {carouselOffset < maxOffset && (
            <button
              onClick={slideRight}
              className="absolute -right-4 top-[45%] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-border flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="bg-white px-8 py-10 border-t border-border">
        <h2 className="text-xl font-bold text-foreground mb-8">How It Works</h2>

        <div className="grid grid-cols-4 gap-0 relative">
          {howItWorks.map(({ step, icon: Icon, title, description }, idx) => (
            <div key={step} className="flex flex-col items-start relative">
              {/* Arrow connector */}
              {idx < howItWorks.length - 1 && (
                <ArrowRight className="absolute right-0 top-5 -translate-y-1/2 w-5 h-5 text-primary/40 z-10" />
              )}

              {/* Icon circle */}
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>

              {/* Step + title */}
              <p className="text-sm font-bold text-foreground mb-1">
                {step}. {title}
              </p>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed pr-6">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom breathing room */}
      <div className="flex-1 bg-white" />
    </div>
  );
}

/* Inline sparkle SVG shape — 4-pointed star */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
    </svg>
  );
}
