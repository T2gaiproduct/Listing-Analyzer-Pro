import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_MESSAGES = [
  "Analyzing your product photos and prompts…",
  "Building scene composition and lighting…",
  "Rendering high-resolution e-commerce graphics…",
  "Applying Amazon-friendly framing and clarity…",
  "Polishing details for download-ready images…",
];

export const IMAGE_GENERATION_TIPS = [
  {
    icon: "📸",
    title: "Hero shots drive clicks",
    body: "A clean main image on white can lift click-through rate — keep the product at 80%+ of the frame.",
  },
  {
    icon: "🌅",
    title: "Lifestyle builds trust",
    body: "Show the product in real use so shoppers imagine owning it before they read a single bullet.",
  },
  {
    icon: "🔢",
    title: "Callouts beat walls of text",
    body: "Numbered feature images help mobile shoppers scan benefits in under two seconds.",
  },
  {
    icon: "📐",
    title: "Size kills returns",
    body: "Scale references (hand, ruler, common object) reduce “smaller than expected” reviews.",
  },
  {
    icon: "✨",
    title: "Consistency sells the brand",
    body: "Matching lighting and color across gallery images makes your listing look premium and intentional.",
  },
  {
    icon: "🛒",
    title: "Gallery completeness",
    body: "Listings with a full image set often outperform sparse galleries in conversion tests.",
  },
] as const;

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Almost done";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type ImageGenerationProgressPanelProps = {
  title?: string;
  subtitle?: string;
  progressPercent: number;
  generatedCount?: number;
  totalImages?: number;
  etaSeconds?: number;
  embedded?: boolean;
  className?: string;
};

export function ImageGenerationProgressPanel({
  title = "Generating your images",
  subtitle,
  progressPercent,
  generatedCount,
  totalImages,
  etaSeconds = 0,
  embedded = false,
  className,
}: ImageGenerationProgressPanelProps) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [statusVisible, setStatusVisible] = useState(true);
  const [tipVisible, setTipVisible] = useState(true);

  const progressLabel = useMemo(() => {
    if (subtitle) return subtitle;
    if (totalImages != null && totalImages > 0 && generatedCount != null) {
      const etaPart = etaSeconds > 0 ? ` • ~${formatEta(etaSeconds)} left` : " • Almost done";
      return `${generatedCount} of ${totalImages} images${etaPart}`;
    }
    if (etaSeconds > 0) return `About ${formatEta(etaSeconds)} remaining`;
    return "Hang tight — quality takes a moment";
  }, [subtitle, generatedCount, totalImages, etaSeconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusVisible(false);
      setTimeout(() => {
        setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length);
        setStatusVisible(true);
      }, 280);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIdx((i) => (i + 1) % IMAGE_GENERATION_TIPS.length);
        setTipVisible(true);
      }, 280);
    }, 5200);
    return () => clearInterval(interval);
  }, []);

  const tip = IMAGE_GENERATION_TIPS[tipIdx]!;
  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);

  return (
    <div
      className={cn(
        embedded ? "py-8" : "min-h-[60vh] flex items-center justify-center",
        className,
      )}
    >
      <div className="text-center space-y-6 max-w-lg mx-auto px-4">
        <div className="relative flex items-center justify-center h-24">
          <div className="absolute w-24 h-24 rounded-full bg-orange-100/80 animate-ping opacity-40" />
          <div className="absolute w-[4.5rem] h-[4.5rem] rounded-full bg-orange-200/50 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200/80">
            <Sparkles className="w-7 h-7 text-white animate-pulse" />
          </div>
          <Loader2 className="absolute -bottom-1 -right-2 h-6 w-6 text-orange-500 animate-spin opacity-80" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{progressLabel}</p>
          <p
            className="text-sm font-medium text-orange-700/90 min-h-[1.25rem] transition-opacity duration-300"
            style={{ opacity: statusVisible ? 1 : 0 }}
          >
            {STATUS_MESSAGES[statusIdx]}
          </p>
        </div>

        <div className="w-full space-y-2">
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(clampedProgress, 95)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{Math.round(clampedProgress)}% complete</span>
            <div className="flex items-center gap-1">
              {STATUS_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === statusIdx ? "w-3 h-1.5 bg-orange-500" : "w-1.5 h-1.5 bg-slate-200",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-4 text-left shadow-sm transition-opacity duration-300",
          )}
          style={{ opacity: tipVisible ? 1 : 0.4 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600/90 mb-2">
            While you wait
          </p>
          <div className="flex gap-3">
            <span className="text-2xl leading-none shrink-0" aria-hidden>
              {tip.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{tip.title}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{tip.body}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
