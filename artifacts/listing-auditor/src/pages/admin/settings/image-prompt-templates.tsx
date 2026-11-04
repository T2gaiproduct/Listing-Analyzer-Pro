import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  APLUS_PLACEHOLDER_HELP,
  GRAPHICS_PLACEHOLDER_HELP,
  type ImagePromptTemplateAdmin,
  type ImagePromptTemplateCategory,
  deleteAdminImagePromptTemplate,
  saveAdminImagePromptTemplate,
  slugifyImagePromptTemplateName,
  useAdminImagePromptTemplates,
} from "@/lib/image-prompt-templates";
import { AdminGraphicsModuleExamplesPanel } from "@/pages/admin/settings/graphics-module-examples-panel";
import { AdminGraphicsSellerPreview } from "@/pages/admin/settings/admin-graphics-seller-preview";

function blankTemplate(category: ImagePromptTemplateCategory): ImagePromptTemplateAdmin {
  return {
    id: 0,
    slug: "",
    category,
    name: "",
    description: "",
    enabled: true,
    isSystem: false,
    sortOrder: 100,
    promptTemplate: category === "graphics"
      ? "Product image for {{productDesc}}. Professional e-commerce photography."
      : "Amazon A+ banner for {{productDesc}}. {{aplusEdgeToEdge}} Premium design.",
    headlineTemplate: category === "aplus" ? "{{heroHeadline}}" : null,
    bodyTemplate: category === "aplus" ? "{{heroSubheadline}}" : null,
    metadata: category === "graphics"
      ? { icon: "✨", graphicsBucket: "lifestyle" }
      : { icon: "🖼️" },
  };
}

export default function AdminSettingsImagePromptTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ImagePromptTemplateCategory>("graphics");
  const [studioCategory, setStudioCategory] = useState("Default");
  const { data, isLoading } = useAdminImagePromptTemplates(tab);
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ImagePromptTemplateAdmin>(blankTemplate("graphics"));

  const active = useMemo(() => {
    if (selectedId === "new") return draft;
    if (selectedId == null) return null;
    return templates.find((t) => t.id === selectedId) ?? null;
  }, [draft, templates, selectedId]);

  const saveMutation = useMutation({
    mutationFn: (payload: ImagePromptTemplateAdmin) =>
      saveAdminImagePromptTemplate({
        ...payload,
        category: tab,
        id: selectedId === "new" ? undefined : (selectedId as number),
      }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "image-prompt-templates"] });
      await queryClient.invalidateQueries({ queryKey: ["image-prompt-templates"] });
      setSelectedId(saved.id);
      setDraft(saved);
      toast({ title: "Saved", description: `${saved.name} updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminImagePromptTemplate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "image-prompt-templates"] });
      await queryClient.invalidateQueries({ queryKey: ["image-prompt-templates"] });
      setSelectedId(null);
      toast({ title: "Deleted", description: "Template removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  function startEdit(t: ImagePromptTemplateAdmin) {
    setSelectedId(t.id);
    setDraft(t);
  }

  function startCreate() {
    setSelectedId("new");
    setDraft(blankTemplate(tab));
  }

  function handleSave() {
    const slug = (draft.slug.trim() || slugifyImagePromptTemplateName(draft.name)).trim();
    if (!draft.name.trim()) {
      toast({ title: "Name required", description: "Enter a display name for this template.", variant: "destructive" });
      return;
    }
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast({
        title: "Invalid slug",
        description: "Use lowercase letters, numbers, and hyphens (e.g. my-gallery-shot).",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({ ...draft, slug });
  }

  function handleDeleteTemplate(t: ImagePromptTemplateAdmin) {
    if (t.isSystem) {
      toast({
        title: "Cannot delete system template",
        description: "Turn off “Enabled in user wizards” to hide it from the frontend, or delete custom templates only.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Delete “${t.name}”? It will be removed from admin and user wizards.`)) return;
    deleteMutation.mutate(t.id);
  }

  function switchTab(next: ImagePromptTemplateCategory) {
    setTab(next);
    setSelectedId(null);
    setDraft(blankTemplate(next));
  }

  useEffect(() => {
    if (isLoading || templates.length === 0 || selectedId != null) return;
    startEdit(templates[0]!);
  }, [isLoading, templates, selectedId]);

  const placeholderHelp = tab === "graphics" ? GRAPHICS_PLACEHOLDER_HELP : APLUS_PLACEHOLDER_HELP;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-7 h-7 text-orange-500" />
          Image generation prompts
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Configure AI prompts, studio reference images, and what sellers see in Create Graphics and A+ wizards.
          Seller Customize text is appended to these admin prompts.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant={tab === "graphics" ? "default" : "outline"}
            size="sm"
            className={tab === "graphics" ? "bg-orange-500 hover:bg-orange-600" : ""}
            onClick={() => switchTab("graphics")}
          >
            Product / gallery graphics
          </Button>
          <Button
            type="button"
            variant={tab === "aplus" ? "default" : "outline"}
            size="sm"
            className={tab === "aplus" ? "bg-orange-500 hover:bg-orange-600" : ""}
            onClick={() => switchTab("aplus")}
          >
            A+ image modules
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Studio references</h2>
        </div>
        <AdminGraphicsModuleExamplesPanel
          selectedCategory={studioCategory}
          onSelectedCategoryChange={setStudioCategory}
          templateCategory={tab}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {tab === "graphics" ? "Graphics types & prompts" : "A+ modules & prompts"}
        </h2>

        <div
          className={cn(
            "grid gap-4",
            "grid-cols-1 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,340px)]",
          )}
        >
          {/* Template list */}
          <Card className="shadow-none border-slate-200 h-fit xl:sticky xl:top-4">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">
                  {tab === "graphics" ? "Graphics types" : "A+ modules"}
                </CardTitle>
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={startCreate}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-normal mt-1">
                {templates.filter((t) => t.enabled).length} enabled · {templates.length} total
              </p>
            </CardHeader>
            <CardContent className="p-2 max-h-[min(60vh,520px)] overflow-y-auto space-y-1">
              {isLoading ? (
                <p className="text-xs text-muted-foreground px-2 py-4">Loading…</p>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-4">No templates yet.</p>
              ) : (
                templates.map((t) => {
                  const selected = selectedId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => startEdit(t)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                        selected
                          ? "border-orange-300 bg-orange-50/90 shadow-none"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-lg">
                          {t.metadata?.icon ?? "✨"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{t.slug}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Badge
                              variant={t.enabled ? "default" : "secondary"}
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-5 font-normal",
                                t.enabled && "bg-emerald-600 hover:bg-emerald-600",
                              )}
                            >
                              {t.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            {t.isSystem ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                System
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                Custom
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Editor */}
          <Card className="shadow-none border-slate-200 min-w-0">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold">
                {selectedId === "new" ? "Create template" : active ? `Edit · ${active.name}` : "Template editor"}
              </CardTitle>
              {active ? (
                <p className="text-xs text-muted-foreground font-normal mt-1 font-mono">{active.slug}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {selectedId == null ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 px-6 text-center">
                  <p className="text-sm font-medium text-slate-700">Pick a type from the list</p>
                  <p className="text-xs text-slate-500 mt-1">Or create a new custom graphics type.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={startCreate}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New template
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    {placeholderHelp}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Name (shown in UI)</Label>
                      <Input
                        value={draft.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setDraft((prev) => ({
                            ...prev,
                            name,
                            slug:
                              selectedId === "new" && !prev.slug.trim()
                                ? slugifyImagePromptTemplateName(name)
                                : prev.slug,
                          }));
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={draft.slug}
                        onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                        disabled={draft.isSystem && selectedId !== "new"}
                        placeholder="auto-generated-from-name"
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label>Sort order</Label>
                      <Input
                        type="number"
                        value={draft.sortOrder}
                        onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <Switch
                        checked={draft.enabled}
                        onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                      />
                      <Label className="leading-snug">Enabled in user wizards</Label>
                    </div>
                    {tab === "graphics" ? (
                      <>
                        <div>
                          <Label>Icon (emoji)</Label>
                          <Input
                            value={draft.metadata?.icon ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                metadata: { ...draft.metadata, icon: e.target.value },
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Storage bucket</Label>
                          <select
                            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={draft.metadata?.graphicsBucket ?? "lifestyle"}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                metadata: {
                                  ...draft.metadata,
                                  graphicsBucket: e.target.value as "feature" | "lifestyle",
                                },
                              })
                            }
                          >
                            <option value="lifestyle">Lifestyle slot</option>
                            <option value="feature">Feature / infographic slot</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <Label>Icon (emoji)</Label>
                        <Input
                          value={draft.metadata?.icon ?? ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              metadata: { ...draft.metadata, icon: e.target.value },
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Description (shown to users)</Label>
                    <Input
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Image prompt template</Label>
                    <Textarea
                      value={draft.promptTemplate}
                      onChange={(e) => setDraft({ ...draft, promptTemplate: e.target.value })}
                      className="mt-1 min-h-[200px] font-mono text-xs"
                    />
                  </div>
                  {tab === "aplus" ? (
                    <>
                      <div>
                        <Label>Headline template (module card)</Label>
                        <Input
                          value={draft.headlineTemplate ?? ""}
                          onChange={(e) => setDraft({ ...draft, headlineTemplate: e.target.value })}
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Body template (module card)</Label>
                        <Input
                          value={draft.bodyTemplate ?? ""}
                          onChange={(e) => setDraft({ ...draft, bodyTemplate: e.target.value })}
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    {selectedId !== "new" && typeof selectedId === "number" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteTemplate(draft)}
                        disabled={deleteMutation.isPending || draft.isSystem}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title={draft.isSystem ? "System templates cannot be deleted" : undefined}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="xl:sticky xl:top-4 h-fit">
            <AdminGraphicsSellerPreview
              productCategory={studioCategory}
              template={active}
              templateCategory={tab}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
