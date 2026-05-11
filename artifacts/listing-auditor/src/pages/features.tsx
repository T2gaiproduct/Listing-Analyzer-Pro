import { Link } from "wouter";
import {
  BarChart3, TrendingUp, Zap, Image, Edit3, Search, Users, Shield,
  ArrowRight, CheckCircle2, Star, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";

const mainFeatures = [
  {
    icon: BarChart3,
    color: "text-orange-500",
    bg: "bg-orange-50",
    title: "AI Listing Audit Engine",
    subtitle: "Score every element in seconds",
    description:
      "Our AI analyzes your Amazon listing across 4 key dimensions — title, bullet points, images, and keywords — and scores each 0–100 with specific, actionable improvement suggestions.",
    bullets: [
      "Title keyword density & readability analysis",
      "Bullet point persuasion & benefit scoring",
      "Image quality & compliance checking",
      "Keyword gap detection vs. top competitors",
    ],
    tag: "Core Feature",
  },
  {
    icon: TrendingUp,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "Competitor Analysis",
    subtitle: "See exactly how you stack up",
    description:
      "Add any competitor ASIN and get a side-by-side comparison of scores, keywords, and content quality. Find the gaps that are costing you ranking and revenue.",
    bullets: [
      "Side-by-side score comparison",
      "Keyword overlap & gap analysis",
      "Strengths & weaknesses breakdown",
      "Battle-tested competitive intelligence",
    ],
    tag: "Competitive Edge",
  },
  {
    icon: Zap,
    color: "text-purple-500",
    bg: "bg-purple-50",
    title: "AI Content Generator",
    subtitle: "Rewrite titles & bullets with one click",
    description:
      "Let AI generate fully optimized Amazon titles, bullet points, and keyword lists based on your product data, competitor insights, and current best practices.",
    bullets: [
      "SEO-optimized title generation",
      "Persuasive bullet point rewrites",
      "Backend keyword suggestions",
      "A+ content section drafts",
    ],
    tag: "AI Powered",
  },
  {
    icon: Image,
    color: "text-green-500",
    bg: "bg-green-50",
    title: "Image Studio",
    subtitle: "Professional Amazon images, AI-generated",
    description:
      "Generate main product images, lifestyle shots, and infographics using AI. Choose style presets, aspect ratios, and edit with natural language prompts. Full version history included.",
    bullets: [
      "Main, lifestyle & infographic generation",
      "Style presets (studio, outdoor, minimal…)",
      "Natural language image editing",
      "Full version history per image",
    ],
    tag: "Image AI",
  },
  {
    icon: Edit3,
    color: "text-pink-500",
    bg: "bg-pink-50",
    title: "Amazon SEO Optimization",
    subtitle: "Rank higher with data-driven keywords",
    description:
      "Get keyword recommendations ranked by search volume, relevance, and competition. Inject them directly into your AI-generated content for maximum ranking potential.",
    bullets: [
      "High-volume keyword discovery",
      "Keyword difficulty scoring",
      "Search term relevance analysis",
      "Direct content injection",
    ],
    tag: "SEO",
  },
  {
    icon: Users,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "Team Collaboration",
    subtitle: "Work together on listings",
    description:
      "Invite team members, assign roles, and manage shared audit projects. Perfect for agencies, brand managers, and in-house teams working across large catalogs.",
    bullets: [
      "Role-based access control",
      "Shared project workspaces",
      "Team activity tracking",
      "Per-member permission management",
    ],
    tag: "Teams",
  },
];

const miniFeatures = [
  { icon: Shield, title: "Credit-Based System", desc: "Flexible pay-as-you-grow credits for AI, images, and audits." },
  { icon: Search, title: "Multi-ASIN Support", desc: "Audit your entire catalog — not just one listing at a time." },
  { icon: Star, title: "Score Benchmarking", desc: "See how your scores compare to top sellers in your category." },
  { icon: ChevronRight, title: "Actionable Suggestions", desc: "Every low score comes with specific fixes, not just a number." },
];

const beforeAfter = [
  {
    label: "Title",
    before: "Blue Dog Bowl Stainless Steel Non Slip",
    beforeScore: 34,
    after: "Stainless Steel Dog Bowl — Non-Slip Base, Dishwasher Safe, 32oz for Medium & Large Dogs",
    afterScore: 89,
  },
  {
    label: "Bullet Point",
    before: "Good for dogs. Easy to clean. Comes in different sizes.",
    beforeScore: 28,
    after: "DISHWASHER SAFE & HYGIENIC — Made from food-grade 304 stainless steel, this bowl won't harbor bacteria or retain odors like plastic alternatives.",
    afterScore: 91,
  },
];

export default function Features() {
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-20 text-center">
        <Badge variant="outline" className="mb-6 border-orange-200 text-orange-600 bg-orange-50">
          Full feature breakdown
        </Badge>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4 max-w-3xl mx-auto">
          Everything Amazon sellers need to win
        </h1>
        <p className="text-xl text-slate-500 max-w-xl mx-auto mb-8">
          From initial audit to AI-generated content to professional images — one platform, zero guesswork.
        </p>
        <Button size="lg" className="px-8 shadow-md" asChild>
          <Link href="/sign-up">
            Try it free <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </section>

      {/* Main Features */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto space-y-20">
          {mainFeatures.map((f, i) => (
            <div
              key={f.title}
              className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-12 items-center`}
            >
              {/* Visual side */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`w-32 h-32 rounded-3xl ${f.bg} flex items-center justify-center mb-6 shadow-sm`}>
                  <f.icon className={`w-16 h-16 ${f.color}`} />
                </div>
                <Badge variant="outline" className="text-xs">{f.tag}</Badge>
              </div>

              {/* Content side */}
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{f.title}</h2>
                <p className="text-orange-500 font-semibold mb-4">{f.subtitle}</p>
                <p className="text-slate-500 mb-6 leading-relaxed">{f.description}</p>
                <ul className="space-y-2.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Before / After */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">See the difference AI makes</h2>
          <p className="text-slate-500 text-center mb-12">Real examples of listings before and after ListingAuditor optimization.</p>
          <div className="space-y-8">
            {beforeAfter.map((ex) => (
              <div key={ex.label} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Before — {ex.label}</span>
                    <span className="bg-red-100 text-red-600 text-sm font-bold px-2.5 py-0.5 rounded-full">Score: {ex.beforeScore}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{ex.before}</p>
                </div>
                <div className="bg-white border border-green-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">After AI Optimization — {ex.label}</span>
                    <span className="bg-green-100 text-green-700 text-sm font-bold px-2.5 py-0.5 rounded-full">Score: {ex.afterScore}</span>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed font-medium">{ex.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mini features */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Plus everything else you need</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {miniFeatures.map((f) => (
              <div key={f.title} className="flex gap-4 border border-slate-200 rounded-xl p-5">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{f.title}</p>
                  <p className="text-slate-500 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">Ready to transform your listings?</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">Start your first audit in under 2 minutes. No credit card required.</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8" asChild>
            <Link href="/sign-up">Start Free Trial</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8" asChild>
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
