import {
  LayoutDashboard, FileSearch, BarChart3, Image, Users, Settings,
  ChevronRight, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarIcons = [LayoutDashboard, FileSearch, BarChart3, Image, Users, Settings];

const opportunities = [
  { label: "Improve Title", badge: "High Impact", tone: "high" as const },
  { label: "Add Missing Keywords", badge: "High Impact", tone: "high" as const },
  { label: "Enhance Images", badge: "Medium", tone: "medium" as const },
  { label: "A+ Content Recommended", badge: "Medium", tone: "medium" as const },
];

const scoreCards = [
  { label: "SEO Score", score: 92, spark: "M0,14 L4,10 L8,12 L12,6 L16,8 L20,4" },
  { label: "Content Score", score: 88, spark: "M0,12 L4,10 L8,8 L12,10 L16,6 L20,4" },
  { label: "Image Score", score: 90, spark: "M0,10 L4,12 L8,8 L12,10 L16,7 L20,5" },
];

const competitors = [
  { label: "Your Listing", score: 95, tone: "good" as const },
  { label: "Competitor 1", score: 86, tone: "mid" as const },
  { label: "Competitor 2", score: 85, tone: "mid" as const },
];

function ScoreRing({ value }: { value: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#f97316"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
        {value}
      </text>
    </svg>
  );
}

function Sparkline({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 20 16" className="w-full h-4 mt-2" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeroDashboardMockup() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
      <div className="absolute -inset-3 sm:-inset-4 bg-gradient-to-br from-orange-100/50 to-slate-100/30 rounded-[1.75rem] blur-2xl" />
      <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] overflow-hidden">
        <div className="flex min-h-[22rem] sm:min-h-[24rem]">
          {/* Sidebar */}
          <div className="w-11 sm:w-12 shrink-0 border-r border-slate-100 bg-slate-50/80 py-3 flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-[10px] font-bold">LA</span>
            </div>
            {sidebarIcons.map((Icon, i) => (
              <div
                key={i}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  i === 0 ? "bg-orange-50 text-orange-600" : "text-slate-300",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="flex-1 p-3 sm:p-4 space-y-2.5 sm:space-y-3 min-w-0">
            {/* Top row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mb-1">Listing Score</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                      95<span className="text-sm sm:text-base font-semibold text-slate-400">/100</span>
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-600 mt-1">Excellent</p>
                  </div>
                  <ScoreRing value={95} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-800 mb-2">Top Opportunities</p>
                <div className="space-y-1.5">
                  {opportunities.map((o) => (
                    <div key={o.label} className="flex items-center justify-between gap-2">
                      <span className="text-[9px] sm:text-[10px] text-slate-600 truncate">{o.label}</span>
                      <span
                        className={cn(
                          "text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap",
                          o.tone === "high"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {o.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-2">
              {scoreCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-100 bg-white p-2 sm:p-2.5 shadow-sm">
                  <p className="text-[8px] sm:text-[9px] text-slate-500 truncate">{card.label}</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {card.score}
                    <span className="text-[9px] text-slate-400 font-medium">/100</span>
                  </p>
                  <Sparkline path={card.spark} />
                </div>
              ))}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-800 mb-2.5">Competitor Insights</p>
                <div className="flex items-end justify-between gap-1.5 sm:gap-2">
                  {competitors.map((c, i) => (
                    <div key={c.label} className="flex-1 text-center min-w-0">
                      <div
                        className={cn(
                          "mx-auto w-full max-w-[3.5rem] aspect-[3/4] rounded-lg mb-1.5 border",
                          i === 0
                            ? "bg-gradient-to-b from-orange-100 to-amber-50 border-orange-200"
                            : "bg-gradient-to-b from-slate-100 to-slate-50 border-slate-200",
                        )}
                      />
                      <p className="text-[8px] sm:text-[9px] text-slate-500 truncate mb-0.5">{c.label}</p>
                      <span
                        className={cn(
                          "inline-block text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded",
                          c.tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600",
                        )}
                      >
                        {c.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-800 mb-1">Action Plan</p>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                    12 <span className="text-sm font-semibold text-slate-500">Tasks to improve</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold text-orange-600 border border-orange-200 bg-orange-50/50 rounded-lg py-2 hover:bg-orange-50 transition-colors"
                >
                  View Action Plan
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* subtle bottom chrome */}
        <div className="hidden sm:flex items-center justify-end gap-1 px-4 py-1.5 border-t border-slate-100 bg-slate-50/50 text-[9px] text-slate-400">
          <span>Dashboard preview</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
