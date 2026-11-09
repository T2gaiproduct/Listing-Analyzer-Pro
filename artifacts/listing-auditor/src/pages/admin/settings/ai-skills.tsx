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
          <Link href="/admin/settings/ai/skills/new?skillType=product_content">
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
          To add or remove a sales channel (Amazon, eBay, Etsy, …), open a{" "}
          <strong>Product content</strong> skill: use <strong>New skill</strong> (Product content type) →{" "}
          <strong>Add marketplace</strong> in <em>Where this skill applies</em>, or open an existing channel skill and
          use <strong>Delete sales channel</strong>. Category reference images are on{" "}
          <Link href={ADMIN_AI_OVERVIEW_HREF} className="text-orange-600 underline font-medium">
            Overview → Image library
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
