import { useState } from "react";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useAdminSkillTypeMutations,
  useAdminSkillTypes,
  type AdminSkillType,
  type AdminSkillTypeCatalogGroup,
  type AdminSkillTypeEditorMode,
} from "@/lib/admin-skill-types";

function catalogLabel(group: AdminSkillTypeCatalogGroup): string {
  switch (group) {
    case "content":
      return "Product content";
    case "image":
      return "Image";
    case "audit":
      return "Audit";
    default:
      return "Other";
  }
}

function editorLabel(mode: AdminSkillTypeEditorMode): string {
  switch (mode) {
    case "content":
      return "Content test";
    case "image":
      return "Image preview";
    case "audit":
      return "Audit keys";
    default:
      return "Generic";
  }
}

function CatalogBadge({ group }: { group: AdminSkillTypeCatalogGroup }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        group === "audit" && "border-orange-200 bg-orange-50 text-orange-900",
        group === "image" && "border-orange-200/70 bg-orange-50/60 text-orange-900",
        group === "content" && "border-slate-200 bg-slate-100 text-slate-700",
        group === "other" && "border-slate-200 bg-white text-slate-600",
      )}
    >
      {catalogLabel(group)}
    </span>
  );
}

export function AdminSkillTypesPanel() {
  const { toast } = useToast();
  const { data: types = [], isLoading } = useAdminSkillTypes();
  const { createType, deleteType } = useAdminSkillTypeMutations();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [catalogGroup, setCatalogGroup] = useState<AdminSkillTypeCatalogGroup>("other");
  const [editorMode, setEditorMode] = useState<AdminSkillTypeEditorMode>("generic");
  const [deleteTarget, setDeleteTarget] = useState<AdminSkillType | null>(null);

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

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteType.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Skill type removed", description: deleteTarget.label });
        setDeleteTarget(null);
      },
      onError: (e: Error) => {
        toast({ title: "Delete failed", description: e.message, variant: "destructive" });
      },
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Tags className="w-4 h-4 text-orange-500" />
          Skill types
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Admin-defined types for the skill catalog. Built-ins map to live product handlers; add types like{" "}
          <code className="text-[11px] text-orange-800/90">video</code> with a{" "}
          <strong>Generic</strong> editor until engineering wires a handler.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-3">Label</th>
              <th className="py-3 pr-3">Slug</th>
              <th className="py-3 pr-3">Catalog</th>
              <th className="py-3 pr-3">Editor</th>
              <th className="py-3 pr-3">Handler</th>
              <th className="py-3 pr-5 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Loading types…
                </td>
              </tr>
            )}
            {!isLoading &&
              types.map((t) => (
                <tr key={t.slug} className="border-b border-slate-50 hover:bg-orange-50/40 transition-colors">
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{t.label}</span>
                      {t.isBuiltin && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-800 border border-orange-200 bg-orange-50 rounded px-1.5 py-0">
                          Built-in
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">{t.slug}</td>
                  <td className="py-3 pr-3">
                    <CatalogBadge group={t.catalogGroup} />
                  </td>
                  <td className="py-3 pr-3 text-slate-600 text-xs">{editorLabel(t.editorMode)}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-slate-500">
                    {t.handlerKey ?? "—"}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    {!t.isBuiltin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${t.label}`}
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-300 pr-2">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-4 border-t border-orange-100/80 bg-orange-50/30">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-900/80 mb-3">Add skill type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-slate-600">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="video"
              className="mt-1 font-mono text-xs bg-white"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Video" className="mt-1 bg-white" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Catalog group</Label>
            <Select value={catalogGroup} onValueChange={(v) => setCatalogGroup(v as AdminSkillTypeCatalogGroup)}>
              <SelectTrigger className="mt-1 bg-white">
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
            <Label className="text-xs text-slate-600">Editor</Label>
            <Select value={editorMode} onValueChange={(v) => setEditorMode(v as AdminSkillTypeEditorMode)}>
              <SelectTrigger className="mt-1 bg-white">
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
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
            onClick={onAdd}
            disabled={createType.isPending}
          >
            {createType.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add skill type
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill type?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.label}</strong> (<code>{deleteTarget?.slug}</code>) from the registry. Skills
              still using this slug must be deleted or reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteType.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteType.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleteType.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
