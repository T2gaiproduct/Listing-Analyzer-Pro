import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Store, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  type ContentMarketplaceAdmin,
  deleteAdminContentMarketplace,
  saveAdminContentMarketplace,
  useAdminContentMarketplaces,
} from "@/lib/content-marketplaces";

function blankMarketplace(): ContentMarketplaceAdmin {
  return {
    id: 0,
    slug: "",
    name: "",
    description: "",
    enabled: true,
    isDefault: false,
    sortOrder: 100,
    aiInstructions: "Describe marketplace-specific title, bullet, keyword, and description rules here.",
    rules: { bulletCount: 5, keywordCount: 10 },
  };
}

export default function AdminSettingsContentMarketplaces() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminContentMarketplaces();
  const marketplaces = data?.marketplaces ?? [];

  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ContentMarketplaceAdmin>(blankMarketplace());

  const active = useMemo(() => {
    if (selectedId === "new") return draft;
    if (selectedId == null) return null;
    return marketplaces.find((m) => m.id === selectedId) ?? null;
  }, [draft, marketplaces, selectedId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAdminContentMarketplace(
        {
          slug: draft.slug,
          name: draft.name,
          description: draft.description,
          enabled: draft.enabled,
          isDefault: draft.isDefault,
          sortOrder: draft.sortOrder,
          aiInstructions: draft.aiInstructions,
          rules: draft.rules,
        },
        selectedId === "new" ? undefined : (selectedId as number),
      ),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-marketplaces"] });
      await queryClient.invalidateQueries({ queryKey: ["content-marketplaces"] });
      setSelectedId(saved.id);
      setDraft(saved);
      toast({ title: "Saved", description: `${saved.name} marketplace configuration updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminContentMarketplace(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-marketplaces"] });
      await queryClient.invalidateQueries({ queryKey: ["content-marketplaces"] });
      setSelectedId(null);
      toast({ title: "Deleted", description: "Marketplace removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  function startEdit(m: ContentMarketplaceAdmin) {
    setSelectedId(m.id);
    setDraft(m);
  }

  function startCreate() {
    setSelectedId("new");
    setDraft(blankMarketplace());
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Store className="w-6 h-6 text-orange-500" />
          Marketplace content generation
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage marketplace-specific AI instructions for Build Your Brand and Product Explorer listing content.
          Enabled marketplaces appear in the user Marketplace dropdown.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Marketplaces</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={startCreate}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              marketplaces.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => startEdit(m)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                    selectedId === m.id ? "border-orange-300 bg-orange-50" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.enabled ? "Enabled" : "Disabled"}
                    {m.isDefault ? " · Default" : ""}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedId === "new" ? "Create marketplace" : active ? `Edit ${active.name}` : "Select a marketplace"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedId == null ? (
              <p className="text-sm text-muted-foreground">Choose a marketplace from the list or create a new one.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
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
                      disabled={selectedId !== "new"}
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
                  <div className="flex items-end gap-6 pb-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draft.enabled}
                        onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                      />
                      <Label>Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draft.isDefault}
                        onCheckedChange={(v) => setDraft({ ...draft, isDefault: v })}
                      />
                      <Label>Default</Label>
                    </div>
                  </div>
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
                  <Label>AI instructions / prompt</Label>
                  <Textarea
                    value={draft.aiInstructions}
                    onChange={(e) => setDraft({ ...draft, aiInstructions: e.target.value })}
                    className="mt-1 min-h-[220px] font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Title max chars</Label>
                    <Input
                      type="number"
                      value={draft.rules?.titleMaxChars ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            titleMaxChars: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          },
                        })
                      }
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bullet count</Label>
                    <Input
                      type="number"
                      value={draft.rules?.bulletCount ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            bulletCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          },
                        })
                      }
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Keyword count</Label>
                    <Input
                      type="number"
                      value={draft.rules?.keywordCount ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            keywordCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          },
                        })
                      }
                      className="mt-1 h-8"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Formatting notes</Label>
                  <Textarea
                    value={draft.rules?.formattingNotes ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        rules: { ...draft.rules, formattingNotes: e.target.value || undefined },
                      })
                    }
                    className="mt-1 min-h-[72px] text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  {selectedId !== "new" && typeof selectedId === "number" ? (
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
