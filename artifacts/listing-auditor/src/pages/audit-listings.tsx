import { useState } from "react";
import { useLocation } from "wouter";
import {
  TrendingUp,
  Trophy,
  Star,
  ArrowUpRight,
  ArrowRight,
  Target,
  Sparkles,
} from "lucide-react";
import {
  BuildBrandStartDrawer,
  type BuildBrandStartEntry,
} from "@/components/build-brand-start-drawer";
import { FeatureProductHistoryTable } from "@/components/feature-product-history-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HERO_PRIMARY_CTA_CLASS } from "@/lib/hero-primary-cta";
import {
  IMPORT_FROM_LINK_AUDIT_LISTINGS,
  importFromLinkPath,
} from "@/lib/import-from-link-return";
import {
  AUDIT_LISTING_HISTORY_FROM,
  auditListingExistingProductWorkflowSearch,
} from "@/lib/audit-in-detail-nav";
import { markAuditListingWorkflowIntent } from "@/lib/audit-listing-workflow";

export default function AuditListings() {
  const [startDrawerOpen, setStartDrawerOpen] = useState(false);
  const [, navigate] = useLocation();

  function handleStartChoice(entry: BuildBrandStartEntry) {
    setStartDrawerOpen(false);
    if (entry === "import-link") {
      navigate(importFromLinkPath(IMPORT_FROM_LINK_AUDIT_LISTINGS));
      return;
    }
    if (entry === "existing") {
      markAuditListingWorkflowIntent();
      navigate(`/audits/workflow${auditListingExistingProductWorkflowSearch()}`);
      return;
    }
    navigate(`/audits/workflow?entry=${entry}`);
  }

  return (
    <div className="w-full min-w-0 py-12 space-y-16 animate-in fade-in duration-500">
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

      <div className="max-w-3xl mx-auto flex justify-center">
        <Button
          type="button"
          size="lg"
          onClick={() => setStartDrawerOpen(true)}
          className={HERO_PRIMARY_CTA_CLASS}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Audit Listing
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <BuildBrandStartDrawer
          open={startDrawerOpen}
          onOpenChange={setStartDrawerOpen}
          onChoose={handleStartChoice}
          title="Start auditing"
          description="Choose how you'd like to begin your listing audit"
          excludeEntries={["scratch"]}
        />
      </div>

      <FeatureProductHistoryTable
        sourceType="audit"
        viewTarget="audit-detail"
        auditDetailFrom={AUDIT_LISTING_HISTORY_FROM}
        sectionTitle="Your audit history"
        emptyTitle="No listing audits yet"
        emptyDescription="Click Audit Listing and choose how to begin. Completed audits will appear here."
      />
    </div>
  );
}
