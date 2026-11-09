import { Link } from "wouter";
import { Pencil, Plug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { AiSkillRecord } from "@/lib/admin-ai-skills-api";
import { deleteAdminContentMarketplace } from "@/lib/content-marketplaces";
import { deleteAdminImagePromptTemplate } from "@/lib/image-prompt-templates";
import { skillTypeLabel } from "@/lib/admin-overview-skill-links";
import { useQueryClient } from "@tanstack/react-query";

function StatusPill({ status }: { status: AiSkillRecord["status"] }) {
  const published = status === "published";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold border",
        published
          ? "bg-teal-50 text-teal-800 border-teal-200"
          : "bg-amber-50 text-amber-900 border-amber-200",
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export function AdminOverviewSkillsTable({ skills }: { skills: AiSkillRecord[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  async function removeSkill(skill: AiSkillRecord) {
    if (skill.contentMarketplaceId != null) {
      if (!window.confirm(`Delete marketplace skill “${skill.name}”?`)) return;
      try {
        await deleteAdminContentMarketplace(skill.contentMarketplaceId);
        await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
        toast({ title: "Deleted" });
      } catch (e) {
        toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
      }
      return;
    }
    if (skill.imagePromptTemplateId != null) {
      if (!window.confirm(`Delete image prompt “${skill.name}”?`)) return;
      try {
        await deleteAdminImagePromptTemplate(skill.imagePromptTemplateId);
        await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
        toast({ title: "Deleted" });
      } catch (e) {
        toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
      }
    }
  }

  const canDelete = (skill: AiSkillRecord) =>
    skill.contentMarketplaceId != null || skill.imagePromptTemplateId != null;

  const connectHref = (skill: AiSkillRecord) => {
    if (skill.status === "draft") return `/admin/settings/ai/skills/${skill.slug}`;
    if (skill.skillKind === "marketplace_content") return "/admin/settings/ai";
    return `/admin/settings/ai/skills/${skill.slug}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">All skills</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Every skill on the server. Edit to change prompts; publish to connect generation. Provider keys live
          under AI Settings.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Type</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  No skills yet.
                </td>
              </tr>
            )}
            {sorted.map((skill) => (
              <tr key={skill.id} className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium max-w-[240px] truncate">
                  <Link
                    href={`/admin/settings/ai/skills/${skill.slug}`}
                    className="hover:text-teal-800 hover:underline"
                  >
                    {skill.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground text-xs">{skillTypeLabel(skill)}</td>
                <td className="py-2.5 pr-4">
                  <StatusPill status={skill.status} />
                </td>
                <td className="py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link href={`/admin/settings/ai/skills/${skill.slug}`}>
                      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={connectHref(skill)}>
                      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Plug className="w-3 h-3" />
                        {skill.status === "draft" ? "Publish" : "Connect"}
                      </Button>
                    </Link>
                    {canDelete(skill) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-red-600"
                        onClick={() => void removeSkill(skill)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
