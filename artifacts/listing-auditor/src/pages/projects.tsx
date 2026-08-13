import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Wand2, Image as ImageIcon, Sparkles, Shield, Zap, Clock, Crown, TrendingUp, ArrowRight } from "lucide-react";

export default function ProjectsPage() {
  const [, nav] = useLocation();

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="relative bg-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-border overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, rgba(251,191,100,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 5%, rgba(255,237,213,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute top-20 right-40 text-amber-400/60">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="absolute top-32 right-24 text-amber-400/60">
          <Sparkles className="w-3 h-3" />
        </div>
        <div className="absolute top-8 right-64 text-orange-300/40 text-xs">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="4" cy="4" r="1.5" fill="currentColor"/><circle cx="16" cy="4" r="1.5" fill="currentColor"/><circle cx="28" cy="4" r="1.5" fill="currentColor"/><circle cx="40" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="28" cy="16" r="1.5" fill="currentColor"/><circle cx="40" cy="16" r="1.5" fill="currentColor"/><circle cx="4" cy="28" r="1.5" fill="currentColor"/><circle cx="16" cy="28" r="1.5" fill="currentColor"/><circle cx="28" cy="28" r="1.5" fill="currentColor"/><circle cx="40" cy="28" r="1.5" fill="currentColor"/></svg>
        </div>

        <div className="relative flex flex-col md:flex-row items-start justify-between gap-6 md:gap-8 w-full min-w-0">
          {/* Left Content */}
          <div className="w-full min-w-0 max-w-lg">
            {/* AI-Powered Badge */}
            <div className="inline-flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-amber-200/60 dark:border-amber-500/30 rounded-full px-3 py-1.5 mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">AI-Powered</span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-3 sm:mb-4 break-words">
              Create Professional{" "}
              <span className="text-orange-500">Product Graphics</span>{" "}
              Using AI
            </h1>

            {/* Subheadline */}
            <p className="text-muted-foreground text-sm md:text-base mb-6 sm:mb-8 max-w-full">
              Generate stunning lifestyle images and feature graphics for your products in minutes using AI.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3 mb-6 sm:mb-8">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Wand2 className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Generate images using AI</p>
                  <p className="text-xs text-muted-foreground">Create high-quality product images in seconds</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ImageIcon className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Lifestyle & Studio Shots</p>
                  <p className="text-xs text-muted-foreground">From clean backgrounds to real-life scenes</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-200/60 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Feature Graphics</p>
                  <p className="text-xs text-muted-foreground">Highlight key benefits and product features</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-7 py-3 h-auto min-h-11 text-sm font-semibold shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/30"
              onClick={() => nav("/projects/create")}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Images
            </Button>

            {/* Trust Badges */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-4 sm:mt-5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-4 h-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                </div>
                No credit card required
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-4 h-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                </div>
                Images in seconds
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-4 h-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                </div>
                Your data is secure
              </div>
            </div>
          </div>

          {/* Right Content - Hero Image */}
          <div className="hidden md:block flex-shrink-0 relative">
            {/* AI Generated Badge */}
            <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-amber-200/60 dark:border-amber-500/30 rounded-full px-3 py-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">AI Generated</span>
            </div>

            {/* Floating Generate Card */}
            <div className="absolute top-24 -left-12 z-10 bg-card border border-amber-200/60 dark:border-amber-500/30 rounded-xl px-3 py-2 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Generate</p>
                  <p className="text-[10px] text-muted-foreground">Images</p>
                </div>
              </div>
            </div>

            {/* Arrow from card to product */}
            <svg className="absolute top-36 left-12 w-16 h-12 z-10" viewBox="0 0 64 48">
              <path d="M 8 8 Q 24 8 32 24 Q 40 40 56 32" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="text-orange-400" markerEnd="url(#arrowhead)" />
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-orange-400" />
                </marker>
              </defs>
            </svg>

            {/* Product Image */}
            <div className="w-72 h-80 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-200/40 dark:border-amber-500/20 flex items-center justify-center overflow-hidden shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop"
                alt="AI Generated Product"
                className="w-48 h-48 object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Designed for eCommerce Success</p>
              <p className="text-xs text-muted-foreground mt-0.5">Boost conversions with professional product visuals that build trust and drive sales.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:gap-6 md:gap-8 lg:gap-12">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-foreground">2x</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Higher Conversion</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/30 flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-foreground">10x</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Faster Creation</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/30 flex items-center justify-center">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-foreground">100%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Unique & Custom</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
