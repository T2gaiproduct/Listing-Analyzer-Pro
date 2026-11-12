import { useEffect, useState } from "react";
import {
  Upload, Search, Wand2, Image, Download, Globe,
} from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { parseWorkflowMarqueeItems } from "@/lib/workflow-marquee-cms";
import { LandingAnimatedStat } from "@/components/landing-animated-stat";
import { useInViewOnce, usePrefersReducedMotion } from "@/lib/landing-motion";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const WORKFLOW_ICONS = [Upload, Search, Wand2, Image, Download, Globe];

function MarqueeCard({
  item,
  beforeLabel,
  afterLabel,
}: {
  item: ReturnType<typeof parseWorkflowMarqueeItems>[number];
  beforeLabel: string;
  afterLabel: string;
}) {
  const afterSrc = item.afterImage || item.beforeImage;
  const hasAfter = Boolean(item.afterImage?.trim());

  return (
    <div className="flex flex-col shrink-0 w-[min(85vw,280px)] sm:w-[300px] md:w-[340px] lg:w-[380px]">
      <div
        className={cn(
          "group relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100",
          "border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow",
          hasAfter && "cursor-pointer",
        )}
      >
        {item.beforeImage ? (
          <img
            src={item.beforeImage}
            alt=""
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
              hasAfter && "group-hover:opacity-0",
            )}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        {afterSrc && (
          <img
            src={afterSrc}
            alt=""
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
              hasAfter ? "opacity-0 group-hover:opacity-100" : "opacity-100",
            )}
            loading="lazy"
          />
        )}
        <span
          className={cn(
            "absolute bottom-2.5 left-2.5 text-[10px] font-semibold uppercase tracking-wide text-white",
            "px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm",
            "transition-opacity duration-300",
            hasAfter && "group-hover:opacity-0",
          )}
        >
          {beforeLabel}
        </span>
        {hasAfter && (
          <span
            className={cn(
              "absolute bottom-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wide",
              "px-2.5 py-1 rounded-full bg-orange-500 text-white shadow-sm",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            )}
          >
            {afterLabel}
          </span>
        )}
      </div>
      {item.caption && (
        <p className="mt-2.5 text-sm text-slate-500 leading-snug text-left">
          {item.caption}
        </p>
      )}
    </div>
  );
}

export function LandingWorkflowSection({ cms }: { cms: HomepageCmsMap }) {
  const items = parseWorkflowMarqueeItems(cms, basePath);

  const heading = cmsText(cms, "workflow.heading");
  const beforeLabel = cmsText(cms, "workflow.before_label");
  const afterLabel = cmsText(cms, "workflow.after_label");

  const workflowSteps = [1, 2, 3, 4, 5, 6].map((i) => ({
    icon: WORKFLOW_ICONS[i - 1],
    label: cmsText(cms, `workflow.step${i}_label`),
  }));

  const loopItems = items.length > 1 ? [...items, ...items] : items;

  const subheading = cmsText(cms, "workflow.subheading");
  const metricsHeading = cmsText(cms, "workflow.metrics_heading");
  const workflowMetrics = [1, 2, 3, 4].map((i) => ({
    value: cmsText(cms, `workflow.metric${i}_value`),
    label: cmsText(cms, `workflow.metric${i}_label`),
  })).filter((m) => m.value && m.label);

  const { ref: stepsRef, inView: stepsInView } = useInViewOnce<HTMLDivElement>();
  const reducedMotion = usePrefersReducedMotion();
  const [highlightStep, setHighlightStep] = useState(-1);

  useEffect(() => {
    if (!stepsInView || reducedMotion) {
      setHighlightStep(workflowSteps.length - 1);
      return;
    }
    setHighlightStep(-1);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      setHighlightStep(i);
      i += 1;
      if (i < workflowSteps.length) {
        timers.push(setTimeout(tick, 320));
      }
    };
    timers.push(setTimeout(tick, 200));
    return () => timers.forEach(clearTimeout);
  }, [stepsInView, reducedMotion, workflowSteps.length]);

  if (items.length === 0) return null;

  return (
    <section className="relative pt-4 pb-4 sm:pt-8 lg:pt-10 sm:pb-16 lg:pb-20 bg-white border-t border-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,102,0,0.05),transparent_55%)] pointer-events-none" />
      <style>{`
        @keyframes workflow-marquee-kf {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .workflow-marquee-track {
          animation: workflow-marquee-kf 50s linear infinite;
        }
        .workflow-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .workflow-marquee-track { animation: none !important; }
        }
      `}</style>

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 sm:mb-4 text-center">
          {heading}
        </h2>
        {subheading && (
          <p className="text-sm sm:text-base text-slate-500 text-center max-w-2xl mx-auto mb-6 sm:mb-8">
            {subheading}
          </p>
        )}

        <div
          ref={stepsRef}
          className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible mb-8 sm:mb-10"
        >
          <div className="flex sm:justify-between gap-3 sm:gap-0 min-w-max sm:min-w-0 sm:w-full relative">
            {workflowSteps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center w-20 sm:flex-1 sm:min-w-0 relative">
                <div
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center mb-2 z-10 transition-all duration-500",
                    i <= highlightStep
                      ? "bg-orange-500 border-orange-500 shadow-md shadow-orange-500/25 scale-105"
                      : "bg-orange-50 border-orange-200",
                  )}
                >
                  <step.icon
                    className={cn(
                      "w-4 h-4 sm:w-5 sm:h-5 transition-colors",
                      i <= highlightStep ? "text-white" : "text-orange-600",
                    )}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center leading-tight max-w-[4.5rem] sm:max-w-none">
                  {step.label}
                </span>
                {i < workflowSteps.length - 1 && (
                  <div className="hidden sm:block absolute top-5 sm:top-[1.375rem] left-[60%] w-[80%] h-0.5 bg-orange-100" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 bg-white py-6 sm:py-8 overflow-hidden">
        <div
          className={cn(
            "flex gap-4 sm:gap-6 px-4 sm:px-8",
            items.length > 1 && "workflow-marquee-track w-max",
          )}
        >
          {loopItems.map((item, index) => (
            <MarqueeCard
              key={`${item.id}-${index}`}
              item={item}
              beforeLabel={beforeLabel}
              afterLabel={afterLabel}
            />
          ))}
        </div>
      </div>

      {workflowMetrics.length > 0 && (
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 mt-6 sm:mt-10">
          {metricsHeading && (
            <p className="text-center text-sm font-semibold text-slate-700 mb-6">{metricsHeading}</p>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {workflowMetrics.map((m) => (
              <div
                key={m.label}
                className="text-center rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 py-5"
              >
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 leading-tight">
                  <LandingAnimatedStat value={m.value} />
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
