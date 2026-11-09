import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminSkillTypeMutations,
  useAdminSkillTypes,
  type AdminSkillTypeCatalogGroup,
  type AdminSkillTypeEditorMode,
} from "@/lib/admin-skill-types";

export function AdminSkillTypesPanel() {
  const { toast } = useToast();
  const { data: types = [], isLoading } = useAdminSkillTypes();
  const { createType } = useAdminSkillTypeMutations();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [catalogGroup, setCatalogGroup] = useState<AdminSkillTypeCatalogGroup>("other");
  const [editorMode, setEditorMode] = useState<AdminSkillTypeEditorMode>("generic");

  const onAdd = () => {
    const s = slug.trim();
    const l = label.trim();
    if (!s || !l) {
      toast({ title: "Enter slug and label", variant: "destructive" });
      return;
    }
    createType.mutate(
      { slug: s, label: l, catalogGroup, editorMode, description: "" },
      {
        onSuccess: () => {
          toast({ title: "Skill type added", description: l });
          setSlug("");
          setLabel("");
        },
        onError: (e: Error) => {
          toast({ title: "Could not add type", description: e.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Skill types</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Types are admin-defined (not hardcoded). Built-ins map to live features; add types like{" "}
          <code className="text-[11px]">video</code> or <code className="text-[11px]">manage_ads</code>{" "}
          with <strong>Generic</strong> editor until product code registers a handler.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading types…
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {types.map((t) => (
            <li
              key={t.slug}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 flex flex-col gap-0.5"
            >
              <span className="font-medium">{t.label}</span>
              <span className="text-[11px] text-muted-foreground font-mono">{t.slug}</span>
              <span className="text-[10px] text-slate-500">
                Catalog: {t.catalogGroup} · Editor: {t.editorMode}
                {t.handlerKey ? ` · Handler: ${t.handlerKey}` : " · No runtime handler yet"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <Label className="text-xs">Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="video"
            className="mt-1 font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Video"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Catalog group</Label>
          <Select value={catalogGroup} onValueChange={(v) => setCatalogGroup(v as AdminSkillTypeCatalogGroup)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Product content</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Editor</Label>
          <Select value={editorMode} onValueChange={(v) => setEditorMode(v as AdminSkillTypeEditorMode)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Content test</SelectItem>
              <SelectItem value="image">Image preview</SelectItem>
              <SelectItem value="audit">Audit keys</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" className="sm:col-span-2 lg:col-span-4 w-full sm:w-auto gap-2" onClick={onAdd} disabled={createType.isPending}>
          <Plus className="w-4 h-4" />
          Add skill type
        </Button>
      </div>
    </section>
  );
}
