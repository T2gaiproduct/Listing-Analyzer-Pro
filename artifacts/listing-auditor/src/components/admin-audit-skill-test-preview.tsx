import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreRing, ScoreBadge } from "@/components/score-ring";
import {
  AlertCircle,
  AlignLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image,
  Lightbulb,
  Tag,
  Type,
} from "lucide-react";
import type { ListingAuditSkillTestPayload } from "@/lib/admin-ai-skills-api";

function ScoreCard({
  icon: Icon,
  title,
  score,
  issues,
  suggestions,
}: {
  icon: React.ElementType;
  title: string;
  score: number;
  issues: string[];
  suggestions: string[];
}) {
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
                {issues.map((issue) => (
                  <li key={issue.slice(0, 48)} className="text-sm text-foreground/80 flex gap-2">
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
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Suggestions</span>
              </div>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.slice(0, 48)} className="text-sm text-foreground/80 flex gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{suggestion}</span>
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

export function AdminAuditSkillTestPreview({ payload }: { payload: ListingAuditSkillTestPayload }) {
  const { result, listing } = payload;
  const display = result.display;
  const scoreCategories = (
    [
      { key: "title" as const, icon: Type, title: "Title Analysis", ...result.titleScore },
      { key: "bullets" as const, icon: AlignLeft, title: "Bullet Points", ...result.bulletScore },
      { key: "images" as const, icon: Image, title: "Images", ...result.imageScore },
      { key: "keywords" as const, icon: Tag, title: "Keywords", ...result.keywordScore },
    ] as const
  ).filter((cat) => {
    if (!display) return true;
    if (cat.key === "title") return display.showTitle;
    if (cat.key === "bullets") return display.showBullets;
    if (cat.key === "images") return display.showImages;
    return display.showKeywords;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <p className="text-[11px] text-muted-foreground">
        Same layout sellers see on <strong>Audit Results</strong> — scores use your skill weights, offset, and show_* flags.
      </p>
      <div className="grid grid-cols-1 gap-4">
        <Card className="flex items-center justify-center p-4 border-border/50">
          <div className="text-center space-y-2">
            <ScoreRing score={result.overallScore} size="lg" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Score</p>
          </div>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground/80">{result.summary}</p>
            <Separator />
            <div className="grid grid-cols-1 gap-2">
              {scoreCategories.map((cat) => (
                <div key={cat.title} className="flex items-center gap-2">
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
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Sample listing ({listing.category})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium leading-relaxed">{listing.title}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detailed analysis</p>
        {scoreCategories.map((cat) => (
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
  );
}
