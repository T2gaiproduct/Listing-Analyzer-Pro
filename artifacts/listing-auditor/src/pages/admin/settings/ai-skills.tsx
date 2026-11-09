import { Link } from "wouter";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminAiSkills } from "@/lib/admin-ai-skills-api";

function formatSkillType(skillType: string): string {
  return skillType.replace(/_/g, " ");
}

export default function AdminAiSkillsPage() {
  const { data, isLoading, isError, error } = useAdminAiSkills();
  const skills = data?.skills ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-teal-700" />
            Skills
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define content and image skills per category and marketplace. Open a skill to edit rules and run tests.
          </p>
        </div>
        <Link href="/admin/settings/ai/skills/new">
          <Button className="gap-2 bg-teal-700 hover:bg-teal-800">
            <Plus className="w-4 h-4" />
            New skill
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading skills…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive py-4 text-center">
              {(error as Error).message || "Could not load skills."}
            </p>
          )}
          {!isLoading && !isError && skills.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No skills yet. Create one to define category rules and test output.
            </p>
          )}
          {skills.map((skill) => (
            <Link key={skill.id} href={`/admin/settings/ai/skills/${skill.slug}`}>
              <button
                type="button"
                className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{skill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {skill.category || "Uncategorized"} · {formatSkillType(skill.skillType)} ·{" "}
                    {skill.marketplaceSlug}
                  </p>
                </div>
                <span
                  className={
                    skill.status === "published"
                      ? "text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5"
                      : "text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5"
                  }
                >
                  {skill.status === "published" ? "Published" : "Draft"}
                </span>
              </button>
            </Link>
          ))}

          <Link href="/admin/settings/ai/skills/new">
            <button
              type="button"
              className="w-full rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:border-teal-400 hover:text-teal-800 transition-colors"
            >
              + Create another skill
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
