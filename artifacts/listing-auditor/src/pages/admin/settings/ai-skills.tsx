import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, SlidersHorizontal, Store, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAdminAiSkills, type AiSkillRecord } from "@/lib/admin-ai-skills-api";
import { deleteAdminContentMarketplace } from "@/lib/content-marketplaces";
import { AdminNewMarketplaceSkillDialog } from "@/components/admin-new-marketplace-skill-dialog";
import { useQueryClient } from "@tanstack/react-query";

function formatSkillType(skillType: string): string {
  return skillType.replace(/_/g, " ");
}

function SkillStatusBadge({ status }: { status: AiSkillRecord["status"] }) {
  const published = status === "published";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        published
          ? "bg-teal-50 text-teal-800 border-teal-200"
          : "bg-amber-50 text-amber-900 border-amber-200",
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function SkillRow({
  skill,
  onDelete,
}: {
  skill: AiSkillRecord;
  onDelete?: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <div
      className={cn(
        "flex items-stretch gap-2 rounded-lg border border-slate-200 bg-white",
        "hover:border-teal-400 hover:bg-teal-50/30 transition-colors",
      )}
    >
      <button
        type="button"
        onClick={() => navigate(`/admin/settings/ai/skills/${skill.slug}`)}
        className="flex-1 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left min-h-[3.25rem]"
      >
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-900 truncate">{skill.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {skill.skillKind === "marketplace_content"
              ? "Marketplace listing"
              : skill.category || "Uncategorized"}{" "}
            · {formatSkillType(skill.skillType)} · {skill.marketplaceSlug}
          </p>
        </div>
        <SkillStatusBadge status={skill.status} />
      </button>
      {onDelete && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 my-2 mr-2 h-9 w-9 text-red-600 border-slate-200 hover:bg-red-50 hover:border-red-200"
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

function DashedAddButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  const className =
    "w-full rounded-lg border border-dashed border-slate-200 py-5 text-sm text-muted-foreground hover:border-teal-400 hover:text-teal-800 hover:bg-teal-50/20 transition-colors";
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {label}
      </button>
    );
  }
  return (
    <Link href="/admin/settings/ai/skills/new">
      <button type="button" className={className}>
        {label}
      </button>
    </Link>
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

  async function deleteMarketplaceSkill(skill: AiSkillRecord) {
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
    <div className="min-h-full bg-slate-50/80">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-6 h-6 text-teal-700" />
              Skills
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Marketplace listing prompts and category skills live here. Publish a skill to enable it for
              generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-200 bg-white hover:border-teal-400 hover:text-teal-900"
              onClick={() => setNewMarketplaceOpen(true)}
            >
              <Store className="w-4 h-4 text-orange-500" />
              New marketplace
            </Button>
            <Link href="/admin/settings/ai/skills/new">
              <Button className="gap-2 bg-teal-700 hover:bg-teal-800 text-white shadow-sm">
                <Plus className="w-4 h-4" />
                New category skill
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" />
              Marketplace listing skills
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              One skill per seller marketplace dropdown (Amazon, Etsy, …).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading skills…</p>
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
              <p className="text-sm text-muted-foreground py-6 text-center">No marketplace skills yet.</p>
            )}
            <DashedAddButton label="+ Add marketplace" onClick={() => setNewMarketplaceOpen(true)} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-700" />
              Category &amp; other skills
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Optional rules for a product category and marketplace pair.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {isError && (
              <p className="text-sm text-destructive py-6 text-center">
                {(error as Error).message || "Could not load skills."}
              </p>
            )}
            {!isLoading &&
              otherSkills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            {!isLoading && otherSkills.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No category skills yet — create one for a product category and marketplace pair.
              </p>
            )}
            <DashedAddButton label="+ Create category skill" />
          </CardContent>
        </Card>

        <AdminNewMarketplaceSkillDialog open={newMarketplaceOpen} onOpenChange={setNewMarketplaceOpen} />
      </div>
    </div>
  );
}
