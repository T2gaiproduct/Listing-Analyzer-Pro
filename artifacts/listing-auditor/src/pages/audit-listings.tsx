import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Loader2,
  TrendingUp,
  Trophy,
  Star,
  ArrowUpRight,
  Target,
  Sparkles,
  History,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import {
  useFetchListing,
  useCreateAudit,
  useListAudits,
  getGetAuditStatsQueryKey,
  getGetRecentsQueryKey,
  getListAuditsQueryKey,
  type Audit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { parseListingFetchInput } from "@/lib/listing-input";
import { inferAuditSourceType } from "@/lib/product-mappers";
import { PROJECT_ORIGIN_AUDIT_LISTING } from "@/lib/audit-project-origin";
import { appendReturnTo } from "@/lib/navigation-return";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AUDIT_HISTORY_LIMIT = 25;

function auditHistoryLabel(audit: Audit): string {
  return audit.productName?.trim() || audit.projectName?.trim() || "Untitled listing";
}

function auditHistorySubtitle(audit: Audit): string {
  const asin = audit.asin?.trim();
  if (asin && !asin.includes(":")) return asin;
  if (audit.category?.trim()) return audit.category.trim();
  return "Listing audit";
}

function auditScoreBadgeClass(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function AuditListingHistory() {
  const { data: audits, isLoading, isError } = useListAudits();

  const items = useMemo(() => {
    if (!audits?.length) return [];
    return audits
      .filter((audit) => inferAuditSourceType(audit) === "audit")
      .slice(0, AUDIT_HISTORY_LIMIT);
  }, [audits]);

  if (isError) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Could not load audit history. Refresh the page to try again.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2 justify-center sm:justify-start">
        <History className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your audit history
        </h2>
      </div>

      <Card className="border border-border/60 shadow-none overflow-hidden">
        {isLoading ? (
          <CardContent className="p-0 divide-y divide-border/60">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-14 rounded-full hidden sm:block" />
              </div>
            ))}
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="py-10 px-6 text-center">
            <p className="text-sm font-medium text-foreground">No listing audits yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Click Audit Listing to analyze a product page. Completed audits will appear here.
            </p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((audit) => {
              const href = appendReturnTo(`/audits/${audit.id}`, "/audit-listings");
              const showScore = audit.status === "complete" && audit.overallScore > 0;
              const dateRaw = audit.updatedAt || audit.createdAt;
              const dateLabel = dateRaw
                ? format(new Date(dateRaw), "MMM d, yyyy")
                : "—";

              return (
                <li key={audit.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 sm:px-6 sm:py-4 hover:bg-orange-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <FileSearch className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-orange-600 transition-colors">
                        {auditHistoryLabel(audit)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {auditHistorySubtitle(audit)}
                        <span className="mx-1.5 text-border">·</span>
                        {dateLabel}
                        {audit.status === "pending" && (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            <span className="text-amber-600">Analyzing…</span>
                          </>
                        )}
                        {audit.status === "failed" && (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            <span className="text-rose-600">Failed</span>
                          </>
                        )}
                      </p>
                    </div>
                    {showScore ? (
                      <span
                        className={cn(
                          "text-sm font-bold border rounded-full w-10 h-10 flex items-center justify-center shrink-0",
                          auditScoreBadgeClass(audit.overallScore),
                        )}
                      >
                        {audit.overallScore}
                      </span>
                    ) : audit.status === "pending" ? (
                      <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                    ) : null}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function AuditListings() {
  const [url, setUrl] = useState("");
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
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
                productDescription: listing.description ?? undefined,
                importAttributes: listing.attributes ?? [],
                sourceListingUrl: trimmed.startsWith("http") ? trimmed : undefined,
                projectOrigin: PROJECT_ORIGIN_AUDIT_LISTING,
              } as Parameters<typeof createAudit.mutate>[0]["data"],
            },
            {
              onSuccess: (audit) => {
                if (audit.status === "failed") {
                  void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey() });
                  toast({
                    title: "Audit failed",
                    description: "Could not analyze the listing. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }
                queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
                queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
                refreshCreditBalances(queryClient);
                setAuditDialogOpen(false);
                setUrl("");
                navigate(`/audits/${audit.id}?returnTo=/audit-listings`);
              },
              onError: () => {
                void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey() });
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
            title: isBlocked ? "We couldn't access this product page automatically." : isNotFound ? "Product not found" : "Failed to fetch listing",
            description: isBlocked
              ? "Some stores restrict automated access. You can connect your marketplace account or enter the product details manually to continue."
              : msg,
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="w-full min-w-0 py-12 space-y-16 animate-in fade-in duration-500">
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

      <div className="max-w-3xl mx-auto text-center space-y-3">
        <Button
          type="button"
          size="lg"
          onClick={() => setAuditDialogOpen(true)}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-10 h-12 text-base font-semibold gap-2 shadow-md"
        >
          <FileSearch className="w-5 h-5" />
          Audit Listing
        </Button>
        <p className="text-sm text-muted-foreground">
          Works with <span className="text-orange-500 font-medium">Amazon</span>,{" "}
          <span className="text-orange-500 font-medium">Shopify</span>, and{" "}
          <span className="text-orange-500 font-medium">WooCommerce</span> product pages
        </p>
      </div>

      <Dialog
        open={auditDialogOpen}
        onOpenChange={(open) => {
          if (!isLoading) setAuditDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Listing</DialogTitle>
            <DialogDescription>
              Paste a product page URL or Amazon ASIN to run an AI listing audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Paste any product page URL or Amazon ASIN..."
              disabled={isLoading}
              autoFocus
            />
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !url.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11 font-semibold gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Now
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuditListingHistory />
    </div>
  );
}
