import { useState } from "react";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { FeatureCardMockup } from "@/components/feature-card-mockups";
import { cn } from "@/lib/utils";

/** Desktop features row — right preview panel and left tabs share this minimum height. */
const DESKTOP_PANEL_MIN_HEIGHT = "min-h-[34rem]";

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
    <div className="relative w-full h-full bg-[#faf8f5] overflow-hidden">
      <img
        src={feature.image}
        alt={feature.title}
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="lazy"
      />
    </div>
  ) : (
    <div
      className={cn(
        "flex items-center justify-center w-full h-full bg-gradient-to-br from-slate-50 to-white",
        !fitHeight && "p-3",
      )}
    >
      <div className={cn(fitHeight ? "w-full scale-[1.35] origin-center" : "max-w-sm scale-110 origin-center")}>
        <FeatureCardMockup index={feature.index} />
      </div>
    </div>
  );

  const panel = (
    <div
      key={feature.index}
      className={cn(
        "animate-in fade-in duration-300 overflow-hidden",
        fitHeight ? "h-full w-full" : cn("rounded-2xl border border-slate-200/90", feature.image ? "h-52 sm:h-56" : "min-h-[150px]"),
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

function FeatureMobileDetailPanel({ feature }: { feature: FeatureItem }) {
  const Icon = feature.icon;

  const imageBlock = feature.image ? (
    <div className="relative w-full aspect-[4/3] min-h-[200px] bg-[#faf8f5]">
      <img
        src={feature.image}
        alt={feature.title}
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="lazy"
      />
    </div>
  ) : (
    <div className="flex items-center justify-center w-full min-h-[180px] bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="w-full max-w-xs scale-105 origin-center">
        <FeatureCardMockup index={feature.index} />
      </div>
    </div>
  );

  const card = (
    <div
      key={feature.index}
      className="animate-in fade-in duration-300 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm"
      role="tabpanel"
      id={`feature-panel-${feature.index}`}
      aria-labelledby={`feature-tab-${feature.index}`}
      aria-label={feature.title}
    >
      <div className="p-5">
        <h3 className="text-[1.35rem] font-bold text-slate-900 leading-[1.25] mb-2.5">
          <span className="text-orange-500">{feature.title}</span>
        </h3>
        {feature.description && (
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            {feature.description}
          </p>
        )}
        {feature.bullets.length > 0 && (
          <ul className="space-y-3">
            {feature.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-orange-500" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-snug pt-1">{bullet}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-slate-100">{imageBlock}</div>
    </div>
  );

  if (feature.href) {
    return (
      <Link href={feature.href} className="block w-full">
        {card}
      </Link>
    );
  }

  return card;
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
  layout: "sidebar" | "mobile-vertical";
}) {
  const Icon = feature.icon;

  if (layout === "mobile-vertical") {
    return (
      <button
        type="button"
        role="tab"
        id={`feature-tab-${feature.index}`}
        aria-selected={isActive}
        aria-controls={`feature-panel-${feature.index}`}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 w-full px-4 py-3.5 rounded-lg text-left transition-all duration-200 border border-l-[4px]",
          isActive
            ? "bg-orange-50 border-orange-200 border-l-orange-500 shadow-sm"
            : "bg-slate-50/90 border-slate-200/80 border-l-transparent hover:bg-slate-100",
        )}
      >
        <Icon
          className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-orange-600" : "text-slate-600")}
          strokeWidth={1.75}
        />
        <span
          className={cn(
            "font-semibold text-[15px] leading-snug",
            isActive ? "text-slate-900" : "text-slate-700",
          )}
        >
          {feature.title}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      id={`feature-tab-${feature.index}`}
      aria-selected={isActive}
      aria-controls={`feature-panel-${feature.index}`}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 text-left transition-all duration-200 w-full flex-1 min-h-[4.5rem] px-4 py-4 rounded-xl border",
        isActive
          ? "bg-orange-50 border-orange-200 shadow-sm border-l-4 border-l-orange-500 rounded-l-md"
          : "bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-200",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border",
          isActive
            ? "bg-orange-100 border-orange-200"
            : "bg-slate-50 border-slate-200",
        )}
      >
        <Icon
          className={cn("w-4 h-4", isActive ? "text-orange-500" : "text-slate-500")}
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
      {/* Mobile — vertical tabs + detail card */}
      <div className="lg:hidden space-y-4">
        <div role="tablist" aria-label="Services" className="flex flex-col gap-2">
          {features.map((feature, i) => (
            <ServiceTab
              key={feature.title}
              feature={feature}
              isActive={i === activeIndex}
              onSelect={() => setActiveIndex(i)}
              layout="mobile-vertical"
            />
          ))}
        </div>
        <FeatureMobileDetailPanel feature={activeFeature} />
      </div>

      {/* Desktop — taller preview panel; tabs stretch to match */}
      <div
        className={cn(
          "hidden lg:grid lg:grid-cols-[minmax(250px,270px)_1fr] lg:gap-6 xl:gap-8 items-stretch max-w-5xl mx-auto w-full",
          DESKTOP_PANEL_MIN_HEIGHT,
        )}
      >
        <div role="tablist" aria-label="Services" className={cn("flex flex-col gap-3.5 h-full", DESKTOP_PANEL_MIN_HEIGHT)}>
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
        <div className={cn("rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden min-w-0 h-full", DESKTOP_PANEL_MIN_HEIGHT)}>
          <FeatureImagePanel feature={activeFeature} fitHeight />
        </div>
      </div>
    </div>
  );
}
