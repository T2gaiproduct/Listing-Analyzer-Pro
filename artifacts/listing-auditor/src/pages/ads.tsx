import {
  Sparkles,
  Target,
  BarChart2,
  SlidersHorizontal,
  Wallet,
  ArrowRight,
  TrendingUp,
  Clock,
  Crosshair,
  Trophy,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const featureCards = [
  {
    icon: Target,
    title: "Smart Campaign Builder",
    desc: "Create AI-optimized PPC campaigns in minutes with the right targeting and structure.",
  },
  {
    icon: BarChart2,
    title: "Performance Analytics",
    desc: "Track ACOS, ROAS, clicks, impressions, and conversions in one unified dashboard.",
  },
  {
    icon: SlidersHorizontal,
    title: "Auto Bid Optimization",
    desc: "AI adjusts bids in real-time to maximize ROI and reduce wasted spend.",
  },
  {
    icon: Wallet,
    title: "Budget Intelligence",
    desc: "Get smart budget recommendations based on seasonality, competition, and your goals.",
  },
];

const benefits = [
  {
    icon: TrendingUp,
    title: "Increase ROAS",
    desc: "Optimize bids and targeting to get better returns.",
  },
  {
    icon: Clock,
    title: "Save Time",
    desc: "Automate campaign management and reporting.",
  },
  {
    icon: Crosshair,
    title: "Reduce Wasted Spend",
    desc: "AI-powered optimizations cut unnecessary costs.",
  },
  {
    icon: Trophy,
    title: "Stay Ahead",
    desc: "Beat the competition with smarter ad strategies.",
  },
];

function HeroIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-orange-50/60 border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] p-5">
        {/* Dashboard header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#232F3E] flex items-center justify-center">
              <span className="text-[#FF9900] font-bold text-sm leading-none">a</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-16 rounded-full bg-slate-200" />
              <div className="h-1.5 w-10 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>

        {/* Chart area */}
        <div className="rounded-xl bg-white border border-slate-100 p-4 mb-3 shadow-sm">
          <div className="flex items-end justify-between gap-1 h-20 mb-2">
            {[35, 50, 42, 65, 58, 78, 92].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/80 to-primary/40"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <svg viewBox="0 0 200 40" className="w-full h-8" aria-hidden="true">
            <polyline
              fill="none"
              stroke="hsl(28 100% 50%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,32 30,28 60,22 90,18 120,12 150,8 180,4 200,2"
            />
            <circle cx="200" cy="2" r="3" fill="hsl(28 100% 50%)" />
          </svg>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "ROAS", value: "4.2x" },
            { label: "ACOS", value: "18%" },
            { label: "Spend", value: "$2.4k" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-orange-100/80 border-4 border-white shadow-sm flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-full bg-white border border-orange-100 shadow-sm flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-primary/70" />
        </div>
      </div>
    </div>
  );
}

export default function AdsPage() {
  const { toast } = useToast();

  function handleEarlyAccess() {
    toast({
      title: "Coming Soon",
      description: "Manage Ads is launching soon. Join the waitlist and we'll notify you when it's ready!",
    });
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-6 sm:-my-8 min-h-[calc(100vh-64px)] flex flex-col bg-white">
      {/* Hero */}
      <section className="px-6 sm:px-10 lg:px-14 pt-10 pb-12 lg:pb-16">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-orange-50 text-primary text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              Coming Soon
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-foreground tracking-tight leading-[1.15] mb-4">
              Manage Ads Smarter.
              <br />
              Grow Faster.
            </h1>

            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
              Run smarter Amazon PPC campaigns with AI-driven targeting, bidding, and budget
              management — all in one place.
            </p>
          </div>

          <HeroIllustration />
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 sm:px-10 lg:px-14 pb-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {featureCards.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[180px]"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{desc}</p>
              <div className="mt-4 flex justify-end">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits banner */}
      <section className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-6 sm:px-10 lg:px-14 py-12 lg:py-14">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-10">
            Smarter PPC. Better Results.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-white/80 border border-orange-100 flex items-center justify-center mb-3 shadow-sm">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 lg:px-14 py-12 lg:py-16 flex flex-col items-center bg-white flex-1">
        <button
          onClick={handleEarlyAccess}
          className="inline-flex items-center gap-2.5 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3.5 rounded-xl shadow-md shadow-orange-200/50 transition-all text-sm sm:text-base"
        >
          Get Early Access
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          Join the waitlist and be the first to try it out!
        </p>
      </section>
    </div>
  );
}
