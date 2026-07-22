import { useState, useRef, useLayoutEffect } from "react";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCardMockup } from "@/components/feature-card-mockups";
import { cn } from "@/lib/utils";

export type FeatureItem = {
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  bullets: string[];
  image: string;
};

function FeaturePreview({ feature }: { feature: FeatureItem }) {
  if (feature.image) {
    return (
      <img
        src={feature.image}
        alt={`${feature.title} preview`}
        className="w-full max-h-40 sm:max-h-44 object-contain rounded-xl"
        loading="lazy"
      />
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto scale-[1.2] sm:scale-[1.25] origin-center pointer-events-none select-none">
      <FeatureCardMockup index={feature.index} />
    </div>
  );
}

function FeatureDetailPanel({ feature, fitHeight }: { feature: FeatureItem; fitHeight?: boolean }) {
  const Icon = feature.icon;

  return (
    <div
      key={feature.index}
      className={cn(
        "flex flex-col animate-in fade-in duration-300",
        fitHeight && "h-full min-h-0",
      )}
      role="tabpanel"
      id={`feature-panel-${feature.index}`}
      aria-labelledby={`feature-tab-${feature.index}`}
    >
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" strokeWidth={1.75} />
        </div>
        <span className="text-xs font-bold text-orange-500 tracking-wide">
          {String(feature.index).padStart(2, "0")}
        </span>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mb-2">
        {feature.title}
      </h3>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4 max-w-xl">
        {feature.description}
      </p>

      {feature.bullets.length > 0 && (
        <ul className="space-y-2 mb-4">
          {feature.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5 mb-4",
          fitHeight ? "flex-1 min-h-0 overflow-hidden" : "min-h-[120px] sm:min-h-[140px]",
        )}
      >
        <FeaturePreview feature={feature} />
      </div>

      {feature.href && (
        <Button asChild className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white shrink-0">
          <Link href={feature.href}>
            Learn more
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function ServiceTab({
  feature,
  isActive,
  onSelect,
  layout,
}: {
  feature: FeatureItem;
  isActive: boolean;
  onSelect: () => void;
  layout: "sidebar" | "stack";
}) {
  const Icon = feature.icon;

  return (
    <button
      type="button"
      role="tab"
      id={`feature-tab-${feature.index}`}
      aria-selected={isActive}
      aria-controls={`feature-panel-${feature.index}`}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 text-left transition-all duration-200 w-full",
        layout === "sidebar"
          ? "px-4 py-4 rounded-xl border"
          : "px-3 py-3 rounded-lg border shrink-0 snap-start",
        isActive
          ? "bg-orange-50 border-orange-200 shadow-sm"
          : "bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-200",
        layout === "sidebar" && isActive && "border-l-4 border-l-orange-500 rounded-l-md",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border",
          isActive
            ? "bg-orange-100 border-orange-200"
            : "bg-slate-50 border-slate-200",
        )}
      >
        <Icon
          className={cn("w-4 h-4 sm:w-[18px] sm:h-[18px]", isActive ? "text-orange-500" : "text-slate-500")}
          strokeWidth={1.75}
        />
      </div>
      <span
        className={cn(
          "font-semibold text-sm sm:text-[15px] leading-snug",
          isActive ? "text-slate-900" : "text-slate-600",
        )}
      >
        {feature.title}
      </span>
    </button>
  );
}

export function InteractiveFeaturesSection({ features }: { features: FeatureItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = features[activeIndex] ?? features[0];
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    const update = () => setSidebarHeight(el.offsetHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [features.length, activeIndex]);

  if (!activeFeature) return null;

  return (
    <div className="w-full">
      {/* Mobile / tablet: stacked tabs + detail */}
      <div className="lg:hidden space-y-4">
        <div
          role="tablist"
          aria-label="Services"
          className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1"
        >
          {features.map((feature, i) => (
            <ServiceTab
              key={feature.title}
              feature={feature}
              isActive={i === activeIndex}
              onSelect={() => setActiveIndex(i)}
              layout="stack"
            />
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-5 sm:p-6">
          <FeatureDetailPanel feature={activeFeature} />
        </div>
      </div>

      {/* Desktop: sidebar + detail panel — right height matches left tabs */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(240px,280px)_1fr] gap-6 xl:gap-8 items-start">
        <div ref={sidebarRef} role="tablist" aria-label="Services" className="flex flex-col gap-3.5">
          {features.map((feature, i) => (
            <ServiceTab
              key={feature.title}
              feature={feature}
              isActive={i === activeIndex}
              onSelect={() => setActiveIndex(i)}
              layout="sidebar"
            />
          ))}
        </div>
        <div
          className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-6 xl:p-7 flex flex-col min-h-0 overflow-hidden"
          style={sidebarHeight ? { height: sidebarHeight } : undefined}
        >
          <FeatureDetailPanel feature={activeFeature} fitHeight />
        </div>
      </div>
    </div>
  );
}
