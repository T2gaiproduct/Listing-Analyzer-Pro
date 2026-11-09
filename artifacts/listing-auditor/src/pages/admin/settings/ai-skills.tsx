import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, SlidersHorizontal, Store, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminAiSkills } from "@/lib/admin-ai-skills-api";
import { deleteAdminContentMarketplace } from "@/lib/content-marketplaces";
import { AdminNewMarketplaceSkillDialog } from "@/components/admin-new-marketplace-skill-dialog";
import { useQueryClient } from "@tanstack/react-query";

function formatSkillType(skillType: string): string {
  return skillType.replace(/_/g, " ");
}

function SkillRow({
  skill,
  onDelete,
}: {
  skill: NonNullable<ReturnType<typeof useAdminAiSkills>["data"]>["skills"][number];
  onDelete?: () => void;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={() => navigate(`/admin/settings/ai/skills/${skill.slug}`)}
        className="flex-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
      >
        <div>
          <p className="font-medium text-sm">{skill.name}</p>
          <p className="text-xs text-muted-foreground">
            {skill.skillKind === "marketplace_content"
              ? "Marketplace listing"
              : skill.category || "Uncategorized"}{" "}
            · {formatSkillType(skill.skillType)} · {skill.marketplaceSlug}
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
      {onDelete && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
          title="Delete marketplace skill"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export default function AdminAiSkillsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useAdminAiSkills();
  const skills = data?.skills ?? [];
  const [newMarketplaceOpen, setNewMarketplaceOpen] = useState(false);

  const { marketplaceSkills, otherSkills } = useMemo(() => {
    const marketplace = skills.filter((s) => s.skillKind === "marketplace_content");
    const other = skills.filter((s) => s.skillKind !== "marketplace_content");
    return { marketplaceSkills: marketplace, otherSkills: other };
  }, [skills]);

  async function deleteMarketplaceSkill(skill: (typeof skills)[number]) {
    if (skill.contentMarketplaceId == null) return;
    if (
      !window.confirm(
        `Delete “${skill.name}” and remove it from the seller marketplace list?`,
      )
    ) {
      return;
    }
    try {
      await deleteAdminContentMarketplace(skill.contentMarketplaceId);
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
      await refetch();
      toast({ title: "Marketplace skill deleted" });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-teal-700" />
            Skills
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marketplace listing prompts and category skills live here. Publish a skill to enable it for
            generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setNewMarketplaceOpen(true)}
          >
            <Store className="w-4 h-4" />
            New marketplace
          </Button>
          <Link href="/admin/settings/ai/skills/new">
            <Button className="gap-2 bg-teal-700 hover:bg-teal-800">
              <Plus className="w-4 h-4" />
              New category skill
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" />
            Marketplace listing skills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading skills…</p>
          )}
          {!isLoading &&
            marketplaceSkills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onDelete={() => void deleteMarketplaceSkill(skill)}
              />
            ))}
          {!isLoading && marketplaceSkills.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No marketplace skills yet.
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full border border-dashed"
            onClick={() => setNewMarketplaceOpen(true)}
          >
            + Add marketplace
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category &amp; other skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isError && (
            <p className="text-sm text-destructive py-4 text-center">
              {(error as Error).message || "Could not load skills."}
            </p>
          )}
          {!isLoading &&
            otherSkills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          {!isLoading && otherSkills.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No category skills yet — create one for a product category and marketplace pair.
            </p>
          )}
          <Link href="/admin/settings/ai/skills/new">
            <button
              type="button"
              className="w-full rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:border-teal-400 hover:text-teal-800 transition-colors"
            >
              + Create category skill
            </button>
          </Link>
        </CardContent>
      </Card>

      <AdminNewMarketplaceSkillDialog open={newMarketplaceOpen} onOpenChange={setNewMarketplaceOpen} />
    </div>
  );
}
