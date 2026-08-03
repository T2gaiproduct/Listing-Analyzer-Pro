import {
  Upload, Search, Wand2, Image, Download, Globe,
} from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { parseWorkflowMarqueeItems } from "@/lib/workflow-marquee-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const WORKFLOW_ICONS = [Upload, Search, Wand2, Image, Download, Globe];

const BEFORE_BARS = [40, 55, 45, 50, 42, 48];
const AFTER_BARS = [55, 62, 70, 78, 88, 96];

function ComparisonCard({
  variant,
  image,
  score,
  label,
  badge,
}: {
  variant: "before" | "after";
  image: string;
  score: string;
  label: string;
  badge?: string;
}) {
  const isAfter = variant === "after";
  const bars = isAfter ? AFTER_BARS : BEFORE_BARS;

  return (
    <div
      className={cn(
        "relative flex flex-col w-[150px] sm:w-[170px] md:w-[190px] rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm shrink-0",
        isAfter ? "border-2 border-orange-200 shadow-md" : "border border-red-100",
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 left-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <p
        className={cn(
          "text-[10px] font-bold uppercase mb-2.5",
          isAfter ? "text-orange-600 mt-0.5" : "text-red-500",
        )}
      >
        {label}
      </p>
      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 mb-3">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
      </div>
      <p
        className={cn(
          "text-2xl sm:text-3xl font-extrabold leading-none",
          isAfter ? "text-orange-600" : "text-slate-800",
        )}
      >
        {score}
        <span className="text-sm text-slate-400 font-semibold">/100</span>
      </p>
      <div className="mt-2 flex items-end gap-0.5 h-7">
        {bars.map((h, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-sm", isAfter ? "bg-orange-400" : "bg-red-200")}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function MarqueePair({
  item,
  beforeLabel,
  afterLabel,
  afterBadge,
}: {
  item: ReturnType<typeof parseWorkflowMarqueeItems>[number];
  beforeLabel: string;
  afterLabel: string;
  afterBadge: string;
}) {
  return (
    <div className="flex flex-col shrink-0">
      <div className="flex gap-3 sm:gap-4">
        <ComparisonCard
          variant="before"
          image={item.beforeImage}
          score={item.beforeScore}
          label={beforeLabel}
        />
        <ComparisonCard
          variant="after"
          image={item.afterImage || item.beforeImage}
          score={item.afterScore}
          label={afterLabel}
          badge={afterBadge}
        />
      </div>
      {item.caption && (
        <p className="mt-3 text-xs sm:text-sm text-slate-500 text-center max-w-[340px] sm:max-w-[400px] mx-auto leading-snug">
          {item.caption}
        </p>
      )}
    </div>
  );
}

export function LandingWorkflowSection({ cms }: { cms: HomepageCmsMap }) {
  const items = parseWorkflowMarqueeItems(cms, basePath);
  if (items.length === 0) return null;

  const heading = cmsText(cms, "workflow.heading");
  const beforeLabel = cmsText(cms, "workflow.before_label");
  const afterLabel = cmsText(cms, "workflow.after_label");
  const afterBadge = cmsText(cms, "workflow.after_badge");
  const metricsHeading = cmsText(cms, "workflow.metrics_heading");

  const workflowSteps = [1, 2, 3, 4, 5, 6].map((i) => ({
    icon: WORKFLOW_ICONS[i - 1],
    label: cmsText(cms, `workflow.step${i}_label`),
  }));

  const workflowMetrics = [1, 2, 3, 4].map((i) => ({
    label: cmsText(cms, `workflow.metric${i}_label`),
    value: cmsText(cms, `workflow.metric${i}_value`),
  }));

  const loopItems = items.length > 1 ? [...items, ...items] : items;

  return (
    <section className="px-4 sm:px-6 lg:px-10 pt-4 pb-4 sm:pt-8 lg:pt-10 sm:pb-16 lg:pb-20 bg-white border-t border-slate-100">
      <style>{`
        @keyframes workflow-marquee-kf {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .workflow-marquee-track {
          animation: workflow-marquee-kf 45s linear infinite;
        }
        .workflow-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .workflow-marquee-track { animation: none !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 sm:mb-6 lg:mb-8 text-center">
          {heading}
        </h2>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible mb-8 sm:mb-10">
          <div className="flex sm:justify-between gap-3 sm:gap-0 min-w-max sm:min-w-0 sm:w-full relative">
            {workflowSteps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center w-20 sm:flex-1 sm:min-w-0 relative">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center mb-2 z-10">
                  <step.icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
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

        <div className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 overflow-hidden py-2 sm:py-4">
          <div
            className={cn(
              "flex gap-6 sm:gap-8 px-4 sm:px-8",
              items.length > 1 && "workflow-marquee-track w-max",
            )}
          >
            {loopItems.map((item, index) => (
              <MarqueePair
                key={`${item.id}-${index}`}
                item={item}
                beforeLabel={beforeLabel}
                afterLabel={afterLabel}
                afterBadge={afterBadge}
              />
            ))}
          </div>
        </div>

        {metricsHeading && (
          <div className="mt-6 sm:mt-10 rounded-2xl bg-slate-50 p-4 sm:p-5 max-w-4xl mx-auto">
            <p className="text-sm font-bold text-slate-900 mb-3 sm:mb-4 text-center">
              {metricsHeading}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {workflowMetrics.map((m) => (
                <div key={m.label} className="text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-orange-600">{m.value}</p>
                  <p className="text-xs text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
