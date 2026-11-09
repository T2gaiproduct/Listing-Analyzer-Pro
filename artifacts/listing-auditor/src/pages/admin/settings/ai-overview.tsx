import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdminAiSkillsOverview } from "@/lib/admin-ai-skills-overview";
import { useAdminAiSkills } from "@/lib/admin-ai-skills-api";
import { CategoryReferenceLibraryDialog } from "@/components/admin-overview-image-library";
import { findCategorySkillSlug } from "@/lib/admin-overview-skill-links";

const COVERAGE_ROWS_PER_PAGE = 12;

function StatusPill({
  tone,
  children,
  asButton,
  onClick,
  title,
}: {
  tone: "ok" | "warn" | "muted";
  children: ReactNode;
  asButton?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const className = cn(
    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
    tone === "ok" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
    tone === "warn" && "bg-amber-50 text-amber-900 border border-amber-200",
    tone === "muted" && "bg-rose-50 text-rose-800 border border-rose-200",
    asButton && "cursor-pointer hover:ring-2 hover:ring-orange-300 hover:ring-offset-1",
  );
  if (asButton) {
    return (
      <button type="button" className={className} onClick={onClick} title={title}>
        {children}
      </button>
    );
  }
  return <span className={className}>{children}</span>;
}

export default function AdminAiOverviewPage() {
  const [, navigate] = useLocation();
  const { isLoading, stats, coverageRows } = useAdminAiSkillsOverview();
  const { data: skillsData } = useAdminAiSkills();
  const skills = skillsData?.skills ?? [];

  const [refLibraryOpen, setRefLibraryOpen] = useState(false);
  const [refLibraryCategory, setRefLibraryCategory] = useState("Default");
  const [coveragePage, setCoveragePage] = useState(0);

  const coveragePageCount = Math.max(1, Math.ceil(coverageRows.length / COVERAGE_ROWS_PER_PAGE));

  const pagedCoverageRows = useMemo(() => {
    const start = coveragePage * COVERAGE_ROWS_PER_PAGE;
    return coverageRows.slice(start, start + COVERAGE_ROWS_PER_PAGE);
  }, [coverageRows, coveragePage]);

  function openReferenceLibrary(category: string) {
    setRefLibraryCategory(category);
    setRefLibraryOpen(true);
  }

  function openContentSkill(category: string) {
    const slug = findCategorySkillSlug(skills, category, "product_content");
    if (slug) {
      navigate(`/admin/settings/ai/skills/${slug}`);
      return;
    }
    navigate("/admin/settings/ai/skills/new");
  }

  function openAuditSkill(category: string) {
    const slug =
      findCategorySkillSlug(skills, category, "listing_audit")
      ?? findCategorySkillSlug(skills, "Default", "listing_audit");
    if (slug) {
      navigate(`/admin/settings/ai/skills/${slug}`);
      return;
    }
    navigate("/admin/settings/ai/skills/new?skillType=listing_audit");
  }

  function openImageSkill(category: string) {
    openReferenceLibrary(category);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-orange-500" />
            Admin Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What users can generate today, and where the gaps are.
          </p>
        </div>
        <Link href="/admin/settings/ai/skills/new">
          <Button className="gap-2 bg-teal-700 hover:bg-teal-800">
            <Plus className="w-4 h-4" />
            New skill
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live skills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? "…" : `${stats.liveSkills} / ${stats.totalSkills}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories ready</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? "…" : `${stats.categoriesReady} / ${stats.categoryTotal}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generations this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-[11px] text-muted-foreground mt-1">Usage reporting coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits consumed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-[11px] text-muted-foreground mt-1">Usage reporting coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category coverage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure content, audit rubric/scores, and reference images per category. Audit skill sets weights,
            visible score sections, and score offset for Audit Results.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 pr-4 font-semibold">Content skill</th>
                <th className="py-2 pr-4 font-semibold">Audit skill</th>
                <th className="py-2 pr-4 font-semibold">Image skill</th>
                <th className="py-2 pr-4 font-semibold">Approved refs</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading coverage…
                  </td>
                </tr>
              )}
              {!isLoading && coverageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No product categories yet. Add categories on the Skills page under Studio references.
                  </td>
                </tr>
              )}
              {pagedCoverageRows.map((row) => (
                <tr
                  key={row.category}
                  className="border-b border-border/60 hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 pr-4 font-medium">
                    <button
                      type="button"
                      className="text-left hover:text-orange-700 hover:underline"
                      onClick={() => openReferenceLibrary(row.category)}
                    >
                      {row.category}
                    </button>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill
                      asButton
                      title="Set up content skill"
                      onClick={() => openContentSkill(row.category)}
                      tone={
                        row.contentSkillLabel === "Live"
                          ? "ok"
                          : row.contentSkillLabel === "Draft"
                            ? "warn"
                            : "muted"
                      }
                    >
                      {row.contentSkillLabel}
                    </StatusPill>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill
                      asButton
                      title="Listing audit rubric and score display"
                      onClick={() => openAuditSkill(row.category)}
                      tone={
                        row.auditSkillLabel === "Live"
                          ? "ok"
                          : row.auditSkillLabel === "Draft"
                            ? "warn"
                            : "muted"
                      }
                    >
                      {row.auditSkillLabel}
                    </StatusPill>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill
                      asButton
                      title="Configure reference images for this category"
                      onClick={() => openImageSkill(row.category)}
                      tone={
                        row.imageSkillLabel === "Live"
                          ? "ok"
                          : row.imageSkillLabel === "Draft"
                            ? "warn"
                            : "muted"
                      }
                    >
                      {row.imageSkillLabel}
                    </StatusPill>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    <button
                      type="button"
                      className={cn(
                        "hover:text-orange-700 hover:underline",
                        row.approvedRefCount === 0 && "text-rose-700 font-medium",
                      )}
                      onClick={() => openReferenceLibrary(row.category)}
                    >
                      {row.approvedRefCount}
                    </button>
                  </td>
                  <td className="py-3">
                    <button type="button" onClick={() => openReferenceLibrary(row.category)}>
                      <Badge
                        variant="outline"
                        className={cn(
                          "cursor-pointer",
                          row.status === "ready"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-amber-300 bg-amber-50 text-amber-900",
                        )}
                      >
                        {row.status === "ready" ? "Ready for users" : "Needs setup"}
                      </Badge>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coverageRows.length > COVERAGE_ROWS_PER_PAGE ? (
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-orange-100 mt-2">
              <p className="text-xs text-muted-foreground">
                Showing {coveragePage * COVERAGE_ROWS_PER_PAGE + 1}–
                {Math.min((coveragePage + 1) * COVERAGE_ROWS_PER_PAGE, coverageRows.length)} of{" "}
                {coverageRows.length} categories
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-orange-200 text-orange-900 hover:bg-orange-50"
                  disabled={coveragePage <= 0}
                  onClick={() => setCoveragePage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-xs text-orange-900/80 tabular-nums px-2">
                  {coveragePage + 1} / {coveragePageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-orange-200 text-orange-900 hover:bg-orange-50"
                  disabled={coveragePage >= coveragePageCount - 1}
                  onClick={() => setCoveragePage((p) => Math.min(coveragePageCount - 1, p + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CategoryReferenceLibraryDialog
        open={refLibraryOpen}
        onOpenChange={setRefLibraryOpen}
        initialCategory={refLibraryCategory}
        coverageRows={coverageRows}
      />

      <p className="text-xs text-muted-foreground">
        Provider keys and models:{" "}
        <Link href="/admin/settings/ai" className="text-orange-600 underline">
          AI Settings
        </Link>
        . Full skill list:{" "}
        <Link href="/admin/settings/ai/skills" className="text-orange-600 underline">
          Skills
        </Link>
        .
      </p>
    </div>
  );
}
