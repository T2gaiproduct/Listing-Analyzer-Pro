import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetAudit, useDeleteAudit, useDeleteCompetitor,
  useGenerateContent,
  getListAuditsQueryKey, getGetAuditStatsQueryKey, getGetAuditQueryKey,
} from "@workspace/api-client-react";
import { GraphicsWizard } from "@/components/graphics-wizard";
import { EbcStudio } from "@/components/ebc-studio";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle, Lightbulb,
  Type, AlignLeft, Image, Tag, Users, ChevronDown, ChevronUp,
  Wand2, Loader2, Copy, Download, ImageIcon, FileText,
} from "lucide-react";
import { downloadAuditReportPdf } from "@/lib/audit-report-pdf";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function copyToClipboard(text: string, label: string, toast: ReturnType<typeof useToast>["toast"]) {
  navigator.clipboard.writeText(text).then(() => {
    toast({ title: `${label} copied` });
  });
}

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

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(text, label, toast)}>
      <Copy className="w-3 h-3 mr-1" /> Copy
    </Button>
  );
}

export default function AuditDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";
  const { canEdit, isTeamMember, role, memberCredits, memberCreditsLoading } = useTeam();

  const { data: audit, isLoading } = useGetAudit(id, {
    query: { enabled: !!id, queryKey: getGetAuditQueryKey(id) },
  });

  const deleteAudit = useDeleteAudit();
  const deleteCompetitor = useDeleteCompetitor();
  const generateContent = useGenerateContent();

  const { data: creditsData } = useQuery({
    queryKey: ["user-credits"],
    queryFn: () => fetch(`${basePath}/api/credits`, { credentials: "include" }).then((r) => r.json()),
    enabled: !isTeamMember,
  });
  const ownerCredits = (creditsData as { credits?: { aiCredits: number; imageCredits: number; auditCredits: number } } | undefined)?.credits
    ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const credits = isTeamMember
    ? (memberCredits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 })
    : ownerCredits;

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

  const handleDeleteAudit = () => {
    deleteAudit.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
        setLocation(returnTo);
        toast({ title: "Audit deleted" });
      },
    });
  };

  const handleDeleteCompetitor = (competitorId: number) => {
    deleteCompetitor.mutate({ id: competitorId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
        toast({ title: "Competitor removed" });
      },
    });
  };

  const formatAiError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.toLowerCase().includes("spend limit") || raw.includes("403")) {
      return "OpenAI API usage limit reached. Check your OpenAI account billing or try again later.";
    }
    if (raw.includes("402") || raw.toLowerCase().includes("insufficient credits")) {
      return "You don't have enough credits for this action. Go to Billing to purchase more.";
    }
    if (raw.toLowerCase().includes("api key") || raw.includes("401") || raw.includes("authentication")) {
      return "OpenAI API key is invalid or missing. Please check your AI Settings in the admin panel.";
    }
    return raw || "Something went wrong. Please try again.";
  };

  const aiLow = !(isTeamMember && memberCreditsLoading) && credits.aiCredits < 1;
  const auditLow = !(isTeamMember && memberCreditsLoading) && credits.auditCredits < 1;

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

  const handleGenerateContent = () => {
    generateContent.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
        refreshCreditBalances(queryClient);
        toast({ title: "Content generated", description: "Your optimized listing content is ready." });
      },
      onError: (err) => toast({ title: "Content generation failed", description: formatAiError(err), variant: "destructive" }),
    });
  };

  const result = audit.result;
  const scoreCategories = [
    { icon: Type, title: "Title Analysis", ...result.titleScore },
    { icon: AlignLeft, title: "Bullet Points", ...result.bulletScore },
    { icon: Image, title: "Images", ...result.imageScore },
    { icon: Tag, title: "Keywords", ...result.keywordScore },
  ];

  const gc = audit.generatedContent;

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
      {/* Tabs */}
      <Tabs defaultValue="audit">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 w-full min-w-0">
          <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 -mx-1 px-1 scrollbar-hide">
            <TabsList className="inline-flex w-max h-auto flex-nowrap">
            <TabsTrigger value="audit" className="whitespace-nowrap">Audit Results</TabsTrigger>
            <TabsTrigger value="content" className="whitespace-nowrap">
              <span className="sm:hidden">Listing</span>
              <span className="hidden sm:inline">Listing Optimization</span>
              {gc && <span className="ml-2 w-2 h-2 rounded-full bg-orange-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="images" className="whitespace-nowrap">
              <span className="sm:hidden">Graphics</span>
              <span className="hidden sm:inline">Graphics Creation</span>
              {(audit.imageRecords?.length || audit.generatedImages) && <span className="ml-2 w-2 h-2 rounded-full bg-orange-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="ebc" className="whitespace-nowrap">
              <span className="sm:hidden">A+ / EBC</span>
              <span className="hidden sm:inline">A+ / EBC Content</span>
            </TabsTrigger>
            <TabsTrigger value="competitors" className="whitespace-nowrap">
              Competitors
              {audit.competitors.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">{audit.competitors.length}</Badge>
              )}
            </TabsTrigger>
            </TabsList>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0 min-h-11" onClick={handleDownloadPdf}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> PDF Report
          </Button>
        </div>

        {/* ── AUDIT TAB ── */}
        <TabsContent value="audit" className="space-y-6">
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
        </TabsContent>

        {/* ── CONTENT TAB ── */}
        <TabsContent value="content" className="space-y-6">
          {!gc ? (
            <Card className="border-dashed">
              <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Generate Optimized Listing Content</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Our AI will create an Amazon-ready title (200 chars), 5 keyword-rich bullet points, 10 backend search terms, and a full HTML product description — all following Amazon guidelines.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {canEdit && (
                    <Button onClick={handleGenerateContent} disabled={generateContent.isPending || aiLow} size="lg">
                      {generateContent.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" />Generate Content</>
                      )}
                    </Button>
                  )}
                  {aiLow ? (
                    isTeamMember ? (
                      <span className="text-sm text-destructive">1 text credit required — ask your workspace owner for more</span>
                    ) : (
                      <Link href="/billing" className="text-sm text-destructive hover:underline">1 AI credit required — buy credits</Link>
                    )
                  ) : (
                    <Badge variant="secondary" className="text-xs font-normal">1 text credit</Badge>
                  )}
                  {!canEdit && (
                    <Badge variant="outline" className="text-xs font-normal">Read-only — contact your team admin</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  Amazon-Ready Content
                </h2>
                <div className="flex items-center gap-3">
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={handleGenerateContent} disabled={generateContent.isPending || aiLow}>
                      {generateContent.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Regenerating...</> : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Regenerate</>}
                    </Button>
                  )}
                  {aiLow ? (
                    isTeamMember ? (
                      <span className="text-xs text-destructive">1 text credit required — ask your workspace owner for more</span>
                    ) : (
                      <Link href="/billing" className="text-xs text-destructive hover:underline">1 AI credit required — buy credits</Link>
                    )
                  ) : (
                    <Badge variant="secondary" className="text-xs font-normal">1 text credit</Badge>
                  )}
                </div>
              </div>

              {/* Title */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" /> Title
                    <Badge variant="outline" className={cn("text-xs font-mono ml-2", gc.title.length > 200 ? "text-destructive" : "text-muted-foreground")}>
                      {gc.title.length}/200
                    </Badge>
                  </CardTitle>
                  <CopyButton text={gc.title} label="Title" />
                </CardHeader>
                <CardContent>
                  <p className="text-foreground font-medium leading-relaxed">{gc.title}</p>
                </CardContent>
              </Card>

              {/* Bullet Points */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <AlignLeft className="w-3.5 h-3.5" /> Bullet Points
                  </CardTitle>
                  <CopyButton text={gc.bulletPoints.join("\n")} label="Bullet points" />
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {gc.bulletPoints.map((bp, i) => (
                      <li key={i} className="flex gap-3 group">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <span className="text-sm leading-relaxed text-foreground/90">{bp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Keywords */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" /> Backend Search Keywords
                  </CardTitle>
                  <CopyButton text={gc.keywords.join(", ")} label="Keywords" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {gc.keywords.map((kw, i) => (
                      <Badge key={i} className="text-xs bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 cursor-default">{kw}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* HTML Description */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">HTML Description</CardTitle>
                  <div className="flex gap-2">
                    <CopyButton text={gc.htmlDescription} label="HTML description" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="prose prose-sm max-w-none text-foreground/90 border rounded-md p-4 bg-muted/20"
                    dangerouslySetInnerHTML={{ __html: gc.htmlDescription }}
                  />
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-mono">View raw HTML</summary>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">{gc.htmlDescription}</pre>
                  </details>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── IMAGES TAB ── */}
        <TabsContent value="images" className="space-y-6 w-full min-w-0">
          <GraphicsWizard
            auditId={audit.id}
            productName={audit.productName}
            imageUrls={audit.imageUrls}
            category={audit.category ?? null}
            targetKeywords={audit.targetKeywords}
          />
        </TabsContent>

        {/* ── EBC / A+ CONTENT TAB ── */}
        <TabsContent value="ebc" className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
          <EbcStudio
            auditId={id}
            audit={{
              productName: audit.productName,
              summary: result.summary,
              bulletPoints: audit.bulletPoints,
              keywords: audit.targetKeywords,
              generatedBullets: audit.generatedContent?.bulletPoints,
              generatedTitle: audit.generatedContent?.title,
              imageUrls: audit.imageUrls,
            }}
          />
        </TabsContent>

        {/* ── COMPETITORS TAB ── */}
        <TabsContent value="competitors" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />Competitor Analysis
            </h2>
            <div className="flex items-center gap-3">
              {canEdit && (
                <Button asChild size="sm" variant="outline" disabled={auditLow}>
                  <Link href={auditLow ? "/billing" : `/audits/${id}/competitors/new`}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Competitor
                  </Link>
                </Button>
              )}
              {auditLow ? (
                isTeamMember ? (
                  <span className="text-xs text-destructive">1 audit credit required — ask your workspace owner for more</span>
                ) : (
                  <span className="text-xs text-destructive">1 audit credit required — <Link href="/billing" className="hover:underline">buy credits</Link></span>
                )
              ) : (
                <Badge variant="secondary" className="text-xs font-normal">1 audit credit</Badge>
              )}
            </div>
          </div>

          {audit.competitors.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="py-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-semibold text-foreground/70 mb-1">No competitors added</p>
                <p className="text-sm text-muted-foreground mb-4">Compare your listing against top competitors to find gaps.</p>
                {canEdit && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/audits/${id}/competitors/new`}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Competitor</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="table-responsive">
              <div className="min-w-[40rem]">
              <div className="grid grid-cols-5 gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4">
                <span className="col-span-2">Competitor</span>
                <span className="text-center">Score</span>
                <span className="col-span-2">Strengths / Weaknesses</span>
              </div>
              {audit.competitors.map(competitor => (
                <Card key={competitor.id} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="grid grid-cols-5 gap-4 items-start">
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{competitor.productName}</p>
                          {competitor.asin && <Badge variant="outline" className="font-mono text-[10px]">{competitor.asin}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{competitor.title}</p>
                      </div>
                      <div className="flex justify-center">
                        <ScoreRing score={competitor.overallScore} size="sm" showLabel={false} />
                      </div>
                      <div className="col-span-2 space-y-2">
                        {competitor.strengths.slice(0, 2).map((s, i) => (
                          <div key={i} className="flex gap-1.5 items-start">
                            <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-foreground/80">{s}</span>
                          </div>
                        ))}
                        {(competitor.weaknesses ?? []).slice(0, 2).map((w, i) => (
                          <div key={i} className="flex gap-1.5 items-start">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-foreground/80">{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex justify-end mt-3 border-t pt-3">
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                          onClick={() => handleDeleteCompetitor(competitor.id)} disabled={deleteCompetitor.isPending}>
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
