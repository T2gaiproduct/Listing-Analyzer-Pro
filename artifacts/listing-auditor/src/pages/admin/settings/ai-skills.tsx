import { useState } from "react";
import { Link } from "wouter";
import { ImageIcon, Plus, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSkillsCatalogTable } from "@/components/admin-skills-catalog-table";
import { AdminNewMarketplaceSkillDialog } from "@/components/admin-new-marketplace-skill-dialog";
import { AdminNewImagePromptSkillDialog } from "@/components/admin-new-image-prompt-skill-dialog";
import { type ImagePromptTemplateCategory } from "@/lib/image-prompt-templates";
import { AdminGraphicsModuleExamplesPanel } from "@/pages/admin/settings/graphics-module-examples-panel";
import { useAdminAiSkills } from "@/lib/admin-ai-skills-api";

export default function AdminAiSkillsPage() {
  const { data, isLoading, isError, error } = useAdminAiSkills();
  const skills = data?.skills ?? [];
  const [newMarketplaceOpen, setNewMarketplaceOpen] = useState(false);
  const [newGraphicsPromptOpen, setNewGraphicsPromptOpen] = useState(false);
  const [newAplusPromptOpen, setNewAplusPromptOpen] = useState(false);
  const [studioCategory, setStudioCategory] = useState("Default");
  const [studioTab, setStudioTab] = useState<ImagePromptTemplateCategory>("graphics");

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-6 h-6 text-teal-700" />
              Skills
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              All prompts and rubrics stored in the database. Publish a skill to set status{" "}
              <span className="font-medium text-emerald-800">Live</span> for generation and audits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-200 bg-white hover:border-orange-300"
              onClick={() => setNewMarketplaceOpen(true)}
            >
              <Store className="w-4 h-4 text-orange-500" />
              New marketplace
            </Button>
            <Link href="/admin/settings/ai/skills/new?skillType=listing_audit">
              <Button type="button" variant="outline" className="gap-2 border-orange-200 text-orange-900">
                Audit skill
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setNewGraphicsPromptOpen(true)}
            >
              <ImageIcon className="w-4 h-4 text-violet-600" />
              Graphics prompt
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setNewAplusPromptOpen(true)}
            >
              <ImageIcon className="w-4 h-4 text-violet-600" />
              A+ prompt
            </Button>
            <Link href="/admin/settings/ai/skills/new">
              <Button className="gap-2 bg-teal-700 hover:bg-teal-800 text-white shadow-sm">
                <Plus className="w-4 h-4" />
                New skill
              </Button>
            </Link>
          </div>
        </div>

        {isError && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            {(error as Error).message || "Could not load skills from the server."}
          </p>
        )}

        <AdminSkillsCatalogTable skills={skills} isLoading={isLoading} />

        <div id="studio-references" className="scroll-mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Studio references by product category
              </h2>
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 bg-white">
              <Button
                type="button"
                size="sm"
                variant={studioTab === "graphics" ? "default" : "ghost"}
                className={studioTab === "graphics" ? "bg-teal-700 hover:bg-teal-800 h-8" : "h-8"}
                onClick={() => setStudioTab("graphics")}
              >
                Graphics
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studioTab === "aplus" ? "default" : "ghost"}
                className={studioTab === "aplus" ? "bg-teal-700 hover:bg-teal-800 h-8" : "h-8"}
                onClick={() => setStudioTab("aplus")}
              >
                A+
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Reference images per category (not listed as skills above). Use{" "}
            <Link href="/admin/settings/ai/overview" className="text-orange-600 underline">
              Overview → Image library
            </Link>{" "}
            for quick access.
          </p>
          <AdminGraphicsModuleExamplesPanel
            selectedCategory={studioCategory}
            onSelectedCategoryChange={setStudioCategory}
            templateCategory={studioTab}
          />
        </div>

        <AdminNewMarketplaceSkillDialog open={newMarketplaceOpen} onOpenChange={setNewMarketplaceOpen} />
        <AdminNewImagePromptSkillDialog
          open={newGraphicsPromptOpen}
          onOpenChange={setNewGraphicsPromptOpen}
          category="graphics"
        />
        <AdminNewImagePromptSkillDialog
          open={newAplusPromptOpen}
          onOpenChange={setNewAplusPromptOpen}
          category="aplus"
        />
      </div>
    </div>
  );
}
