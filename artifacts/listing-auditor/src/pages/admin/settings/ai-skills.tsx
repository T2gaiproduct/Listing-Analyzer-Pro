import { Link } from "wouter";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLACEHOLDER_SKILLS = [
  {
    id: "nutritional-supplement-content",
    name: "Nutritional Supplement · Product content",
    status: "Draft" as const,
    category: "Nutritional Supplement",
    marketplace: "Amazon",
  },
];

export default function AdminAiSkillsPage() {
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
          {PLACEHOLDER_SKILLS.map((skill) => (
            <Link key={skill.id} href={`/admin/settings/ai/skills/${skill.id}`}>
              <button
                type="button"
                className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{skill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {skill.category} · {skill.marketplace}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  {skill.status}
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
