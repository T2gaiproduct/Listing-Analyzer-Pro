import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetAudit, useDeleteAudit, useDeleteCompetitor, getListAuditsQueryKey, getGetAuditStatsQueryKey, getGetAuditQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle, Lightbulb,
  Type, AlignLeft, Image, Tag, Users, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

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
            <div className="p-2 bg-muted rounded-lg">
              <Icon className="w-4 h-4 text-foreground/70" />
            </div>
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
                    <span className="text-rose-400 mt-0.5 shrink-0">•</span>
                    <span>{issue}</span>
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{s}</span>
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

  const { data: audit, isLoading } = useGetAudit(id, {
    query: { enabled: !!id, queryKey: getGetAuditQueryKey(id) },
  });

  const deleteAudit = useDeleteAudit();
  const deleteCompetitor = useDeleteCompetitor();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Audit not found.</p>
        <Button asChild className="mt-4"><Link href="/">Go Back</Link></Button>
      </div>
    );
  }

  const handleDeleteAudit = () => {
    deleteAudit.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
        setLocation("/");
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

  const result = audit.result;
  const scoreCategories = [
    { icon: Type, title: "Title Analysis", ...result.titleScore },
    { icon: AlignLeft, title: "Bullet Points", ...result.bulletScore },
    { icon: Image, title: "Images", ...result.imageScore },
    { icon: Tag, title: "Keywords", ...result.keywordScore },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-1">
            <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{audit.productName}</h1>
              {audit.asin && (
                <Badge variant="outline" className="font-mono text-xs">{audit.asin}</Badge>
              )}
              {audit.category && (
                <Badge variant="secondary" className="text-xs uppercase tracking-wider">{audit.category}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">Audited {format(new Date(audit.createdAt), 'MMMM d, yyyy')}</p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" data-testid="button-delete-audit">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete audit?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete this audit and all competitor data.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAudit} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Overall Score + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 flex items-center justify-center p-6 border-border/50">
          <div className="text-center space-y-3">
            <ScoreRing score={audit.overallScore} size="xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Score</p>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">AI Summary</CardTitle>
          </CardHeader>
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

      {/* Title preview */}
      <Card className="border-border/50 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Listing Title</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground font-medium leading-relaxed">{audit.title}</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">{audit.title.length} characters</p>
        </CardContent>
      </Card>

      {/* Score Cards */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Detailed Analysis</h2>
        <div className="grid gap-4">
          {scoreCategories.map(cat => (
            <ScoreCard
              key={cat.title}
              icon={cat.icon}
              title={cat.title}
              score={cat.score}
              issues={cat.issues}
              suggestions={cat.suggestions}
            />
          ))}
        </div>
      </div>

      {/* Keywords & Bullets preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Target Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {audit.targetKeywords.map((kw, i) => (
                <Badge key={i} variant="outline" className="text-xs" data-testid={`keyword-${i}`}>{kw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4 text-muted-foreground" />
              Images ({audit.imageUrls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audit.imageUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No images provided</p>
            ) : (
              <ul className="space-y-1">
                {audit.imageUrls.slice(0, 4).map((url, i) => (
                  <li key={i} className="text-xs font-mono text-muted-foreground truncate hover:text-foreground transition-colors">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {url}
                    </a>
                  </li>
                ))}
                {audit.imageUrls.length > 4 && (
                  <li className="text-xs text-muted-foreground">+{audit.imageUrls.length - 4} more</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competitor Analysis */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Competitor Analysis
          </h2>
          <Button asChild size="sm" variant="outline" data-testid="button-add-competitor">
            <Link href={`/audits/${id}/competitors/new`}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Competitor
            </Link>
          </Button>
        </div>

        {audit.competitors.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-semibold text-foreground/70 mb-1">No competitors added</p>
              <p className="text-sm text-muted-foreground mb-4">Compare your listing against top competitors to find gaps and opportunities.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/audits/${id}/competitors/new`}><Plus className="w-3.5 h-3.5 mr-1.5" /> Add Competitor</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Comparison header */}
            <div className="grid grid-cols-5 gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4">
              <span className="col-span-2">Competitor</span>
              <span className="text-center">Score</span>
              <span className="col-span-2">Strengths / Weaknesses</span>
            </div>
            {audit.competitors.map(competitor => (
              <Card key={competitor.id} className="border-border/50" data-testid={`competitor-card-${competitor.id}`}>
                <CardContent className="p-5">
                  <div className="grid grid-cols-5 gap-4 items-start">
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{competitor.productName}</p>
                        {competitor.asin && (
                          <Badge variant="outline" className="font-mono text-[10px]">{competitor.asin}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{competitor.title}</p>
                    </div>
                    <div className="flex justify-center">
                      <ScoreRing score={competitor.overallScore} size="sm" showLabel={false} />
                    </div>
                    <div className="col-span-2 space-y-3">
                      {competitor.strengths.slice(0, 2).map((s, i) => (
                        <div key={i} className="flex gap-1.5 items-start">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
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
                  <div className="flex justify-end mt-3 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                      onClick={() => handleDeleteCompetitor(competitor.id)}
                      disabled={deleteCompetitor.isPending}
                      data-testid={`button-delete-competitor-${competitor.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
