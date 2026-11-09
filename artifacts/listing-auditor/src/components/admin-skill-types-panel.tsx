import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useAdminSkillTypeMutations,
  useAdminSkillTypes,
  type AdminSkillType,
  type AdminSkillTypeCatalogGroup,
  type AdminSkillTypeEditorMode,
} from "@/lib/admin-skill-types";

/** Plain-language labels for admins (stored values stay technical in the database). */
function catalogLabel(group: AdminSkillTypeCatalogGroup): string {
  switch (group) {
    case "content":
      return "Product text";
    case "image":
      return "Images & A+";
    case "audit":
      return "Listing audit";
    default:
      return "Other";
  }
}

function editorLabel(mode: AdminSkillTypeEditorMode): string {
  switch (mode) {
    case "content":
      return "Product text editor";
    case "image":
      return "Image & A+ editor";
    case "audit":
      return "Audit results editor";
    default:
      return "Instructions only";
  }
}

function appUsageLabel(type: AdminSkillType): string {
  switch (type.handlerKey) {
    case "product_content":
      return "Live in product copy";
    case "listing_audit":
      return "Live in listing audits";
    case "product_images":
      return "Live in product images";
    case "aplus_content":
      return "Live in A+ content";
    case null:
    case undefined:
    case "":
      return type.isBuiltin ? "Live" : "Not live yet";
    default:
      return "Live";
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

const catalogSelect = (
  <SelectContent>
    <SelectItem value="content">Product text — titles, bullets, descriptions</SelectItem>
    <SelectItem value="image">Images & A+ — graphics prompts</SelectItem>
    <SelectItem value="audit">Listing audit — scores & feedback</SelectItem>
    <SelectItem value="other">Other</SelectItem>
  </SelectContent>
);

const editorSelect = (
  <SelectContent>
    <SelectItem value="content">Product text — preview titles & bullets</SelectItem>
    <SelectItem value="image">Images & A+ — prompt preview</SelectItem>
    <SelectItem value="audit">Listing audit — seller-style scores</SelectItem>
    <SelectItem value="generic">Instructions only — no preview yet</SelectItem>
  </SelectContent>
);

export function AdminSkillTypesPanel() {
  const { toast } = useToast();
  const { data: types = [], isLoading } = useAdminSkillTypes();
  const { createType, updateType, deleteType } = useAdminSkillTypeMutations();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [catalogGroup, setCatalogGroup] = useState<AdminSkillTypeCatalogGroup>("other");
  const [editorMode, setEditorMode] = useState<AdminSkillTypeEditorMode>("generic");
  const [deleteTarget, setDeleteTarget] = useState<AdminSkillType | null>(null);
  const [editTarget, setEditTarget] = useState<AdminSkillType | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCatalog, setEditCatalog] = useState<AdminSkillTypeCatalogGroup>("other");
  const [editEditor, setEditEditor] = useState<AdminSkillTypeEditorMode>("generic");
  const [editHandler, setEditHandler] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    if (!editTarget) return;
    setEditLabel(editTarget.label);
    setEditCatalog(editTarget.catalogGroup);
    setEditEditor(editTarget.editorMode);
    setEditHandler(editTarget.handlerKey ?? "");
    setEditDescription(editTarget.description ?? "");
  }, [editTarget]);

  const onAdd = () => {
    const s = slug.trim();
    const l = label.trim();
    if (!s || !l) {
      toast({ title: "Enter a type ID and display name", variant: "destructive" });
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

  const saveEdit = () => {
    if (!editTarget || editTarget.id <= 0) {
      toast({
        title: "Cannot save",
        description: "Reload the page and try again.",
        variant: "destructive",
      });
      return;
    }
    const nextLabel = editLabel.trim();
    if (!nextLabel) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    updateType.mutate(
      {
        id: editTarget.id,
        patch: {
          label: nextLabel,
          catalogGroup: editCatalog,
          editorMode: editEditor,
          description: editDescription.trim(),
          ...(!editTarget.isBuiltin
            ? { handlerKey: editHandler.trim() || null }
            : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Skill type updated", description: nextLabel });
          setEditTarget(null);
        },
        onError: (e: Error) => {
          toast({ title: "Save failed", description: e.message, variant: "destructive" });
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
    <section id="skill-types" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-6">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Tags className="w-4 h-4 text-orange-500" />
          Skill types
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Each type is a bucket for your skills (for example “Product text” or “Listing audit”). When you create a
          skill, you pick a type so the right editing screen and test preview appear. System defaults are already wired
          into the product; new types are for future features until your team marks them live.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-3">Name</th>
              <th className="py-3 pr-3">Type ID</th>
              <th className="py-3 pr-3">Listed as</th>
              <th className="py-3 pr-3">Editing screen</th>
              <th className="py-3 pr-3">In the product</th>
              <th className="py-3 pr-5 text-right w-[5.5rem]">Actions</th>
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
                          System default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">{t.slug}</td>
                  <td className="py-3 pr-3">
                    <CatalogBadge group={t.catalogGroup} />
                  </td>
                  <td className="py-3 pr-3 text-slate-600 text-xs">{editorLabel(t.editorMode)}</td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {appUsageLabel(t)}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-orange-700 hover:bg-orange-50"
                        aria-label={`Edit ${t.label}`}
                        onClick={() => setEditTarget(t)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
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
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-4 border-t border-orange-100/80 bg-orange-50/30">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-900/80 mb-1">Add a new type</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Use this when you need a new category of skill later (for example ads or video). Pick{" "}
          <strong>Instructions only</strong> until a preview is available.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-slate-600">Type ID</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="video_ads"
              className="mt-1 font-mono text-xs bg-white"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Short internal name. Use letters, numbers, underscores.</p>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Display name</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Video ads" className="mt-1 bg-white" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Listed as in skills table</Label>
            <Select value={catalogGroup} onValueChange={(v) => setCatalogGroup(v as AdminSkillTypeCatalogGroup)}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              {catalogSelect}
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Editing screen</Label>
            <Select value={editorMode} onValueChange={(v) => setEditorMode(v as AdminSkillTypeEditorMode)}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              {editorSelect}
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

      <Dialog open={editTarget != null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit skill type</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-1">
              <div>
                <Label className="text-xs text-muted-foreground">Type ID (cannot change)</Label>
                <Input value={editTarget.slug} readOnly className="mt-1 font-mono text-xs bg-slate-50" />
                {editTarget.isBuiltin && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    System defaults stay tied to core features. You can still change the display name, how it appears in
                    the list, and which editing screen opens.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Display name</Label>
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Listed as in skills table</Label>
                  <Select value={editCatalog} onValueChange={(v) => setEditCatalog(v as AdminSkillTypeCatalogGroup)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    {catalogSelect}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Editing screen</Label>
                  <Select value={editEditor} onValueChange={(v) => setEditEditor(v as AdminSkillTypeEditorMode)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    {editorSelect}
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                    What admins see when they open a skill of this type—including any “Run test” preview.
                  </p>
                </div>
              </div>
              {!editTarget.isBuiltin && (
                <div>
                  <Label className="text-xs">Technical connection (optional)</Label>
                  <Input
                    value={editHandler}
                    onChange={(e) => setEditHandler(e.target.value)}
                    placeholder="Leave blank — your dev team connects new types"
                    className="mt-1 font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Only needed when engineering hooks this type into the app.</p>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes for your team (optional)</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 text-xs min-h-[72px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={saveEdit}
              disabled={updateType.isPending}
            >
              {updateType.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill type?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.label}</strong> from the list. Delete or change any skills that still use
              this type first.
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
