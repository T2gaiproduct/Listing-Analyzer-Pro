import { useState, useRef, useLayoutEffect } from "react";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
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

function FeatureImagePanel({ feature, fitHeight }: { feature: FeatureItem; fitHeight?: boolean }) {
  const content = feature.image ? (
    <div className="flex items-center justify-center w-full h-full bg-slate-50 p-2 sm:p-3">
      <img
        src={feature.image}
        alt={feature.title}
        className="max-w-full max-h-full w-auto h-auto object-contain"
        loading="lazy"
      />
    </div>
  ) : (
    <div
      className={cn(
        "flex items-center justify-center w-full h-full bg-gradient-to-br from-slate-50 to-white",
        !fitHeight && "p-6",
      )}
    >
      <div className={cn(fitHeight ? "w-full max-w-[240px]" : "max-w-sm scale-110 sm:scale-125 origin-center")}>
        <FeatureCardMockup index={feature.index} />
      </div>
    </div>
  );

  const panel = (
    <div
      key={feature.index}
      className={cn(
        "animate-in fade-in duration-300 overflow-hidden",
        fitHeight ? "h-full w-full" : cn("rounded-2xl border border-slate-200/90", feature.image ? "h-48 sm:h-56" : "min-h-[160px]"),
        !feature.image && !fitHeight && "bg-white shadow-sm",
      )}
      role="tabpanel"
      id={`feature-panel-${feature.index}`}
      aria-labelledby={`feature-tab-${feature.index}`}
      aria-label={feature.title}
    >
      {content}
    </div>
  );

  if (feature.href) {
    return (
      <Link href={feature.href} className={cn("block", fitHeight ? "h-full w-full" : "w-full")}>
        {panel}
      </Link>
    );
  }

  return panel;
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
      {/* Mobile / tablet: stacked tabs + image */}
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
        <FeatureImagePanel feature={activeFeature} />
      </div>

      {/* Desktop: sidebar + image panel */}
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
          className="rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden min-h-0"
          style={sidebarHeight ? { height: sidebarHeight } : undefined}
        >
          <FeatureImagePanel feature={activeFeature} fitHeight />
        </div>
      </div>
    </div>
  );
}
