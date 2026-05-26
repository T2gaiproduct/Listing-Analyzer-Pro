import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Search, TrendingUp, Zap, ShieldCheck, BarChart3, ArrowRight,
  CheckCircle2, Star, ChevronDown, ChevronUp, Image, Users,
  LayoutDashboard, MousePointerClick, Sparkles, Wand2, ClipboardCheck, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { NewsletterSection } from "@/components/newsletter";
import { ExitPopup } from "@/components/exit-popup";
import { PromoBanner } from "@/components/promo-banner";
import { SeoHead } from "@/components/seo-head";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  { icon: BarChart3, title: "AI-Powered Scoring", description: "Get instant scores for your title, bullet points, images, and keywords — benchmarked against best practices." },
  { icon: TrendingUp, title: "Competitor Comparison", description: "Analyze rival listings side-by-side and uncover gaps to outrank them in search results." },
  { icon: Zap, title: "Content Generator", description: "Let AI rewrite your titles, bullets, and keywords with data-driven optimizations built in." },
  { icon: ShieldCheck, title: "Image Studio", description: "Generate professional product images with style presets, aspect ratios, and AI-guided editing." },
  { icon: Image, title: "AI Image Generation", description: "Create main images, lifestyle shots, and infographics — all Amazon-compliant and conversion-ready." },
  { icon: Users, title: "Team Collaboration", description: "Invite your team, assign roles, and manage shared audits across your entire catalog." },
];

const benefits = [
  "Audit unlimited listings",
  "AI scoring across 4 key categories",
  "Competitor analysis & comparison",
  "AI-generated titles & bullet points",
  "Professional image generation",
  "Version history for images",
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Amazon FBA Seller",
    quote: "My overall listing score jumped from 48 to 87 in one afternoon. Sales increased 34% within the first month.",
    rating: 5,
    asin: "Electronics",
  },
  {
    name: "Daniel K.",
    role: "Brand Manager, SportsCo",
    quote: "The competitor analysis alone is worth the subscription. I found 3 keyword gaps my competitors were exploiting and fixed them in minutes.",
    rating: 5,
    asin: "Sporting Goods",
  },
  {
    name: "Priya R.",
    role: "eCommerce Agency Owner",
    quote: "We manage 200+ listings for clients. ListingAuditor cut our optimization workflow from days to hours. The white-label reports are a huge client win.",
    rating: 5,
    asin: "Agency",
  },
  {
    name: "James T.",
    role: "Private Label Seller",
    quote: "The AI image studio is incredible. We replaced our $800 product shoot with AI-generated images that look just as professional.",
    rating: 5,
    asin: "Home & Kitchen",
  },
];

const trustedBrands = ["TechNova", "SunriseGoods", "Clarity Agency", "ProSeller", "BrandLoft", "NexCart"];

interface LandingPlan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  creditAllocations: Record<string, number> | null;
  teamMembers: number;
  tag: string | null;
  isHighlighted: boolean;
  features: string[];
  excludedFeatures: string[];
}

const badgeColorClass: Record<string, string> = {
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-50 text-slate-700",
};

const faqs = [
  { q: "Is there a free trial?", a: "Starter, Growth, and Pro plans include a 14-day free trial. No credit card required to start. Enterprise plans are custom — contact us for a demo." },
  { q: "How does scoring work?", a: "Our AI analyzes your listing across 4 dimensions (title, bullets, images, keywords) and scores each 0–100 based on Amazon best practices and competitive benchmarks." },
  { q: "Can I audit competitor listings?", a: "Absolutely. Enter any ASIN to see a full audit and compare it side-by-side with your own listings." },
  { q: "What are AI credits?", a: "AI credits power content generation — rewriting titles, bullet points, and keywords. Each AI credit covers one generation operation." },
  { q: "Do I need an Amazon account to use this?", a: "No. You can paste your listing data manually or enter an ASIN. We don't require API access to your Amazon Seller Central account." },
];

function LandingPricingSection() {
  const { data: dbPlans = [] } = useQuery<LandingPlan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const plans = dbPlans
    .sort((a, b) => a.priceMonthly - b.priceMonthly)
    .slice(0, 4);

  const gridCols = plans.length <= 3 ? `lg:grid-cols-${plans.length}` : "lg:grid-cols-4";

  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="max-w-6xl mx-auto text-center">
        <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">Pricing</Badge>
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h2>
        <p className="text-slate-500 mb-10">Start free. Scale as you grow. No hidden fees.</p>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-6 mb-10`}>
          {plans.map((p) => {
            const a = p.creditAllocations ?? {};
            const totalCredits = (a.audit ?? 0) + (a.content ?? 0) + (a.images ?? 0) + (a.ebc ?? 0) + (a.competitors ?? 0);

            const activityRows = [
              { label: "Audit", value: a.audit, color: "text-orange-700" },
              { label: "Text Content", value: a.content, color: "text-blue-700" },
              { label: "Images", value: a.images, color: "text-purple-700" },
              { label: "A+ / EBC Content", value: a.ebc, color: "text-emerald-700" },
              { label: "Competitors Analysis", value: a.competitors, color: "text-slate-700" },
              { label: "Team Members", value: a.teamMembers, color: "text-slate-700" },
            ];

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-6 border text-left flex flex-col ${
                  p.isHighlighted
                    ? "border-orange-400 bg-white shadow-xl shadow-orange-100 relative"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {p.isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">{p.tag || "Most Popular"}</span>
                  </div>
                )}
                <p className="font-bold text-slate-900 mb-1">{p.name}</p>
                <p className="text-sm text-slate-500 mb-3">{p.description}</p>
                <p className="text-4xl font-extrabold text-slate-900 mb-4">
                  ${p.priceMonthly}<span className="text-sm font-normal text-slate-400">/mo</span>
                </p>

                <div className="space-y-2.5 flex-1 mb-5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wide border-b border-slate-100 pb-1.5">
                    <span>Item</span>
                    <span>Credits / Mo</span>
                  </div>
                  {activityRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{row.label}</span>
                      <span className={`font-semibold ${row.color}`}>
                        {typeof row.value === "number" ? row.value.toLocaleString() : "\u2014"}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Total Monthly Credits</span>
                      <span className="font-bold text-slate-900">{totalCredits.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant={p.isHighlighted ? "default" : "outline"}
                  className={`w-full ${p.isHighlighted ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : ""}`}
                  asChild
                >
                  <Link href="/pricing">
                    Choose Plan
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PromoBanner />
      <PublicNav />

      {/* SEO */}
      <SeoHead
        title="AI-Powered Amazon Listing Optimization"
        description="Audit your Amazon listings in seconds with AI. Get scores, fix issues, outrank competitors, and generate winning content."
      />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-50 via-white to-orange-50 px-6 py-24 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(255,128,0,0.06),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-8 border-orange-200 text-orange-600 bg-orange-50 px-4 py-1.5">
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            AI-powered Amazon listing optimization
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Turn average listings into{" "}
            <span className="text-primary">top performers</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Audit your Amazon listings in seconds. Get AI scores, fix issues, outrank competitors, and generate winning content — all in one place.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center mb-12">
            <Button size="lg" className="text-base px-8 shadow-md" asChild>
              <Link href="/sign-up">
                Start your free audit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <Link href="/features">See all features</Link>
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {benefits.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-slate-100 bg-slate-50 px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Trusted by sellers worldwide</p>
          <div className="flex flex-wrap justify-center gap-8">
            {trustedBrands.map((b) => (
              <span key={b} className="text-slate-400 font-bold text-sm tracking-wide">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">Features</Badge>
            <h2 className="text-4xl font-bold text-slate-900 mb-3">Everything you need to dominate search</h2>
            <p className="text-slate-500 max-w-lg mx-auto">One platform for auditing, optimizing, comparing, and generating — no more switching between tools.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" asChild>
              <Link href="/features">See full feature breakdown <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Product Screenshot / Dashboard Mockup */}
      <section className="px-6 pb-6 -mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-500 ml-2">listingauditor.com/dashboard</span>
            </div>
            <div className="p-6 md:p-10">
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Overall Score</p>
                  <p className="text-3xl font-bold text-green-400">87<span className="text-lg text-slate-500">/100</span></p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Title Score</p>
                  <p className="text-3xl font-bold text-orange-400">92<span className="text-lg text-slate-500">/100</span></p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Keyword Score</p>
                  <p className="text-3xl font-bold text-blue-400">78<span className="text-lg text-slate-500">/100</span></p>
                </div>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-slate-200">AI Suggestions</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    Add "dishwasher safe" to title — high-search keyword with low competition
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    Expand bullet point #2 with a benefit-focused opening
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    Add lifestyle image showing the product in use
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works / Workflow */}
      <section className="px-6 py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Optimize in 3 simple steps</h2>
            <p className="text-slate-500 max-w-lg mx-auto">No complex setup. Paste a URL and let AI do the heavy lifting.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: MousePointerClick, title: "Paste Your Listing", desc: "Enter any Amazon product URL or ASIN. Our system instantly fetches the listing data." },
              { step: "02", icon: Wand2, title: "AI Analyzes Everything", desc: "Our AI scores your title, bullets, images, and keywords against proven best practices." },
              { step: "03", icon: ClipboardCheck, title: "Get Actionable Fixes", desc: "Receive specific suggestions, rewritten content, and a competitor gap analysis." },
            ].map((s) => (
              <div key={s.step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-5">
                  <s.icon className="w-7 h-7 text-orange-600" />
                </div>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Step {s.step}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-2 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After demo */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">Results</Badge>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">See the AI difference</h2>
          <p className="text-slate-500 mb-10">Real listing data — optimized in seconds.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
            <div className="bg-white border border-red-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Before</span>
                <span className="bg-red-100 text-red-600 text-sm font-bold px-2.5 py-0.5 rounded-full">Score: 34</span>
              </div>
              <p className="text-slate-700 font-semibold text-sm mb-2">Title</p>
              <p className="text-slate-500 text-sm">Blue Dog Bowl Stainless Steel Non Slip</p>
            </div>
            <div className="bg-white border border-green-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-green-600 uppercase tracking-wide">After AI Optimization</span>
                <span className="bg-green-100 text-green-700 text-sm font-bold px-2.5 py-0.5 rounded-full">Score: 89</span>
              </div>
              <p className="text-slate-700 font-semibold text-sm mb-2">Title</p>
              <p className="text-slate-700 text-sm font-medium">Stainless Steel Dog Bowl — Non-Slip Base, Dishwasher Safe, 32oz for Medium & Large Dogs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">Reviews</Badge>
            <h2 className="text-3xl font-bold text-slate-900">Loved by Amazon sellers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex gap-1 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-xs">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-slate-400 text-xs">{t.role}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">{t.asin}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <LandingPricingSection />


      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-orange-200 text-orange-600 bg-orange-50">FAQ</Badge>
            <h2 className="text-3xl font-bold text-slate-900">Common questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-slate-900 text-sm pr-4">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <NewsletterSection />

      {/* Final CTA */}
      <section className="bg-slate-900 px-6 py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,128,0,0.1),transparent_70%)]" />
        <div className="relative">
          <h2 className="text-4xl font-extrabold text-white mb-4">Ready to optimize your listings?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto text-lg">
            Join sellers using AI to score, fix, and grow their Amazon presence. Start with a 14-day free trial on any paid plan.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-10 shadow-lg text-base" asChild>
              <Link href="/sign-up">
                Create your free account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8" asChild>
              <Link href="/contact">Book a demo</Link>
            </Button>
          </div>
          <p className="text-slate-500 text-sm mt-6">No credit card required · Cancel anytime</p>
        </div>
      </section>

      <PublicFooter />
      <ExitPopup />
    </div>
  );
}
