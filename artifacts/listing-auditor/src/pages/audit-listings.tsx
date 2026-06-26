import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { useFetchListing, useCreateAudit, getGetAuditStatsQueryKey, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const stores = [
  { label: "Amazon", letter: "A", color: "bg-orange-500" },
  { label: "Shopify", letter: "S", color: "bg-green-600" },
  { label: "Walmart", letter: "W", color: "bg-blue-600" },
  { label: "eBay", letter: "e", color: "bg-red-500" },
  { label: "Etsy", letter: "E", color: "bg-orange-400" },
];

const features = [
  {
    title: "Listing Score",
    desc: "Overall quality rating 1–100",
  },
  {
    title: "Top Fixes",
    desc: "Highest-impact improvements",
  },
  {
    title: "Competitor Intel",
    desc: "Benchmark against top sellers",
  },
  {
    title: "Action Plan",
    desc: "Step-by-step improvement roadmap",
  },
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

    const isUrl = trimmed.startsWith("http");
    fetchListing.mutate(
      { data: isUrl ? { url: trimmed } : { asin: trimmed } },
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
                navigate(`/audits/${audit.id}`);
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
          const isBlocked = msg.toLowerCase().includes("captcha") || msg.toLowerCase().includes("blocked");
          const isNotFound = msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("404");
          toast({
            title: isBlocked ? "Amazon blocked the request" : isNotFound ? "Product not found" : "Failed to fetch listing",
            description: isBlocked
              ? "Amazon blocks automated fetches from cloud servers. Try using the New Audit page to paste your listing manually."
              : msg,
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-16">
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
                  ? "Pulling your product data"
                  : "Scoring title, bullets, images, and keywords"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Heading */}
      <h1 className="text-4xl font-bold text-foreground text-center tracking-tight mb-3">
        Analyze your listing
      </h1>
      <p className="text-muted-foreground text-center text-base mb-10">
        Paste any product page URL for an instant AI audit
      </p>

      {/* URL input */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Paste any product page URL..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none min-w-0"
            disabled={isLoading}
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !url.trim()}
            className="flex-shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-semibold text-sm px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Works with Amazon, Shopify, Walmart, eBay, and most product pages
        </p>
      </div>

      {/* Works with any store */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          Works with any store
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stores.map(({ label, letter, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card text-sm font-medium text-foreground"
            >
              <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold ${color}`}>
                {letter}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* What you get */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          What you get
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {features.map(({ title, desc }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-xl px-4 py-5 text-center"
            >
              <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
