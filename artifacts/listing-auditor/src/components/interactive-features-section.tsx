import { useState } from "react";
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
        className="w-full max-h-64 sm:max-h-72 object-contain rounded-xl"
        loading="lazy"
      />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto scale-[1.35] sm:scale-[1.5] origin-center pointer-events-none select-none">
      <FeatureCardMockup index={feature.index} />
    </div>
  );
}

function FeatureDetailPanel({ feature }: { feature: FeatureItem }) {
  const Icon = feature.icon;

  return (
    <div
      key={feature.index}
      className="flex flex-col h-full animate-in fade-in duration-300"
      role="tabpanel"
      id={`feature-panel-${feature.index}`}
      aria-labelledby={`feature-tab-${feature.index}`}
    >
      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" strokeWidth={1.75} />
        </div>
        <span className="text-xs font-bold text-orange-500 tracking-wide">
          {String(feature.index).padStart(2, "0")}
        </span>
      </div>

      <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 leading-tight mb-3">
        {feature.title}
      </h3>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5 sm:mb-6 max-w-xl">
        {feature.description}
      </p>

      {feature.bullets.length > 0 && (
        <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
          {feature.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 flex items-center justify-center rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-6 sm:p-8 mb-6 sm:mb-8 min-h-[180px] sm:min-h-[220px]">
        <FeaturePreview feature={feature} />
      </div>

      {feature.href && (
        <Button asChild className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white">
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
          ? "px-4 py-3.5 sm:py-4 rounded-lg border border-transparent"
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

      {/* Desktop: sidebar + detail panel */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(240px,300px)_1fr] gap-6 xl:gap-8 items-stretch">
        <div role="tablist" aria-label="Services" className="flex flex-col gap-2">
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
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-8 xl:p-10 min-h-[520px]">
          <FeatureDetailPanel feature={activeFeature} />
        </div>
      </div>
    </div>
  );
}
