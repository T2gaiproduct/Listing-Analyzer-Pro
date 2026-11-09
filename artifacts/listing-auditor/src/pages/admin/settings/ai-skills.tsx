import { Link } from "wouter";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSkillsCatalogTable } from "@/components/admin-skills-catalog-table";
import { AdminSkillTypesPanel } from "@/components/admin-skill-types-panel";
import { useAdminAiSkills } from "@/lib/admin-ai-skills-api";

export default function AdminAiSkillsPage() {
  const { data, isLoading, isError, error } = useAdminAiSkills();
  const skills = data?.skills ?? [];

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-6 h-6 text-orange-500" />
              Skills
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Instructions and checklists that guide AI for your sellers. Publish a skill to mark it{" "}
              <span className="font-medium text-orange-800">Live</span> when it should run in the product.
            </p>
          </div>
          <Link href="/admin/settings/ai/skills/new">
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-sm">
              <Plus className="w-4 h-4" />
              New skill
            </Button>
          </Link>
        </div>

        {isError && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            {(error as Error).message || "Could not load skills from the server."}
          </p>
        )}

        <AdminSkillsCatalogTable skills={skills} isLoading={isLoading} />

        <AdminSkillTypesPanel />

        <p className="text-xs text-muted-foreground">
          Category reference images (Hero Shot, lifestyle, etc.) are not skills—they live in{" "}
          <Link href="/admin/settings/ai/overview" className="text-orange-600 underline font-medium">
            Admin Overview → Category coverage → Image library
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
