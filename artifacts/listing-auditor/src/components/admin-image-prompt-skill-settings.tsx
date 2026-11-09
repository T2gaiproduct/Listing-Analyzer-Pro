import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ImagePromptTemplateAdmin } from "@/lib/image-prompt-templates";
import { GRAPHICS_PLACEHOLDER_HELP, APLUS_PLACEHOLDER_HELP } from "@/lib/image-prompt-templates";

type Props = {
  value: ImagePromptTemplateAdmin;
  onChange: (next: ImagePromptTemplateAdmin) => void;
};

export function AdminImagePromptSkillSettings({ value, onChange }: Props) {
  const help = value.category === "aplus" ? APLUS_PLACEHOLDER_HELP : GRAPHICS_PLACEHOLDER_HELP;

  return (
    <div className="space-y-4 rounded-lg border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold">Image prompt settings</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shown in graphics / A+ generation. Saved with this skill when you publish or save draft.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Display name</Label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Slug</Label>
          <Input value={ value.slug } disabled className="mt-1 font-mono text-xs" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input
            value={value.description ?? ""}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Sort order</Label>
          <Input
            type="number"
            value={value.sortOrder}
            onChange={(e) =>
              onChange({ ...value, sortOrder: parseInt(e.target.value, 10) || 0 })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Input
            value={value.category === "graphics" ? "Product graphics" : "A+ module"}
            disabled
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Image prompt</Label>
        <Textarea
          value={value.promptTemplate}
          onChange={(e) => onChange({ ...value, promptTemplate: e.target.value })}
          className="mt-1 min-h-[120px] font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground mt-1">{help}</p>
      </div>
      {value.category === "aplus" && (
        <>
          <div>
            <Label className="text-xs">Headline template (optional)</Label>
            <Textarea
              value={value.headlineTemplate ?? ""}
              onChange={(e) => onChange({ ...value, headlineTemplate: e.target.value })}
              className="mt-1 min-h-[60px] font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Body template (optional)</Label>
            <Textarea
              value={value.bodyTemplate ?? ""}
              onChange={(e) => onChange({ ...value, bodyTemplate: e.target.value })}
              className="mt-1 min-h-[60px] font-mono text-xs"
            />
          </div>
        </>
      )}
    </div>
  );
}
