import { Link } from "wouter";
import { Search, TrendingUp, Zap, ShieldCheck, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BarChart3,
    title: "AI-Powered Scoring",
    description: "Get instant scores for your title, bullet points, images, and keywords — all benchmarked against best practices.",
  },
  {
    icon: TrendingUp,
    title: "Competitor Comparison",
    description: "Analyze rival listings side-by-side and uncover gaps to outrank them in search results.",
  },
  {
    icon: Zap,
    title: "Content Generator",
    description: "Let AI rewrite your titles, bullets, and keywords with data-driven optimizations built in.",
  },
  {
    icon: ShieldCheck,
    title: "Image Studio",
    description: "Generate professional product images with style presets, aspect ratios, and AI-guided editing.",
  },
];

const benefits = [
  "Audit unlimited listings",
  "AI scoring across 4 key categories",
  "Competitor analysis & comparison",
  "AI-generated titles & bullet points",
  "Professional image generation",
  "Version history for images",
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Search className="w-5 h-5 text-primary" />
          <span>Listing<span className="text-primary">Auditor</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <Zap className="w-3.5 h-3.5" />
          AI-powered Amazon listing optimization
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.1] mb-6">
          Turn average listings into{" "}
          <span className="text-primary">top performers</span>
        </h1>

        <p className="text-xl text-slate-500 max-w-xl mb-10 leading-relaxed">
          Audit your Amazon listings in seconds. Get AI scores, fix issues, outrank competitors, and generate winning content — all in one place.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Button size="lg" className="text-base px-8 shadow-md" asChild>
            <Link href="/sign-up">
              Start your free audit
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>

        {/* Benefit pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {benefits.map((b) => (
            <span key={b} className="flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Everything you need to dominate search
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 border-t border-orange-100 px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to optimize your listings?</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">Join sellers using AI to score, fix, and grow their Amazon presence.</p>
        <Button size="lg" className="px-10 shadow-md text-base" asChild>
          <Link href="/sign-up">
            Create your free account
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-8 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} ListingAuditor. All rights reserved.
      </footer>
    </div>
  );
}
