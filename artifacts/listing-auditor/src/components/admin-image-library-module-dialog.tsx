import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  APLUS_PLACEHOLDER_HELP,
  GRAPHICS_PLACEHOLDER_HELP,
  deleteAdminImagePromptTemplate,
  saveAdminImagePromptTemplate,
  slugifyImagePromptTemplateName,
  type ImagePromptTemplateAdmin,
  type ImagePromptTemplateCategory,
} from "@/lib/image-prompt-templates";
import { imagePromptSkillCatalogTitle } from "@/lib/admin-skill-rename";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ImagePromptTemplateCategory;
  /** When null, dialog creates a new module; otherwise edits this template. */
  template: ImagePromptTemplateAdmin | null;
  onSaved?: (slug: string) => void;
};

function blankDraft(category: ImagePromptTemplateCategory): Omit<ImagePromptTemplateAdmin, "id" | "isSystem"> {
  return {
    slug: "",
    category,
    name: "",
    description: "",
    enabled: true,
    sortOrder: 100,
    promptTemplate:
      category === "graphics"
        ? "Product image for {{productDesc}}. Professional e-commerce photography."
        : "Amazon A+ banner for {{productDesc}}. {{aplusEdgeToEdge}} Premium design.",
    headlineTemplate: category === "aplus" ? "{{heroHeadline}}" : null,
    bodyTemplate: category === "aplus" ? "{{heroSubheadline}}" : null,
    metadata: category === "graphics" ? { icon: "✨", graphicsBucket: "lifestyle" } : { icon: "🖼️" },
  };
}

export function AdminImageLibraryModuleDialog({
  open,
  onOpenChange,
  category,
  template,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const isCreate = template == null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("✨");
  const [enabled, setEnabled] = useState(true);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setIcon(template.metadata?.icon ?? (category === "graphics" ? "✨" : "🖼️"));
      setEnabled(template.enabled);
      setPromptTemplate(template.promptTemplate);
    } else {
      const blank = blankDraft(category);
      setName("");
      setDescription("");
      setIcon(blank.metadata?.icon ?? "✨");
      setEnabled(true);
      setPromptTemplate(blank.promptTemplate);
    }
  }, [open, template, category]);

  async function invalidateTemplateLists() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "image-prompt-templates"] });
    await queryClient.invalidateQueries({ queryKey: ["image-prompt-templates"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "graphics-module-examples"] });
    await queryClient.invalidateQueries({ queryKey: ["graphics-module-examples"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const slug =
        template?.slug ??
        slugifyImagePromptTemplateName(trimmedName);
      const base = template ?? blankDraft(category);
      const saved = await saveAdminImagePromptTemplate({
        ...base,
        id: template?.id,
        slug,
        category,
        name: trimmedName,
        description: description.trim() || null,
        enabled,
        promptTemplate: promptTemplate.trim() || base.promptTemplate,
        metadata: {
          ...base.metadata,
          icon: icon.trim() || base.metadata?.icon,
        },
      });
      await invalidateTemplateLists();
      onOpenChange(false);
      onSaved?.(saved.slug);
      toast({
        title: isCreate ? "Module added" : "Module saved",
        description: `${saved.name} is available in this library.`,
      });
    } catch (e) {
      toast({
        title: "Could not save module",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template || template.isSystem) return;
    if (!window.confirm(`Delete module “${template.name}”? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteAdminImagePromptTemplate(template.id);
      await invalidateTemplateLists();
      onOpenChange(false);
      toast({ title: "Module deleted", description: template.name });
    } catch (e) {
      toast({
        title: "Could not delete",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  const skillHref = template
    ? `/admin/settings/ai/skills/image-prompt-${category}-${template.slug}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add module" : "Edit module"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Creates a new graphics type (like Hero Shot) for Product graphics or A+ modules."
              : "Update the label sellers see and the AI prompt for this module."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[min(52vh,420px)] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Module &amp; skill title</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hero Shot"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Skills list:{" "}
              <span className="font-medium text-slate-700">{imagePromptSkillCatalogTitle(name || "…")}</span>
            </p>
          </div>
          <div>
            <Label className="text-xs">Short description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="White background, product centered"
              className="mt-1"
            />
          </div>
          <div className="flex gap-3">
            <div className="w-20">
              <Label className="text-xs">Icon</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 text-center" />
            </div>
            <div className="flex-1 flex items-end gap-2 pb-0.5">
              <Switch id="module-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="module-enabled" className="text-xs font-normal">
                Show in library
              </Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Image prompt</Label>
            <Textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={5}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {category === "graphics" ? GRAPHICS_PLACEHOLDER_HELP : APLUS_PLACEHOLDER_HELP}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={saving || deleting || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : isCreate ? "Add module" : "Save changes"}
          </Button>
          {skillHref ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-orange-800 hover:text-orange-900 hover:bg-orange-50 gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(skillHref);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open full skill editor (marketplaces, agents)
            </Button>
          ) : null}
          {!isCreate && template && !template.isSystem ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-rose-200 text-rose-800 hover:bg-rose-50"
              disabled={saving || deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting…" : "Delete module"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
