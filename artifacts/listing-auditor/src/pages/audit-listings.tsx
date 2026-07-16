import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, TrendingUp, DollarSign, Trophy, Star, Check, ArrowUpRight, Link as LinkIcon, Users, BarChart3, LineChart, Target, Sparkles, Wrench, Zap } from "lucide-react";
import { useFetchListing, useCreateAudit, getGetAuditStatsQueryKey, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { parseListingFetchInput } from "@/lib/listing-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const stores = [
  { name: "Amazon" },
  { name: "Shopify" },
  { name: "Walmart" },
  { name: "eBay" },
  { name: "Etsy" },
  { name: "+ More" },
];

const features = [
  {
    icon: Star,
    title: "Listing Score",
    desc: "Overall quality rating from 1-100",
    chart: true,
  },
  {
    icon: Wrench,
    title: "Top Fixes",
    desc: "Personalized, high-impact improvements",
    items: ["Optimize your title", "Improve main images", "Enhance bullet points", "Strengthen description"],
  },
  {
    icon: Users,
    title: "Competitor Intel",
    desc: "Benchmark against top-performing sellers",
    bars: true,
  },
  {
    icon: Zap,
    title: "Action Plan",
    desc: "Step-by-step roadmap to grow your sales",
    steps: ["Prioritize high-impact fixes", "Implement changes", "Track performance & grow"],
  },
];

const stats = [
  { icon: BarChart3, value: "2M+", label: "Listings Analyzed" },
  { icon: Users, value: "150K+", label: "Sellers Helped" },
  { icon: DollarSign, value: "$250M+", label: "Revenue Impacted" },
];

export default function AuditListings() {
  const [url, setUrl] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchListing = useFetchListing();
  const createAudit = useCreateAudit();

  const isLoading = fetchListing.isPending || createAudit.isPending;

  function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed || isLoading) return;

    let fetchPayload: { asin?: string; url?: string };
    try {
      fetchPayload = parseListingFetchInput(trimmed);
    } catch (err) {
      toast({
        title: "Invalid input",
        description: err instanceof Error ? err.message : "Enter a product URL or Amazon ASIN.",
        variant: "destructive",
      });
      return;
    }

    fetchListing.mutate(
      { data: fetchPayload },
      {
        onSuccess: (listing) => {
          createAudit.mutate(
            {
              data: {
                productName: listing.productName,
                asin: listing.asin,
                category: listing.category ?? undefined,
                title: listing.title,
                bulletPoints: listing.bulletPoints,
                imageUrls: listing.imageUrls,
                targetKeywords: listing.targetKeywords,
              },
            },
            {
              onSuccess: (audit) => {
                queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
                queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
                refreshCreditBalances(queryClient);
                navigate(`/audits/${audit.id}?returnTo=/audit-listings`);
              },
              onError: () => {
                toast({
                  title: "Audit failed",
                  description: "Could not analyze the listing. Please try again.",
                  variant: "destructive",
                });
              },
            }
          );
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const lower = msg.toLowerCase();
          const isBlocked = lower.includes("captcha") || lower.includes("blocked") || lower.includes("automated");
          const isNotFound = lower.includes("not found") || lower.includes("404");
          toast({
            title: isBlocked ? "Store blocked the request" : isNotFound ? "Product not found" : "Failed to fetch listing",
            description: isBlocked
              ? "Some stores block automated fetches from cloud servers. Try again later or use Build Your Brand to enter listing details manually."
              : msg,
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16 animate-in fade-in duration-500">
      {/* Full-screen loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 w-80">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base">
                {fetchListing.isPending ? "Fetching listing…" : "Analyzing with AI…"}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {fetchListing.isPending
                  ? "Pulling product data from the store page"
                  : "Scoring title, bullets, images, and keywords"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Analyze your
            <br />
            <span className="text-orange-500">product listing</span>
            <br />
            using AI
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Get an instant AI audit of any product page to boost rankings, increase conversions, and outperform the competition.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Boost Rankings</p>
                <p className="text-xs text-muted-foreground">Improve search visibility</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Increase Sales</p>
                <p className="text-xs text-muted-foreground">Optimize for conversions</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Outsmart Competitors</p>
                <p className="text-xs text-muted-foreground">Benchmark & win</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Score Card */}
        <div className="relative">
          {/* Decorative sparkles */}
          <div className="absolute -top-4 -right-4">
            <Sparkles className="w-6 h-6 text-orange-300" />
          </div>
          <div className="absolute top-8 -right-6">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
          </div>
          <div className="absolute -top-2 left-1/4">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-300" />
          </div>

          <Card className="border border-border/60 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Listing Score</span>
                <span className="text-xs text-muted-foreground">82 /100</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="82 100" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-foreground">82</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Great</div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Title", score: 85 },
                  { label: "Images", score: 90 },
                  { label: "Bullet Points", score: 78 },
                  { label: "Description", score: 80 },
                  { label: "Reviews", score: 75 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">{item.label}</span>
                    <Progress value={item.score} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{item.score}/100</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>4.6 (2,873)</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-orange-500">
                <ArrowUpRight className="w-3 h-3" />
                <span>Top 5% in Electronics</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* URL Input */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          <LinkIcon className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Paste any product page URL or Amazon ASIN..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none min-w-0"
            disabled={isLoading}
          />
          <Button
            onClick={handleAnalyze}
            disabled={isLoading || !url.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-6 h-11 font-semibold flex items-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Analyze Now</>
            )}
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-3">
          Works with <span className="text-orange-500 font-medium">Amazon</span>,{" "}
          <span className="text-orange-500 font-medium">Shopify</span>,{" "}
          <span className="text-orange-500 font-medium">Walmart</span>,{" "}
          <span className="text-orange-500 font-medium">eBay</span>,{" "}
          <span className="text-orange-500 font-medium">Etsy</span>, and most product pages
        </p>
      </div>

      {/* Works With Any Store */}
      <div className="space-y-5">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Works With Any Store
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stores.map(({ name }) => (
            <div
              key={name}
              className="px-5 py-2 rounded-full text-sm font-semibold bg-card border border-border text-foreground hover:border-orange-300 transition-colors"
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* What You Get */}
      <div className="space-y-5">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          What You Get
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Listing Score */}
          <Card className="border border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                  <Star className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Listing Score</p>
                  <p className="text-xs text-muted-foreground">Overall quality rating from 1-100</p>
                </div>
              </div>
              <div className="h-16 relative">
                <svg className="w-full h-full" viewBox="0 0 200 60">
                  <polyline
                    points="10,45 50,40 90,25 130,20 170,15"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="45" r="3" fill="#8b5cf6" />
                  <circle cx="50" cy="40" r="3" fill="#8b5cf6" />
                  <circle cx="90" cy="25" r="3" fill="#8b5cf6" />
                  <circle cx="130" cy="20" r="3" fill="#8b5cf6" />
                  <circle cx="170" cy="15" r="3" fill="#8b5cf6" />
                  <text x="165" y="12" fontSize="10" fill="#8b5cf6" fontWeight="bold">82</text>
                </svg>
                <div className="absolute left-0 bottom-0 text-[10px] text-muted-foreground">65</div>
              </div>
            </CardContent>
          </Card>

          {/* Top Fixes */}
          <Card className="border border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Top Fixes</p>
                  <p className="text-xs text-muted-foreground">Personalized, high-impact improvements</p>
                </div>
              </div>
              <div className="space-y-2">
                {["Optimize your title", "Improve main images", "Enhance bullet points", "Strengthen description"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-orange-600" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Competitor Intel */}
          <Card className="border border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Competitor Intel</p>
                  <p className="text-xs text-muted-foreground">Benchmark against top-performing sellers</p>
                </div>
              </div>
              <div className="flex items-end gap-1 h-16">
                <div className="w-1/6 h-6 bg-slate-100 rounded-t" />
                <div className="w-1/6 h-10 bg-slate-100 rounded-t" />
                <div className="w-1/6 h-5 bg-slate-100 rounded-t" />
                <div className="w-1/6 h-14 bg-orange-500 rounded-t" />
                <div className="w-1/6 h-8 bg-slate-100 rounded-t" />
                <div className="w-1/6 h-4 bg-slate-100 rounded-t" />
              </div>
            </CardContent>
          </Card>

          {/* Action Plan */}
          <Card className="border border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Action Plan</p>
                  <p className="text-xs text-muted-foreground">Step-by-step roadmap to grow your sales</p>
                </div>
              </div>
              <div className="space-y-2">
                {["Prioritize high-impact fixes", "Implement changes", "Track performance & grow"].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trust Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left - Stats */}
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-foreground">Trusted by sellers worldwide</h3>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-slate-100 border-2 border-background flex items-center justify-center text-xs font-bold text-slate-600"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">+2K</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">4.9/5 from 2,500+ reviews</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">2M+</p>
                <p className="text-xs text-muted-foreground">Listings Analyzed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">150K+</p>
                <p className="text-xs text-muted-foreground">Sellers Helped</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">$250M+</p>
                <p className="text-xs text-muted-foreground">Revenue Impacted</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Testimonial */}
        <Card className="border border-border/60 bg-orange-50/30">
          <CardContent className="p-6 space-y-4">
            <div className="text-4xl text-orange-300 font-serif">&ldquo;</div>
            <p className="text-sm text-foreground leading-relaxed">
              ListingAudit helped us uncover critical issues we didn&apos;t even know were hurting our sales. Our conversion rate increased by 27% in just 30 days!
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                J
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Jessica M.</p>
                <p className="text-xs text-muted-foreground">Amazon Top Seller</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
