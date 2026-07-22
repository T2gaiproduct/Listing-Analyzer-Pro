import { useState } from "react";
import { Link } from "wouter";
import { Check, ArrowRight, type LucideIcon } from "lucide-react";
import { FeatureCardMockup } from "@/components/feature-card-mockups";
import { cn } from "@/lib/utils";

export type InteractiveFeatureItem = {
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  bullets: string[];
  image: string;
};

function FeaturePreview({
  title,
  index,
  image,
}: {
  title: string;
  index: number;
  image: string;
}) {
  return (
    <div className="mt-auto border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4">
      {image ? (
        <img
          src={image}
          alt={`${title} preview`}
          className="w-full rounded-lg object-contain max-h-36 sm:max-h-44"
          loading="lazy"
        />
      ) : (
        <FeatureCardMockup index={index} />
      )}
    </div>
  );
}

function FeatureAccordionCard({
  index,
  icon: Icon,
  title,
  description,
  href,
  bullets,
  image,
  isActive,
  onSelect,
}: InteractiveFeatureItem & {
  isActive: boolean;
  onSelect: () => void;
}) {
  const number = String(index).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={cn(
        "group flex flex-col h-full items-stretch justify-between text-left bg-white rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden",
        isActive
          ? "flex-[1.35] border-orange-300 ring-2 ring-orange-500/15 shadow-lg"
          : "flex-1 border-slate-200/90 hover:border-orange-200 hover:shadow-md opacity-95 hover:opacity-100",
      )}
    >
      <div className="flex flex-col flex-1 items-start justify-start p-4 xl:p-5 text-left min-h-0">
        <span className={cn(
          "text-[11px] font-bold tracking-wide",
          isActive ? "text-orange-500" : "text-orange-400",
        )}
        >
          {number}
        </span>

        <div className="flex justify-start my-3 xl:my-4">
          <div className={cn(
            "w-12 h-12 xl:w-14 xl:h-14 rounded-full border flex items-center justify-center transition-colors",
            isActive
              ? "bg-orange-100 border-orange-200"
              : "bg-orange-50 border-orange-100 group-hover:bg-orange-100",
          )}
          >
            <Icon className="w-5 h-5 xl:w-6 xl:h-6 text-orange-500" strokeWidth={1.75} />
          </div>
        </div>

        <h3 className="font-bold text-slate-900 text-sm xl:text-[15px] leading-snug mb-2">
          {title}
        </h3>
        <p className={cn(
          "text-xs xl:text-sm text-slate-500 leading-relaxed mb-4",
          !isActive && "line-clamp-3",
        )}
        >
          {description}
        </p>

        {bullets.length > 0 && (
          <ul className="w-full space-y-2 mb-2">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start justify-start gap-2 text-left text-xs text-slate-600 leading-snug">
                <Check className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                <span className={cn(!isActive && "line-clamp-1")}>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {isActive && href && (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 mt-1"
          >
            Explore
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div
        className={cn(
          "transition-all duration-300 ease-out overflow-hidden",
          isActive ? "max-h-56 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <FeaturePreview title={title} index={index} image={image} />
      </div>
    </button>
  );
}

function MobileFeaturePanel({ feature }: { feature: InteractiveFeatureItem }) {
  const { index, icon: Icon, title, description, href, bullets, image } = feature;
  const number = String(index).padStart(2, "0");

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-md overflow-hidden">
      <div className="p-5">
        <span className="text-[11px] font-bold text-orange-500 tracking-wide">{number}</span>
        <div className="flex items-start gap-4 mt-3">
          <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-orange-500" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-snug mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        {bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 mt-4"
          >
            Explore
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <FeaturePreview title={title} index={index} image={image} />
    </div>
  );
}

export function InteractiveFeaturesSection({ features }: { features: InteractiveFeatureItem[] }) {
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, Math.max(features.length - 1, 0));
  const activeFeature = features[safeActive] ?? features[0];

  if (!activeFeature) return null;

  return (
    <>
      <div className="lg:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {features.map((f, i) => {
            const number = String(f.index).padStart(2, "0");
            const isActive = safeActive === i;
            return (
              <button
                key={f.title}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-semibold border transition-colors",
                  isActive
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-orange-200",
                )}
              >
                {number} {f.title}
              </button>
            );
          })}
        </div>
        <MobileFeaturePanel feature={activeFeature} />
      </div>

      <div className="hidden lg:flex gap-4 xl:gap-5 items-stretch min-h-[480px]">
        {features.map((f, i) => (
          <FeatureAccordionCard
            key={f.title}
            {...f}
            isActive={safeActive === i}
            onSelect={() => setActive(i)}
          />
        ))}
      </div>
    </>
  );
}
