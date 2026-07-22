import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, PenLine, Box, Video, BarChart3, Megaphone,
  Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowRight, Upload, Wand2, Image, Download, Globe, Play,
  TrendingUp, Users, Search, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { ExitPopup } from "@/components/exit-popup";
import { PageSeo } from "@/components/page-seo";
import { HeroSlider } from "@/components/hero-slider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";
import { cmsText, cmsEnabled, resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { parseFeatureBullets } from "@/lib/features-cms";
import { FeatureCardMockup } from "@/components/feature-card-mockups";
import { heroAutoplayEnabled, heroAutoplayIntervalMs, heroSlideIsVideo, parseHeroSlides } from "@/lib/hero-slides";
import { portfolioItemIndices } from "@/lib/portfolio-cms";
import { parseTutorialItems } from "@/lib/tutorials-cms";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DbPlan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  teamMembers: number;
  creditAllocations: Record<string, number> | null;
  features: string[];
  excludedFeatures: string[];
  tag: string | null;
  sortOrder: number;
  isHighlighted: boolean;
  ctaText: string | null;
  isTrial: boolean;
  trialDays: number;
}

const FEATURE_ICONS = [ClipboardList, PenLine, Box, Video, Megaphone];
const HERO_STAT_ICONS = [BarChart3, Image, TrendingUp, Users];
const WORKFLOW_ICONS = [Upload, Search, Wand2, Image, Download, Globe];

type FeatureItem = {
  index: number;
  icon: typeof ClipboardList;
  title: string;
  description: string;
  href: string;
  bullets: string[];
  image: string;
};

type PortfolioItem = {
  id: string;
  title: string;
  brand: string;
  image: string;
  badge: string | null;
  square: boolean;
};

type TutorialItem = {
  title: string;
  duration: string;
  image: string;
  videoUrl: string;
};

function useLandingCmsData() {
  const cms = useHomepageCmsContext();

  const features: FeatureItem[] = [1, 2, 3, 4, 5].map((i) => ({
    index: i,
    icon: FEATURE_ICONS[i - 1],
    title: cmsText(cms, `features.item${i}_title`),
    description: cmsText(cms, `features.item${i}_desc`),
    href: cmsText(cms, `features.item${i}_href`),
    bullets: parseFeatureBullets(cms, i),
    image: resolveCmsAssetUrl(cmsText(cms, `features.item${i}_image`), basePath),
  })).filter((f) => f.title);

  const heroSlides = parseHeroSlides(cms);

  const heroStats = [1, 2, 3, 4].map((i) => ({
    icon: HERO_STAT_ICONS[i - 1],
    value: cmsText(cms, `hero.stat${i}_value`),
    label: cmsText(cms, `hero.stat${i}_label`),
  }));

  const portfolioItems: PortfolioItem[] = portfolioItemIndices().flatMap((i) => {
    const title = cmsText(cms, `portfolio.item${i}_title`);
    const imagePath = cmsText(cms, `portfolio.item${i}_image`);
    if (!title || !imagePath) return [];
    const fit = cmsText(cms, `portfolio.item${i}_fit`);
    const badge = cmsText(cms, `portfolio.item${i}_badge`);
    return [{
      id: `portfolio-${i}`,
      title,
      brand: cmsText(cms, `portfolio.item${i}_brand`),
      image: resolveCmsAssetUrl(imagePath, basePath),
      badge: badge || null,
      square: fit === "cover",
    }];
  });

  const workflowSteps = [1, 2, 3, 4, 5, 6].map((i) => ({
    icon: WORKFLOW_ICONS[i - 1],
    label: cmsText(cms, `workflow.step${i}_label`),
  }));

  const workflowMetrics = [1, 2, 3, 4].map((i) => ({
    label: cmsText(cms, `workflow.metric${i}_label`),
    value: cmsText(cms, `workflow.metric${i}_value`),
  }));

  const tutorialPreviews: TutorialItem[] = parseTutorialItems(cms).map((item) => {
    const customImage = item.image?.trim() ? resolveCmsAssetUrl(item.image, basePath) : "";
    const youtubeThumb = item.videoUrl ? youtubeThumbnailUrl(item.videoUrl) : null;
    return {
      title: item.title,
      duration: item.duration,
      image: customImage || youtubeThumb || "",
      videoUrl: item.videoUrl,
    };
  });

  return { cms, features, heroSlides, heroStats, portfolioItems, workflowSteps, workflowMetrics, tutorialPreviews };
}

function FeatureCard({
  index,
  icon: Icon,
  title,
  description,
  href,
  bullets,
  image,
  className,
}: FeatureItem & { className?: string }) {
  const number = String(index).padStart(2, "0");

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <span className="text-[11px] font-bold text-orange-500 tracking-wide">{number}</span>

        <div className="flex justify-center my-3 sm:my-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" strokeWidth={1.75} />
          </div>
        </div>

        <h3 className="text-center font-bold text-slate-900 text-sm sm:text-[15px] leading-snug mb-2">
          {title}
        </h3>
        <p className="text-center text-xs sm:text-sm text-slate-500 leading-relaxed mb-4">
          {description}
        </p>

        {bullets.length > 0 && (
          <ul className="space-y-2 mb-4">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                <Check className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4">
        {image ? (
          <img
            src={image}
            alt={`${title} preview`}
            className="w-full rounded-lg object-contain max-h-36 sm:max-h-40"
            loading="lazy"
          />
        ) : (
          <FeatureCardMockup index={index} />
        )}
      </div>
    </Link>
  );
}

function FeatureCardsRow({ features }: { features: FeatureItem[] }) {
  return (
    <>
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-4 w-max pb-2">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} className="w-[min(82vw,280px)] snap-center shrink-0" />
          ))}
        </div>
      </div>
      <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-5 gap-4 xl:gap-5">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </>
  );
}

function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  const [selected, setSelected] = useState<PortfolioItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="group relative aspect-square rounded-2xl sm:rounded-[1.25rem] overflow-hidden border border-slate-200/80 bg-slate-50 shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-zoom-in text-left"
            aria-label={`View ${item.title} — ${item.brand}`}
          >
            <img
              src={item.image}
              alt={`${item.title} — ${item.brand}`}
              className={cn(
                "absolute inset-0 w-full h-full object-center pointer-events-none",
                item.square ? "object-cover" : "object-contain p-2 sm:p-3",
              )}
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={index < 4 ? "high" : "auto"}
            />
            {item.badge && (
              <span className="absolute top-3 right-3 z-10 bg-pink-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                {item.badge}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pt-10 pb-3 sm:px-4 sm:pb-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
              <p className="font-semibold text-white text-sm leading-tight">{item.title}</p>
              <p className="text-xs text-white/80 mt-0.5">{item.brand}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {selected ? `${selected.title} — ${selected.brand}` : "Portfolio image"}
          </DialogTitle>
          {selected && (
            <>
              <div className="relative bg-slate-100 flex items-center justify-center max-h-[80vh]">
                <img
                  src={selected.image}
                  alt={`${selected.title} — ${selected.brand}`}
                  className="max-h-[80vh] w-full object-contain"
                />
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-white">
                <p className="font-semibold text-slate-900">{selected.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selected.brand}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TutorialCard({
  title,
  duration,
  image,
  videoUrl,
  layout = "grid",
}: TutorialItem & { layout?: "grid" | "carousel" }) {
  const [open, setOpen] = useState(false);
  const isCarousel = layout === "carousel";
  const embedUrl = videoUrl ? youtubeEmbedUrl(videoUrl) : null;
  const hasVideo = Boolean(videoUrl?.trim());

  if (hasVideo && embedUrl && !isCarousel) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm h-full flex flex-col">
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4">
          <p className="font-semibold text-slate-800 text-base">{title}</p>
          {duration && <p className="text-sm text-slate-500 mt-0.5">{duration}</p>}
        </div>
      </div>
    );
  }

  const thumbnail = (
    <div className={cn("relative overflow-hidden bg-slate-900", isCarousel ? "h-52 sm:h-56" : "h-44 sm:h-48 lg:h-52")}>
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover opacity-90" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform",
            isCarousel ? "w-16 h-16" : "w-14 h-14",
          )}
        >
          <Play className={cn("text-orange-600 ml-0.5", isCarousel ? "w-7 h-7" : "w-6 h-6")} />
        </div>
      </div>
      {duration && (
        <span
          className={cn(
            "absolute bottom-3 right-3 bg-black/60 text-white font-medium px-2 py-1 rounded",
            isCarousel ? "text-sm" : "text-xs",
          )}
        >
          {duration}
        </span>
      )}
    </div>
  );

  if (hasVideo) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full w-full text-left"
        >
          {thumbnail}
          <p className={cn("font-semibold text-slate-800", isCarousel ? "p-5 text-lg" : "p-4 text-base")}>{title}</p>
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <div className="aspect-video w-full bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-full flex items-center justify-center text-sm font-medium text-white hover:bg-slate-900 transition-colors px-4 text-center"
                >
                  Open video in new tab
                </a>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200">
              <p className="font-semibold text-slate-900">{title}</p>
              {duration && <p className="text-sm text-slate-500 mt-0.5">{duration}</p>}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Link
      href="/tutorials"
      className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
    >
      {thumbnail}
      <p className={cn("font-semibold text-slate-800", isCarousel ? "p-5 text-lg" : "p-4 text-base")}>{title}</p>
    </Link>
  );
}

function TutorialCarousel({ tutorials }: { tutorials: TutorialItem[] }) {
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
        className="absolute left-0 top-[7rem] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous tutorial"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-[7rem] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Next tutorial"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 overscroll-x-contain"
      >
        {tutorials.map((t) => (
          <div key={t.title} className="snap-start shrink-0 w-[min(92vw,22rem)] sm:w-[24rem]">
            <TutorialCard {...t} layout="carousel" />
          </div>
        ))}
      </div>
    </div>
  );
}

function planDisplayFeatures(p: DbPlan): string[] {
  if (p.features.length > 0) return p.features;

  const a = p.creditAllocations ?? {};
  const derived = [
    a.audit != null || p.auditCredits ? `${a.audit ?? p.auditCredits} listing audits/mo` : null,
    a.content != null ? `${a.content} AI content credits` : p.aiCredits ? `${p.aiCredits} AI content credits` : null,
    a.images != null || p.imageCredits ? `${a.images ?? p.imageCredits} image generation credits` : null,
    a.ebc != null ? `${a.ebc} A+ / EBC content credits` : null,
    a.competitors != null ? `${a.competitors} competitor analyses` : null,
    p.teamMembers > 1 ? `${p.teamMembers} team members` : null,
  ].filter((item): item is string => Boolean(item));

  return derived;
}

function planCta(p: DbPlan) {
  if (p.ctaText) return p.ctaText;
  if (p.isTrial && p.trialDays > 0) return `Start ${p.trialDays}-Day Trial`;
  return "Get Started";
}

function planCtaHref(p: DbPlan) {
  const cta = planCta(p).toLowerCase();
  if (cta.includes("contact")) return "/contact";
  return "/sign-up";
}

function sortPlansFromAdmin(plans: DbPlan[]) {
  return [...plans].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function landingPlanGridClass(count: number) {
  if (count <= 1) return "grid-cols-1 max-w-md mx-auto";
  if (count === 2) return "grid-cols-2 max-w-3xl mx-auto";
  if (count === 3) return "grid-cols-3";
  if (count === 4) return "grid-cols-2 xl:grid-cols-4";
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
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
        <Link href={planCtaHref(plan)}>{cta}</Link>
      </Button>
    </div>
  );
}

function PricingCarousel({ plans }: { plans: DbPlan[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const orderedPlans = sortPlansFromAdmin(plans);
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
  const cms = useHomepageCmsContext();
  const eyebrow = cmsText(cms, "pricing.eyebrow");
  const heading = cmsText(cms, "pricing.heading");
  const footerText = cmsText(cms, "pricing.footer_text");
  const footerLinkText = cmsText(cms, "pricing.footer_link_text");
  const footerLinkUrl = cmsText(cms, "pricing.footer_link_url");

  const { data: dbPlans = [], isLoading } = useQuery<DbPlan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/plans`);
      if (!res.ok) throw new Error("Failed to load plans");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const plans = sortPlansFromAdmin(dbPlans);

  if (isLoading) {
    return (
      <section id="pricing" className="bg-slate-50 px-4 sm:px-6 pt-4 pb-4 sm:pt-20 sm:pb-6 lg:pb-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-6">{heading}</h2>
          <p className="text-sm text-slate-500">Loading plans from Admin…</p>
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return (
      <section id="pricing" className="bg-slate-50 px-4 sm:px-6 pt-4 pb-4 sm:pt-20 sm:pb-6 lg:pb-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">{eyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{heading}</h2>
          <p className="text-slate-500">Plans are configured in Admin → Plans.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="bg-slate-50 px-4 sm:px-6 pt-4 pb-4 sm:pt-20 sm:pb-6 lg:pb-8">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">{eyebrow}</p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-6 sm:mb-10">{heading}</h2>
        <PricingCarousel plans={plans} />
        <div className={cn("hidden sm:grid gap-6 text-left", landingPlanGridClass(plans.length))}>
          {plans.map((p) => (
            <PricingPlanCard key={p.id} plan={p} />
          ))}
        </div>
        <p className="mt-5 sm:mt-6 text-sm text-slate-500">
          {footerText}{" "}
          <Link href={footerLinkUrl} className="text-orange-600 font-medium hover:underline">{footerLinkText}</Link>
        </p>
      </div>
    </section>
  );
}

interface DbFaq {
  id: number;
  question: string;
  answer: string;
}

interface DbTestimonial {
  id: number;
  name: string;
  role: string | null;
  company: string | null;
  avatar: string | null;
  content: string;
  rating: number | null;
  isVideo: boolean;
  videoUrl: string | null;
  sortOrder: number;
}

function LandingTestimonialsSection() {
  const cms = useHomepageCmsContext();
  const heading = cmsText(cms, "social.trusted_heading");

  const { data: items = [], isLoading } = useQuery<DbTestimonial[]>({
    queryKey: ["public-testimonials"],
    queryFn: () => fetch(`${basePath}/api/testimonials`).then((r) => r.json()).catch(() => []),
  });

  if (isLoading || items.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20 bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8 sm:mb-10">{heading}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {items.map((t) => {
            const embedUrl = t.isVideo && t.videoUrl ? youtubeEmbedUrl(t.videoUrl) : null;
            return (
            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm h-full flex flex-col">
              {t.isVideo && t.videoUrl && (
                <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-slate-900">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={`${t.name} video testimonial`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      href={t.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-full flex items-center justify-center text-sm font-medium text-white hover:bg-slate-800 transition-colors px-4 text-center"
                    >
                      Watch video testimonial
                    </a>
                  )}
                </div>
              )}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              {t.content && (
                <p className="text-sm text-slate-600 leading-relaxed mb-5 flex-1">"{t.content}"</p>
              )}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-auto">
                {t.avatar ? (
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{t.name}</p>
                  {(t.role || t.company) && (
                    <p className="text-xs text-slate-500 truncate">{[t.role, t.company].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LandingFaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const cms = useHomepageCmsContext();
  const heading = cmsText(cms, "faq.heading");

  const cmsFaqs = [1, 2, 3, 4, 5].flatMap((i) => {
    const q = cmsText(cms, `faq.q${i}`);
    if (!q) return [];
    return [{ id: i, q, a: cmsText(cms, `faq.a${i}`) }];
  });

  const { data: dbFaqs = [] } = useQuery<DbFaq[]>({
    queryKey: ["public-faqs"],
    queryFn: () => fetch(`${basePath}/api/faqs`).then((r) => r.json()).catch(() => []),
  });

  const faqs = dbFaqs.length > 0
    ? dbFaqs.map((f) => ({ id: f.id, q: f.question, a: f.answer }))
    : cmsFaqs;

  if (faqs.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 pt-4 pb-12 sm:pt-8 lg:pt-10 sm:pb-16 lg:pb-24 bg-white">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-6 sm:mb-10">{heading}</h2>
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
          {faqs.map((faq, i) => (
            <div key={faq.id}>
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
  const {
    cms,
    features,
    heroSlides,
    heroStats,
    portfolioItems,
    workflowSteps,
    workflowMetrics,
    tutorialPreviews,
  } = useLandingCmsData();

  const hasVideoHero = heroSlides.some(heroSlideIsVideo);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col overflow-x-clip">
      <PublicNav />

      <PageSeo
        pageSlug="home"
        title={cmsText(cms, "seo.title")}
        description={cmsText(cms, "seo.description")}
      />

      {cmsEnabled(cms, "hero") && (
      <section
        className={cn(
          "relative w-full overflow-hidden pb-10 sm:pb-16 lg:pb-20",
          hasVideoHero ? "pt-0" : "pt-6 sm:pt-12 lg:pt-16",
        )}
      >
        {!hasVideoHero && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,102,0,0.06),transparent_60%)]" />
        )}
        {heroSlides.length > 0 && (
          <div className="relative w-full">
            <HeroSlider
              slides={heroSlides}
              autoplay={heroAutoplayEnabled(cms)}
              autoplayIntervalMs={heroAutoplayIntervalMs(cms)}
            />
          </div>
        )}
        <div className="relative px-4 sm:px-6 lg:px-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-4 max-w-md mx-auto lg:max-w-none lg:mx-0 mt-8 sm:mt-10">
            {heroStats.map((s) => (
              <div key={s.label} className="flex flex-col items-center lg:items-start text-center lg:text-left min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-50 flex items-center justify-center mb-1.5 shrink-0">
                  <s.icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                </div>
                <p className="text-base sm:text-2xl lg:text-3xl font-bold text-slate-900 leading-tight">{s.value}</p>
                <p className="text-[10px] sm:text-sm text-slate-500 leading-snug mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {cmsEnabled(cms, "features") && features.length > 0 && (
      <section className="px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <p className="lg:hidden text-[11px] font-bold uppercase tracking-[0.14em] text-orange-500 mb-3">
              {cmsText(cms, "features.eyebrow")}
            </p>
            <h2 className="text-[1.65rem] sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-slate-900 leading-tight mb-3 max-w-4xl mx-auto">
              {cmsText(cms, "features.heading")}
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-2xl mx-auto">
              {cmsText(cms, "features.subheading")}
            </p>
          </div>

          <FeatureCardsRow features={features} />

          {cmsText(cms, "features.footer_text") && (
            <p className="mt-8 sm:mt-10 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-orange-500 shrink-0" strokeWidth={2.5} />
              <span>{cmsText(cms, "features.footer_text")}</span>
            </p>
          )}
        </div>
      </section>
      )}

      {cmsEnabled(cms, "portfolio") && portfolioItems.length > 0 && (
      <section className="px-4 sm:px-6 lg:px-10 pt-12 pb-4 sm:pt-20 sm:pb-6 lg:pb-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-3 sm:mb-4">
            {cmsText(cms, "portfolio.heading")}
          </h2>
          <p className="text-sm sm:text-base text-slate-500 text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            {cmsText(cms, "portfolio.subheading")}
          </p>
          <PortfolioGrid items={portfolioItems} />
          <div className="text-center mt-5 sm:mt-6">
            <Link href={cmsText(cms, "portfolio.cta_url")} className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              {cmsText(cms, "portfolio.cta_text")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {cmsEnabled(cms, "workflow") && (
      <section className="px-4 sm:px-6 lg:px-10 pt-4 pb-4 sm:pt-8 lg:pt-10 sm:pb-16 lg:pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-12 items-start">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 sm:mb-6 lg:mb-8 text-center lg:text-left">
                {cmsText(cms, "workflow.heading")}
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
                  <p className="text-xs font-bold text-red-500 uppercase mb-3">{cmsText(cms, "workflow.before_label")}</p>
                  <img
                    src={resolveCmsAssetUrl(cmsText(cms, "workflow.before_image"), basePath)}
                    alt=""
                    className="w-full h-24 sm:h-28 rounded-lg mb-3 object-cover bg-slate-100"
                    loading="lazy"
                  />
                  <p className="text-3xl font-extrabold text-slate-800">{cmsText(cms, "workflow.before_score")}<span className="text-lg text-slate-400">/100</span></p>
                  <div className="mt-2 flex items-end gap-0.5 h-8">
                    {[40, 55, 45, 50, 42, 48].map((h, i) => (
                      <div key={i} className="flex-1 bg-red-200 rounded-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white border-2 border-orange-200 rounded-2xl p-4 sm:p-5 shadow-lg relative">
                  <span className="absolute -top-2.5 left-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{cmsText(cms, "workflow.after_badge")}</span>
                  <p className="text-xs font-bold text-orange-600 uppercase mb-3 mt-1">{cmsText(cms, "workflow.after_label")}</p>
                  <img
                    src={resolveCmsAssetUrl(cmsText(cms, "workflow.after_image"), basePath)}
                    alt=""
                    className="w-full h-24 sm:h-28 rounded-lg mb-3 object-cover"
                    loading="lazy"
                  />
                  <p className="text-3xl font-extrabold text-orange-600">{cmsText(cms, "workflow.after_score")}<span className="text-lg text-slate-400">/100</span></p>
                  <div className="mt-2 flex items-end gap-0.5 h-8">
                    {[55, 62, 70, 78, 88, 96].map((h, i) => (
                      <div key={i} className="flex-1 bg-orange-400 rounded-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
                <p className="text-sm font-bold text-slate-900 mb-3 sm:mb-4 text-center sm:text-left">{cmsText(cms, "workflow.metrics_heading")}</p>
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
      )}

      {cmsEnabled(cms, "tutorials") && tutorialPreviews.length > 0 && (
      <section className="px-4 sm:px-6 lg:px-10 pt-4 pb-4 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-6 sm:mb-10">
            {cmsText(cms, "tutorials.heading")}
          </h2>
          <TutorialCarousel tutorials={tutorialPreviews} />
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {tutorialPreviews.map((t) => (
              <TutorialCard key={t.title} {...t} />
            ))}
          </div>
          <div className="text-center mt-5 sm:mt-8">
            <Link href={cmsText(cms, "tutorials.cta_url")} className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
              {cmsText(cms, "tutorials.cta_text")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {cmsEnabled(cms, "pricing") && <LandingPricingSection />}
      {cmsEnabled(cms, "social") && <LandingTestimonialsSection />}
      {cmsEnabled(cms, "faq") && <LandingFaqSection />}

      {cmsEnabled(cms, "cta") && (
      <section className="px-4 sm:px-6 py-16 sm:py-20 text-center bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            {cmsText(cms, "cta.heading")}
          </h2>
          <p className="text-slate-500 mb-8">
            {cmsText(cms, "cta.subheading")}
          </p>
          <div className="flex flex-row items-stretch justify-center gap-2 sm:gap-3">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 px-3 sm:px-8 flex-1 sm:flex-none min-w-0 text-sm sm:text-base h-11 sm:h-12" asChild>
              <Link href={cmsText(cms, "cta.primary_url")}>{cmsText(cms, "cta.primary_text")}</Link>
            </Button>
            <Button size="lg" variant="outline" className="px-3 sm:px-8 flex-1 sm:flex-none min-w-0 gap-1.5 sm:gap-2 text-sm sm:text-base h-11 sm:h-12" asChild>
              <Link href={cmsText(cms, "cta.secondary_url")} className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                <Play className="w-4 h-4 shrink-0" />
                <span className="truncate">{cmsText(cms, "cta.secondary_text")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
      )}

      <PublicFooter />
      <ExitPopup />
    </div>
  );
}
