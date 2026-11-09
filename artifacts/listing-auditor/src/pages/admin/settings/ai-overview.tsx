import type { ReactNode } from "react";
import { Link } from "wouter";
import { Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdminAiSkillsOverview } from "@/lib/admin-ai-skills-overview";

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "ok" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
        tone === "warn" && "bg-amber-50 text-amber-900 border border-amber-200",
        tone === "muted" && "bg-rose-50 text-rose-800 border border-rose-200",
      )}
    >
      {children}
    </span>
  );
}

export default function AdminAiOverviewPage() {
  const { isLoading, stats, coverageRows } = useAdminAiSkillsOverview();

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
            A category is ready when it has a published product content skill, a published image skill, and at least one approved reference image.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 pr-4 font-semibold">Content skill</th>
                <th className="py-2 pr-4 font-semibold">Image skill</th>
                <th className="py-2 pr-4 font-semibold">Approved refs</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading coverage…
                  </td>
                </tr>
              )}
              {!isLoading && coverageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No product categories yet. Add categories under Image Prompts → reference images.
                  </td>
                </tr>
              )}
              {coverageRows.map((row) => (
                <tr key={row.category} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">{row.category}</td>
                  <td className="py-3 pr-4">
                    <StatusPill
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
                  <td className="py-3 pr-4 tabular-nums">{row.approvedRefCount}</td>
                  <td className="py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        row.status === "ready"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-amber-300 bg-amber-50 text-amber-900",
                      )}
                    >
                      {row.status === "ready" ? "Ready for users" : "Needs setup"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Create and publish skills under{" "}
        <Link href="/admin/settings/ai/skills" className="text-orange-600 underline">
          Skills
        </Link>
        , add reference images in{" "}
        <Link href="/admin/settings/ai/skills" className="text-orange-600 underline">
          Image Prompts
        </Link>
        , and set provider keys under{" "}
        <Link href="/admin/settings/ai" className="text-orange-600 underline">
          AI Settings
        </Link>
        .
      </p>
    </div>
  );
}
