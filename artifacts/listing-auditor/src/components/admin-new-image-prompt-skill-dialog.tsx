import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  saveAdminImagePromptTemplate,
  slugifyImagePromptTemplateName,
  type ImagePromptTemplateCategory,
} from "@/lib/image-prompt-templates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ImagePromptTemplateCategory;
};

export function AdminNewImagePromptSkillDialog({ open, onOpenChange, category }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function createTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const slug = slugifyImagePromptTemplateName(trimmed);
      const template = await saveAdminImagePromptTemplate({
        slug,
        category,
        name: trimmed,
        description: "",
        enabled: false,
        sortOrder: 100,
        promptTemplate:
          category === "graphics"
            ? "Product image for {{productDesc}}. Professional e-commerce photography."
            : "Amazon A+ banner for {{productDesc}}. {{aplusEdgeToEdge}} Premium design.",
        headlineTemplate: category === "aplus" ? "{{heroHeadline}}" : null,
        bodyTemplate: category === "aplus" ? "{{heroSubheadline}}" : null,
        metadata: category === "graphics" ? { icon: "✨", graphicsBucket: "lifestyle" } : { icon: "🖼️" },
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
      onOpenChange(false);
      setName("");
      navigate(`/admin/settings/ai/skills/image-prompt-${category}-${slug}`);
    } catch (e) {
      toast({
        title: "Could not create image prompt",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            New {category === "graphics" ? "graphics" : "A+"} image prompt
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lifestyle hero"
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            className="w-full bg-teal-700 hover:bg-teal-800"
            disabled={saving || !name.trim()}
            onClick={() => void createTemplate()}
          >
            {saving ? "Creating…" : "Create & edit skill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
