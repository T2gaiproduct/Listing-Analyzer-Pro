import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  imagePromptSkillCatalogTitle,
  setSkillInstructionsNameLine,
  stripImagePromptSkillSuffix,
} from "@/lib/admin-skill-rename";
import { updateAdminAiSkill, type AiSkillRecord } from "@/lib/admin-ai-skills-api";
import { saveAdminImagePromptTemplate, useAdminImagePromptTemplates } from "@/lib/image-prompt-templates";

type Props = {
  skill: AiSkillRecord | null;
  onOpenChange: (open: boolean) => void;
};

export function AdminSkillRenameDialog({ skill, onOpenChange }: Props) {
  const open = skill != null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templatesData } = useAdminImagePromptTemplates();
  const templates = templatesData?.templates ?? [];
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const isImagePrompt =
    skill?.skillKind === "image_prompt" || (skill?.imagePromptTemplateId != null && skill.imagePromptTemplateId > 0);

  useEffect(() => {
    if (!skill) return;
    setTitle(isImagePrompt ? stripImagePromptSkillSuffix(skill.name) : skill.name);
  }, [skill, isImagePrompt]);

  async function handleSave() {
    if (!skill) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (isImagePrompt && skill.imagePromptTemplateId != null) {
        const tpl = templates.find((t) => t.id === skill.imagePromptTemplateId);
        if (!tpl) {
          throw new Error("Linked image module not found. Refresh and try again.");
        }
        await saveAdminImagePromptTemplate({ ...tpl, name: trimmed });
      } else {
        const catalogTitle = trimmed;
        const instructionsText = setSkillInstructionsNameLine(skill.instructionsText, catalogTitle);
        await updateAdminAiSkill(skill.slug, {
          name: catalogTitle,
          instructionsText,
          skillType: skill.skillType,
          category: skill.category,
          marketplaceSlug: skill.marketplaceSlug,
          aiModel: skill.aiModel,
          status: skill.status,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "image-prompt-templates"] });
      onOpenChange(false);
      toast({
        title: "Skill renamed",
        description: isImagePrompt ? imagePromptSkillCatalogTitle(trimmed) : trimmed,
      });
    } catch (e) {
      toast({
        title: "Could not rename",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Rename skill</DialogTitle>
          <DialogDescription>
            {isImagePrompt
              ? "Updates the Skills table title and the linked module name in Image library."
              : "Updates the title shown in the Skills list and the name line in instructions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hero Shot"
            className="mt-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
          />
          {isImagePrompt ? (
            <p className="text-[11px] text-muted-foreground">
              Catalog shows: <span className="font-medium text-slate-700">{imagePromptSkillCatalogTitle(title || "…")}</span>
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={saving || !title.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save title"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
