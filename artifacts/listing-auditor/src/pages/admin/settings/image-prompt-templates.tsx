import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  APLUS_PLACEHOLDER_HELP,
  GRAPHICS_PLACEHOLDER_HELP,
  type ImagePromptTemplateAdmin,
  type ImagePromptTemplateCategory,
  deleteAdminImagePromptTemplate,
  saveAdminImagePromptTemplate,
  useAdminImagePromptTemplates,
} from "@/lib/image-prompt-templates";

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
    mutationFn: () =>
      saveAdminImagePromptTemplate({
        ...draft,
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

  function switchTab(next: ImagePromptTemplateCategory) {
    setTab(next);
    setSelectedId(null);
    setDraft(blankTemplate(next));
  }

  const placeholderHelp = tab === "graphics" ? GRAPHICS_PLACEHOLDER_HELP : APLUS_PLACEHOLDER_HELP;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-orange-500" />
          Image generation prompts
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage AI prompts for Create Graphics gallery types and A+ content image modules.
          Enabled templates appear in the graphics and A+ wizards.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === "graphics" ? "default" : "outline"}
          size="sm"
          onClick={() => switchTab("graphics")}
        >
          Product / gallery graphics
        </Button>
        <Button
          type="button"
          variant={tab === "aplus" ? "default" : "outline"}
          size="sm"
          onClick={() => switchTab("aplus")}
        >
          A+ image modules
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{tab === "graphics" ? "Graphics types" : "A+ modules"}</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={startCreate}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => startEdit(t)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                    selectedId === t.id ? "border-orange-300 bg-orange-50" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium flex items-center gap-1.5">
                    <span>{t.metadata?.icon ?? "✨"}</span>
                    {t.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{t.slug}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.enabled ? "Enabled" : "Disabled"}
                    {t.isSystem ? " · System" : ""}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedId === "new" ? "Create template" : active ? `Edit ${active.name}` : "Select a template"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedId == null ? (
              <p className="text-sm text-muted-foreground">Choose a template from the list or create a new one.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{placeholderHelp}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Name (shown in UI)</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={draft.slug}
                      onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                      disabled={draft.isSystem && selectedId !== "new"}
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
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      checked={draft.enabled}
                      onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                    />
                    <Label>Enabled in user wizards</Label>
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
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Switch
                          checked={draft.metadata?.isUserCustomType === true}
                          onCheckedChange={(v) =>
                            setDraft({
                              ...draft,
                              metadata: { ...draft.metadata, isUserCustomType: v },
                            })
                          }
                        />
                        <Label>User custom prompt type (no default template)</Label>
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
                    className="mt-1 min-h-[180px] font-mono text-xs"
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
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  {selectedId !== "new" && typeof selectedId === "number" && !draft.isSystem ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(selectedId)}
                      disabled={deleteMutation.isPending}
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
      </div>
    </div>
  );
}
