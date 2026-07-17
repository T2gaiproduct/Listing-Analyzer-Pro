import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  FileSearch, Palette, Play, BarChart3, Megaphone,
  Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowRight, Upload, Sparkles, Wand2, Image, Download, Globe,
  TrendingUp, Users, Search, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { ExitPopup } from "@/components/exit-popup";
import { PromoBanner } from "@/components/promo-banner";
import { SeoHead } from "@/components/seo-head";
import { MarketplaceLogos } from "@/components/marketplace-logos";
import { HeroDashboardMockup } from "@/components/hero-dashboard-mockup";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DbPlan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  excludedFeatures: string[];
  tag: string | null;
  isHighlighted: boolean;
  ctaText: string | null;
  isTrial: boolean;
  trialDays: number;
}

interface DbFaq {
  id: number;
  question: string;
  answer: string;
}

const heroStats = [
  { icon: BarChart3, value: "50M+", label: "Listings Analyzed" },
  { icon: Image, value: "15M+", label: "Assets Generated" },
  { icon: TrendingUp, value: "97%", label: "Optimization Score" },
  { icon: Users, value: "5000+", label: "Brands Trust Us" },
];

const featureColumns = [
  {
    icon: FileSearch,
    title: "Audit Listings",
    description: "Score titles, bullets, images, and keywords against proven marketplace best practices.",
    href: "/audit-listings",
  },
  {
    icon: Sparkles,
    title: "Build Your Brand",
    description: "Generate optimized copy, A+ content, and brand assets powered by AI.",
    href: "/audits/new",
  },
  {
    icon: Palette,
    title: "Create Graphics",
    description: "Produce studio-quality product images, infographics, and lifestyle shots.",
    href: "/projects",
  },
  {
    icon: Play,
    title: "Create Videos",
    description: "Turn product photos into scroll-stopping video creatives for ads and listings.",
    href: "/videos",
  },
  {
    icon: Megaphone,
    title: "Manage Ads",
    description: "Plan, launch, and optimize sponsored campaigns from one dashboard.",
    href: "/ads",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  layout = "grid",
}: (typeof featureColumns)[number] & { layout?: "grid" | "carousel" }) {
  const isCarousel = layout === "carousel";

  return (
    <Link
      href={href}
      className={cn(
        "group block h-full transition-shadow",
        isCarousel
          ? "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md"
          : "text-center",
      )}
    >
      <div className={cn(isCarousel ? "flex items-start gap-3.5" : "flex flex-col items-center")}>
        <div
          className={cn(
            "rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-orange-50 transition-colors",
            isCarousel ? "w-10 h-10" : "w-12 h-12 mb-4",
          )}
        >
          <Icon className={cn("text-slate-700 group-hover:text-orange-600 transition-colors", isCarousel ? "w-5 h-5" : "w-6 h-6")} />
        </div>
        <div className={cn("min-w-0", isCarousel ? "text-left" : "")}>
          <h3 className={cn("font-semibold text-slate-900", isCarousel ? "mb-1 text-sm" : "mb-2")}>{title}</h3>
          <p className={cn("text-slate-500 leading-relaxed", isCarousel ? "text-xs" : "text-sm")}>{description}</p>
        </div>
      </div>
    </Link>
  );
}

function FeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const cardWidth = scrollRef.current?.firstElementChild?.clientWidth ?? 300;
    scrollRef.current?.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="relative sm:hidden px-2">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous feature"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Next feature"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 overscroll-x-contain"
      >
        {featureColumns.map((f) => (
          <div key={f.title} className="snap-start shrink-0 w-[min(85vw,20rem)]">
            <FeatureCard {...f} layout="carousel" />
          </div>
        ))}
      </div>
    </div>
  );
}

const portfolioItems = [
  { title: "Product Images", brand: "Home & Kitchen", image: `${basePath}/portfolio/product-hydration-kit.png`, badge: null },
  { title: "A+ Content", brand: "TIMEWEAR", image: `${basePath}/portfolio/aplus-timewear-hero.png`, badge: null },
  { title: "Lifestyle Images", brand: "TIMEWEAR", image: `${basePath}/portfolio/lifestyle-timewear.png`, badge: "NEW" },
  { title: "Infographic", brand: "Home & Kitchen", image: `${basePath}/portfolio/infographic-water-bottle.png`, badge: null },
  { title: "Size Chart", brand: "TIMEWEAR", image: `${basePath}/portfolio/size-chart-timewear.png`, badge: null },
];

const workflowSteps = [
  { icon: Upload, label: "Upload" },
  { icon: Search, label: "Analyze" },
  { icon: Wand2, label: "Optimize" },
  { icon: Image, label: "Generate Assets" },
  { icon: Download, label: "Export" },
  { icon: Globe, label: "Publish" },
];

const workflowMetrics = [
  { label: "Click Through Rate", value: "+34%" },
  { label: "Conversion Rate", value: "+27%" },
  { label: "Organic Rank", value: "+18%" },
  { label: "Sales Growth", value: "+40%" },
];

const tutorialPreviews = [
  { title: "Getting Started", duration: "5:32", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=240&fit=crop&q=80" },
  { title: "Audit Your Listing", duration: "7:15", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop&q=80" },
  { title: "Optimize Content", duration: "6:48", image: "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=400&h=240&fit=crop&q=80" },
  { title: "Create A+ Content", duration: "8:20", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=240&fit=crop&q=80" },
  { title: "Manage Ads", duration: "9:05", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=240&fit=crop&q=80" },
];

function PortfolioCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const cardWidth = scrollRef.current?.firstElementChild?.clientWidth ?? 256;
    scrollRef.current?.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="relative px-2 sm:px-10">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-lg border border-slate-200 hidden sm:flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-lg border border-slate-200 hidden sm:flex items-center justify-center hover:bg-slate-50"
        aria-label="Next"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 overscroll-x-contain"
      >
        {portfolioItems.map((item) => (
          <div
            key={item.title}
            className="snap-start shrink-0 w-[min(72vw,16rem)] sm:w-64 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm"
          >
            <div className="h-36 sm:h-40 relative overflow-hidden bg-slate-100">
              <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
              {item.badge && (
                <span className="absolute top-3 right-3 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.brand}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TutorialCard({ title, duration, image }: (typeof tutorialPreviews)[number]) {
  return (
    <Link
      href="/tutorials"
      className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
    >
      <div className="h-32 sm:h-36 relative overflow-hidden bg-slate-900">
        <img src={image} alt="" className="w-full h-full object-cover opacity-90" loading="lazy" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Play className="w-5 h-5 text-orange-600 ml-0.5" />
          </div>
        </div>
        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {duration}
        </span>
      </div>
      <p className="p-3 text-sm font-semibold text-slate-800">{title}</p>
    </Link>
  );
}

function TutorialCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const cardWidth = scrollRef.current?.firstElementChild?.clientWidth ?? 280;
    scrollRef.current?.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="relative sm:hidden px-2">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-[5.5rem] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous tutorial"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-[5.5rem] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Next tutorial"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 overscroll-x-contain"
      >
        {tutorialPreviews.map((t) => (
          <div key={t.title} className="snap-start shrink-0 w-[min(78vw,18rem)]">
            <TutorialCard {...t} />
          </div>
        ))}
      </div>
    </div>
  );
}

function planDisplayFeatures(p: DbPlan) {
  return p.features.length > 0
    ? p.features
    : ["Listing audits", "AI content credits", "Image generation", "Competitor analysis"];
}

function planCta(p: DbPlan) {
  return p.ctaText ?? (p.isTrial && p.trialDays > 0 ? `Start ${p.trialDays}-Day Trial` : "Start Free Trial");
}

function sortPlansForCarousel(plans: DbPlan[]) {
  return [...plans].sort((a, b) => {
    if (a.isHighlighted && !b.isHighlighted) return -1;
    if (!a.isHighlighted && b.isHighlighted) return 1;
    return a.priceMonthly - b.priceMonthly;
  });
}

function PricingPlanCard({ plan, compact = false }: { plan: DbPlan; compact?: boolean }) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const highlighted = plan.isHighlighted;
  const features = planDisplayFeatures(plan);
  const cta = planCta(plan);
  const featureLimit = 5;
  const hasMoreFeatures = compact && features.length > featureLimit;
  const visibleFeatures = hasMoreFeatures && !showAllFeatures ? features.slice(0, featureLimit) : features;

  return (
    <div
      className={cn(
        "rounded-2xl flex flex-col bg-white border relative h-full text-left",
        compact ? "p-5" : "p-6 sm:p-8",
        highlighted ? "border-orange-400 shadow-xl shadow-orange-100" : "border-slate-200 shadow-sm",
      )}
    >
      {highlighted && plan.tag && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
            {plan.tag}
          </span>
        </div>
      )}
      <p className="font-bold text-lg text-slate-900">{plan.name}</p>
      <p className={cn("text-sm text-slate-500 mt-1", compact ? "mb-3 line-clamp-2" : "mb-4")}>{plan.description}</p>
      <p className={cn("font-extrabold text-slate-900", compact ? "text-3xl mb-4" : "text-4xl mb-6")}>
        ${plan.priceMonthly}
        <span className="text-base font-normal text-slate-400">/mo</span>
      </p>
      <ul className={cn("space-y-2.5 flex-1", compact ? "mb-5" : "space-y-3 mb-8")}>
        {visibleFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
        {(plan.excludedFeatures ?? []).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-400 line-through">
            <span className="w-4 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {hasMoreFeatures && !showAllFeatures && (
        <button
          type="button"
          onClick={() => setShowAllFeatures(true)}
          className="text-sm font-medium text-orange-600 hover:text-orange-700 mb-4 text-left"
        >
          +{features.length - featureLimit} more features
        </button>
      )}
      <Button
        className={cn("w-full mt-auto", highlighted ? "bg-orange-500 hover:bg-orange-600" : "")}
        variant={highlighted ? "default" : "outline"}
        asChild
      >
        <Link href="/sign-up">{cta}</Link>
      </Button>
    </div>
  );
}

function PricingCarousel({ plans }: { plans: DbPlan[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const orderedPlans = sortPlansForCarousel(plans);
  const scroll = (dir: -1 | 1) => {
    const cardWidth = scrollRef.current?.firstElementChild?.clientWidth ?? 320;
    scrollRef.current?.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="relative sm:hidden px-2">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous plan"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Next plan"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 overscroll-x-contain items-stretch"
      >
        {orderedPlans.map((p) => (
          <div key={p.id} className="snap-center shrink-0 w-[min(88vw,22rem)] flex">
            <PricingPlanCard plan={p} compact />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400 text-center">Swipe to compare plans</p>
    </div>
  );
}

function LandingPricingSection() {
  const { data: dbPlans = [] } = useQuery<DbPlan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const plans = [...dbPlans].sort((a, b) => a.priceMonthly - b.priceMonthly).slice(0, 3);

  if (plans.length === 0) {
    return (
      <section id="pricing" className="bg-slate-50 px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">Simple, Transparent Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Choose the plan that fits your growth</h2>
          <p className="text-slate-500">Plans are configured in Admin → Plans.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="bg-slate-50 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">Simple, Transparent Pricing</p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-6 sm:mb-10">Choose the plan that fits your growth</h2>
        <PricingCarousel plans={plans} />
        <div className={cn(
          "hidden sm:grid gap-6 text-left",
          plans.length === 1 ? "grid-cols-1 max-w-md mx-auto" : plans.length === 2 ? "grid-cols-2 max-w-3xl mx-auto" : "grid-cols-3",
        )}>
          {plans.map((p) => (
            <PricingPlanCard key={p.id} plan={p} />
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-500">
          Need a custom plan?{" "}
          <Link href="/contact" className="text-orange-600 font-medium hover:underline">Contact us →</Link>
        </p>
      </div>
    </section>
  );
}

function LandingFaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { data: dbFaqs = [] } = useQuery<DbFaq[]>({
    queryKey: ["public-faqs"],
    queryFn: () => fetch(`${basePath}/api/faqs`).then((r) => r.json()).catch(() => []),
  });

  const faqs = dbFaqs.map((f) => ({ q: f.question, a: f.answer }));

  if (faqs.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24 bg-white">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8 sm:mb-10">Frequently Asked Questions</h2>
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-slate-900 text-sm sm:text-base pr-4">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 sm:px-6 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col overflow-x-hidden">
      <PromoBanner />
      <PublicNav />

      <SeoHead
        title="AI-Powered Listing Optimization"
        description="Audit listings, create stunning content, manage ads and dominate every marketplace."
      />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-10 pt-8 sm:pt-12 lg:pt-16 pb-12 sm:pb-16 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,102,0,0.06),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5 mb-5 sm:mb-6">
              <Zap className="w-3 h-3" />
              AI-Powered Listing Optimization
            </p>
            <h1 className="page-hero-title font-extrabold tracking-tight text-slate-900 mb-4 sm:mb-5">
              Optimize Listings. Increase Sales.{" "}
              <span className="text-orange-500">Grow Faster.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mb-5 sm:mb-6 max-w-xl mx-auto lg:mx-0">
              Audit listings, create stunning content, manage ads and dominate every marketplace.
            </p>
            <MarketplaceLogos className="mb-6 sm:mb-8" />
            <div className="flex flex-row items-stretch gap-2 sm:gap-3 justify-center lg:justify-start mb-8 sm:mb-10">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-8 flex-1 sm:flex-none min-w-0 text-sm sm:text-base h-11 sm:h-12" asChild>
                <Link href="/sign-up">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-3 sm:px-8 flex-1 sm:flex-none min-w-0 gap-1.5 sm:gap-2 text-sm sm:text-base h-11 sm:h-12" asChild>
                <Link href="/features" className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                  <Play className="w-4 h-4 shrink-0" />
                  <span className="truncate">See How It Works</span>
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {heroStats.map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <s.icon className="w-4 h-4 text-orange-500 mx-auto lg:mx-0 mb-1" />
                  <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 w-full">
            <HeroDashboardMockup />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-6 sm:mb-12">
            Everything you need to win on marketplaces
          </h2>
          <FeatureCarousel />
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 sm:gap-8">
            {featureColumns.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="px-4 sm:px-6 lg:px-10 pt-12 pb-4 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-6 sm:mb-10">
            Real results we&apos;ve created for brands like yours
          </h2>
          <PortfolioCarousel />
          <div className="text-center mt-5 sm:mt-8">
            <Link href="/features" className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              View More Works <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="px-4 sm:px-6 lg:px-10 pt-4 pb-12 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-12 items-start">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 sm:mb-8 text-center lg:text-left">
                From Upload to Publish in 6 Simple Steps
              </h2>
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
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
            </div>

            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-red-100 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <p className="text-xs font-bold text-red-500 uppercase mb-3">Before</p>
                  <img
                    src="https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=200&fit=crop&q=80"
                    alt=""
                    className="w-full h-24 sm:h-28 rounded-lg mb-3 object-cover bg-slate-100"
                    loading="lazy"
                  />
                  <p className="text-3xl font-extrabold text-slate-800">62<span className="text-lg text-slate-400">/100</span></p>
                  <div className="mt-2 flex items-end gap-0.5 h-8">
                    {[40, 55, 45, 50, 42, 48].map((h, i) => (
                      <div key={i} className="flex-1 bg-red-200 rounded-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white border-2 border-orange-200 rounded-2xl p-4 sm:p-5 shadow-lg relative">
                  <span className="absolute -top-2.5 left-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">AI Optimized</span>
                  <p className="text-xs font-bold text-orange-600 uppercase mb-3 mt-1">After</p>
                  <img
                    src="https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=200&fit=crop&q=80"
                    alt=""
                    className="w-full h-24 sm:h-28 rounded-lg mb-3 object-cover"
                    loading="lazy"
                  />
                  <p className="text-3xl font-extrabold text-orange-600">96<span className="text-lg text-slate-400">/100</span></p>
                  <div className="mt-2 flex items-end gap-0.5 h-8">
                    {[55, 62, 70, 78, 88, 96].map((h, i) => (
                      <div key={i} className="flex-1 bg-orange-400 rounded-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
                <p className="text-sm font-bold text-slate-900 mb-3 sm:mb-4 text-center sm:text-left">Better Listings. Better Results.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                  {workflowMetrics.map((m) => (
                    <div key={m.label} className="text-center sm:text-left">
                      <p className="text-lg sm:text-xl font-extrabold text-orange-600">{m.value}</p>
                      <p className="text-xs text-slate-500">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorials */}
      <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-8 sm:mb-10">
            Learn how to get the most out of Listing Auditor
          </h2>
          <TutorialCarousel />
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tutorialPreviews.map((t) => (
              <TutorialCard key={t.title} {...t} />
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/tutorials" className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              View All Tutorials <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <LandingPricingSection />
      <LandingFaqSection />

      {/* Pre-footer CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 text-center bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Ready to build better listings and grow your business?
          </h2>
          <p className="text-slate-500 mb-8">
            Join thousands of brands already winning with AI.
          </p>
          <div className="flex flex-row items-stretch justify-center gap-2 sm:gap-3">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 px-3 sm:px-8 flex-1 sm:flex-none min-w-0 text-sm sm:text-base h-11 sm:h-12" asChild>
              <Link href="/sign-up">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="px-3 sm:px-8 flex-1 sm:flex-none min-w-0 gap-1.5 sm:gap-2 text-sm sm:text-base h-11 sm:h-12" asChild>
              <Link href="/features" className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                <Play className="w-4 h-4 shrink-0" />
                <span className="truncate">See How It Works</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
      <ExitPopup />
    </div>
  );
}
