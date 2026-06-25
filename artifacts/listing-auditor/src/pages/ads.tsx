import { Megaphone, Sparkles, BarChart2, Target, RefreshCw, DollarSign } from "lucide-react";

const upcomingFeatures = [
  {
    icon: Target,
    title: "Smart Campaign Builder",
    desc: "Create PPC campaigns automatically optimized for your product and budget.",
  },
  {
    icon: BarChart2,
    title: "Performance Analytics",
    desc: "Track ACOS, ROAS, clicks, and conversions in one unified dashboard.",
  },
  {
    icon: RefreshCw,
    title: "Auto Bid Optimization",
    desc: "AI adjusts your bids in real time to maximize ROI and minimize wasted spend.",
  },
  {
    icon: DollarSign,
    title: "Budget Intelligence",
    desc: "Get spend recommendations based on seasonality, competition, and your goals.",
  },
];

export default function AdsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-16">
      {/* Icon + badge */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="w-10 h-10 text-primary" />
        </div>
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          Coming Soon
        </span>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-foreground text-center tracking-tight mb-3">
        Manage Ads
      </h1>
      <p className="text-muted-foreground text-center text-base max-w-md mb-12">
        Run smarter Amazon PPC campaigns with AI-driven targeting, bidding, and budget management — all in one place.
      </p>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {upcomingFeatures.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-card border border-border rounded-xl px-5 py-5 flex gap-4 items-start"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-muted-foreground text-center">
        We're working hard on this feature. Stay tuned for updates!
      </p>
    </div>
  );
}
