import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetAudit,
  usePatchAudit,
  getGetAuditQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertCircle, Lightbulb,
  Type, AlignLeft, Image, Tag, ChevronDown, ChevronUp,
  Download,
  Loader2,
  Package,
} from "lucide-react";
import { downloadAuditReportPdf } from "@/lib/audit-report-pdf";
import { useTeam } from "@/hooks/use-team";
import { isShopifyImportAsin } from "@/lib/shopify-import";
import { isWooCommerceImportAsin } from "@/lib/woocommerce-import";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ScoreCardProps {
  icon: React.ElementType;
  title: string;
  score: number;
  issues: string[];
  suggestions: string[];
}

function ScoreCard({ icon: Icon, title, score, issues, suggestions }: ScoreCardProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg"><Icon className="w-4 h-4 text-foreground/70" /></div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge score={score} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {issues.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">Issues</span>
              </div>
              <ul className="space-y-1.5">
                {issues.map((issue, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-rose-400 mt-0.5 shrink-0">•</span><span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Suggestions</span>
              </div>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" /><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function AuditDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const patchAudit = usePatchAudit();
  const { canEditAudits } = useTeam();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";

  const { data: audit, isLoading } = useGetAudit(id, {
    query: { enabled: !!id, queryKey: getGetAuditQueryKey(id) },
  });

  useEffect(() => {
    if (!audit) return;
    const isStoreImport = isShopifyImportAsin(audit.asin) || isWooCommerceImportAsin(audit.asin);
    const hasAuditRun = (audit.overallScore ?? 0) > 0;
    if (isStoreImport && !hasAuditRun) {
      setLocation(`/audits/workflow?resume=${id}`);
    }
  }, [audit, id, setLocation]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" /><Skeleton className="h-64" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Audit not found.</p>
        <Button asChild className="mt-4"><Link href={returnTo}>Go Back</Link></Button>
      </div>
    );
  }

  const isStoreImportWithoutAudit =
    (isShopifyImportAsin(audit.asin) || isWooCommerceImportAsin(audit.asin))
    && (audit.overallScore ?? 0) <= 0;
  if (isStoreImportWithoutAudit) {
    return (
      <div className="space-y-8 animate-in fade-in">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    try {
      await downloadAuditReportPdf(audit, basePath);
    } catch {
      toast({
        title: "PDF export failed",
        description: "Could not generate the audit report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveToProductExplorer = useCallback(() => {
    if (!canEditAudits) {
      toast({
        title: "Read-only",
        description: "Ask your workspace admin to save this audit to Product Explorer.",
        variant: "destructive",
      });
      return;
    }
    patchAudit.mutate(
      { id, data: { currentStep: 2 } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
          void queryClient.invalidateQueries({ queryKey: ["products"] });
          setLocation(`${basePath}/products/${id}?source=audit&step=listing`);
          toast({
            title: "Saved to Product Explorer",
            description: "Continue on the Listing step to optimize your listing copy.",
          });
        },
        onError: () => {
          toast({
            title: "Could not save",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  }, [canEditAudits, id, patchAudit, queryClient, setLocation, toast]);

  const hasAnalysis = audit.result != null;
  const result = audit.result ?? {
    titleScore: { score: 0, issues: [], suggestions: [] },
    bulletScore: { score: 0, issues: [], suggestions: [] },
    imageScore: { score: 0, issues: [], suggestions: [] },
    keywordScore: { score: 0, issues: [], suggestions: [] },
    overallScore: 0,
    summary: "Analysis pending. Run the audit to generate scores.",
  };
  const scoreCategories = [
    { icon: Type, title: "Title Analysis", ...result.titleScore },
    { icon: AlignLeft, title: "Bullet Points", ...result.bulletScore },
    { icon: Image, title: "Images", ...result.imageScore },
    { icon: Tag, title: "Keywords", ...result.keywordScore },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 max-w-full">
      {/* Failed banner */}
      {audit.status === "failed" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">AI Analysis Failed</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {"The AI service could not analyze this listing. This may be caused by an invalid API key, a network issue, or an AI provider error. Check your AI Settings in the admin panel."}
            </p>
          </div>
        </div>
      )}

      {!hasAnalysis && audit.status !== "failed" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Analysis pending</p>
            <p className="text-sm text-amber-800/80 mt-0.5">
              This listing has not been scored yet. Run the AI audit to generate your listing score and recommendations.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 w-full min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Audit Results</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {hasAnalysis && (
            <Button
              size="sm"
              className="w-full sm:w-auto flex-shrink-0 min-h-11"
              disabled={patchAudit.isPending}
              onClick={handleSaveToProductExplorer}
            >
              {patchAudit.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Package className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save to Product Explorer
            </Button>
          )}
          <Button variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0 min-h-11" onClick={handleDownloadPdf}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> PDF Report
          </Button>
        </div>
      </div>

      <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 flex items-center justify-center p-6 border-border/50">
              <div className="text-center space-y-3">
                <ScoreRing score={audit.overallScore} size="xl" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Score</p>
              </div>
            </Card>
            <Card className="md:col-span-2 border-border/50">
              <CardHeader><CardTitle className="text-base">AI Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-foreground/80">{result.summary}</p>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {scoreCategories.map(cat => (
                    <div key={cat.title} className="flex items-center gap-3">
                      <cat.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground flex-1">{cat.title}</span>
                      <ScoreBadge score={cat.score} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Current Listing Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground font-medium leading-relaxed">{audit.title}</p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">{audit.title.length} characters</p>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-xl font-bold tracking-tight mb-4">Detailed Analysis</h2>
            <div className="grid gap-4">
              {scoreCategories.map(cat => (
                <ScoreCard key={cat.title} icon={cat.icon} title={cat.title} score={cat.score} issues={cat.issues} suggestions={cat.suggestions} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground" />Target Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {audit.targetKeywords.map((kw, i) => <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Image className="w-4 h-4 text-muted-foreground" />Images ({audit.imageUrls.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {audit.imageUrls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No images provided</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {audit.imageUrls.slice(0, 6).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" title="Open full-size image" className="block shrink-0 hover:ring-2 hover:ring-primary rounded transition-all">
                        <img src={url} alt={`Product image ${i + 1}`} className="w-12 h-12 object-contain rounded border bg-white" />
                      </a>
                    ))}
                    {audit.imageUrls.length > 6 && <span className="text-xs text-muted-foreground self-center">+{audit.imageUrls.length - 6} more</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
