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

function FeaturePreview({ feature, large }: { feature: FeatureItem; large?: boolean }) {
  if (feature.image) {
    return (
      <img
        src={feature.image}
        alt={`${feature.title} preview`}
        className={cn(
          "w-full object-contain rounded-xl",
          large ? "max-h-72 xl:max-h-80" : "max-h-64 sm:max-h-72",
        )}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full max-w-md mx-auto origin-center pointer-events-none select-none",
        large ? "scale-[1.55] xl:scale-[1.7]" : "scale-[1.35] sm:scale-[1.5]",
      )}
    >
      <FeatureCardMockup index={feature.index} />
    </div>
  );
}

function FeatureDetailPanel({ feature, large }: { feature: FeatureItem; large?: boolean }) {
  const Icon = feature.icon;

  return (
    <div
      key={feature.index}
      className="flex flex-col h-full min-h-0 animate-in fade-in duration-300"
      role="tabpanel"
      id={`feature-panel-${feature.index}`}
      aria-labelledby={`feature-tab-${feature.index}`}
    >
      <div className="flex items-start gap-4 mb-5 sm:mb-6">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 pt-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-500">
            Service {String(feature.index).padStart(2, "0")}
          </span>
          <h3 className="text-xl sm:text-2xl lg:text-[1.75rem] xl:text-3xl font-bold text-slate-900 leading-tight mt-1">
            {feature.title}
          </h3>
        </div>
      </div>

      <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5 sm:mb-6 max-w-2xl">
        {feature.description}
      </p>

      {feature.bullets.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-6 sm:mb-8">
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
          "flex-1 flex items-center justify-center rounded-2xl border border-slate-200/80",
          "bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-6 sm:p-8 mb-6 min-h-[200px]",
          large && "min-h-[240px] xl:min-h-[280px]",
        )}
      >
        <FeaturePreview feature={feature} large={large} />
      </div>

      {feature.href && (
        <div className="mt-auto pt-1">
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm">
            <Link href={feature.href}>
              Learn more
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
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
  const number = String(feature.index).padStart(2, "0");

  return (
    <button
      type="button"
      role="tab"
      id={`feature-tab-${feature.index}`}
      aria-selected={isActive}
      aria-controls={`feature-panel-${feature.index}`}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 text-left transition-all duration-200 w-full group",
        layout === "sidebar"
          ? "flex-1 min-h-[72px] px-4 xl:px-5 rounded-xl"
          : "px-3 py-3 rounded-lg border shrink-0 snap-start min-w-[148px]",
        layout === "sidebar"
          ? isActive
            ? "bg-white shadow-md ring-1 ring-orange-200/80"
            : "bg-transparent hover:bg-white/70"
          : isActive
            ? "bg-orange-50 border-orange-200 shadow-sm border"
            : "bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-200 border",
        layout === "sidebar" && isActive && "relative before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:bg-orange-500",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
          isActive
            ? "bg-orange-100 border-orange-200"
            : "bg-white/80 border-slate-200 group-hover:border-slate-300",
        )}
      >
        <Icon
          className={cn("w-[18px] h-[18px]", isActive ? "text-orange-500" : "text-slate-500")}
          strokeWidth={1.75}
        />
      </div>
      <div className="min-w-0 flex-1">
        {layout === "sidebar" && (
          <span className={cn("text-[10px] font-bold tracking-wide", isActive ? "text-orange-500" : "text-slate-400")}>
            {number}
          </span>
        )}
        <span
          className={cn(
            "block font-semibold text-sm sm:text-[15px] leading-snug",
            isActive ? "text-slate-900" : "text-slate-600",
          )}
        >
          {feature.title}
        </span>
      </div>
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

      {/* Desktop: unified card — equal-height sidebar + detail */}
      <div className="hidden lg:block rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden min-h-[580px] xl:min-h-[620px]">
        <div className="grid grid-cols-[minmax(260px,300px)_1fr] h-full min-h-[inherit]">
          <div
            role="tablist"
            aria-label="Services"
            className="flex flex-col gap-1.5 p-3 xl:p-4 bg-gradient-to-b from-slate-100/90 to-slate-50/60 border-r border-slate-200/90 h-full min-h-[inherit]"
          >
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
          <div className="p-8 xl:p-10 flex flex-col min-h-[inherit] bg-white">
            <FeatureDetailPanel feature={activeFeature} large />
          </div>
        </div>
      </div>
    </div>
  );
}
