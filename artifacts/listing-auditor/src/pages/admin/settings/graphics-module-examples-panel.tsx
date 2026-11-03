import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraphicsModuleExamplesGrid } from "@/components/graphics-module-examples-grid";
import {
  uploadAdminGraphicsExampleImage,
  useAdminGraphicsModuleExamples,
  useAdminProductCategories,
  useAdminProductCategoryMutations,
} from "@/lib/graphics-module-examples";

export function AdminGraphicsModuleExamplesPanel() {
  const { toast } = useToast();
  const { data: categoriesData } = useAdminProductCategories();
  const categories = categoriesData?.categories ?? [];
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const [selectedCategory, setSelectedCategory] = useState("Default");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const { data: examplesData, isLoading } = useAdminGraphicsModuleExamples(selectedCategory);
  const { createCategory, removeCategory, addExample, removeExample } = useAdminProductCategoryMutations();

  async function handleUpload(templateSlug: string, dataUrl: string) {
    setSavingSlug(templateSlug);
    try {
      const url = await uploadAdminGraphicsExampleImage(dataUrl);
      await addExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        exampleImageUrl: url,
      });
      toast({ title: "Example added", description: `Added image for ${templateSlug} (${selectedCategory}).` });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not save example image.",
        variant: "destructive",
      });
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleRemoveExample(templateSlug: string, exampleId: number) {
    setSavingSlug(templateSlug);
    try {
      await removeExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        exampleId,
      });
      toast({ title: "Example removed" });
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Could not remove example.",
        variant: "destructive",
      });
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleClearAll(templateSlug: string) {
    if (!window.confirm(`Remove all studio examples for “${templateSlug}” in ${selectedCategory}?`)) return;
    setSavingSlug(templateSlug);
    try {
      await removeExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
      });
      toast({ title: "All examples removed" });
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Could not remove examples.",
        variant: "destructive",
      });
    } finally {
      setSavingSlug(null);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm">Graphics studio examples (by product category)</CardTitle>
        <p className="text-xs text-muted-foreground font-normal mt-1">
          Upload several reference images per module (use <strong>Add another</strong> on each card). Sellers can
          pick which examples to use as AI references when customizing a graphics type. Missing category images fall
          back to Default.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="rounded-lg border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-950"
          role="status"
        >
          Uploads apply only to{" "}
          <span className="font-semibold">{selectedCategory}</span>
          {selectedCategory === "Default" ? (
            <span className="block text-xs text-orange-900/80 mt-1">
              Default is the fallback library merged into other categories on the seller dashboard when
              they have fewer images for a module. For Alexa-only examples, choose{" "}
              <strong>Alexa Skills</strong> first, then upload.
            </span>
          ) : (
            <span className="block text-xs text-orange-900/80 mt-1">
              Sellers in Create Graphics also see Default examples for a module if this category has
              fewer than Default.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Product category</Label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Add category (also appears on Upload)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Supplements"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!newCategoryName.trim() || createCategory.isPending}
                onClick={() => {
                  const name = newCategoryName.trim();
                  createCategory.mutate(name, {
                    onSuccess: () => {
                      setNewCategoryName("");
                      setSelectedCategory(name);
                      toast({ title: "Category added", description: name });
                    },
                    onError: (err: Error) => {
                      toast({ title: "Could not add category", description: err.message, variant: "destructive" });
                    },
                  });
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {categories
          .filter((c) => !c.isSystem && c.name !== "Default")
          .length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => !c.isSystem)
              .map((c) => (
                <div
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs"
                >
                  {c.name}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600 p-0.5"
                    title="Delete custom category"
                    onClick={() => {
                      if (!window.confirm(`Delete category “${c.name}” and its example images?`)) return;
                      removeCategory.mutate(c.id, {
                        onSuccess: () => {
                          if (selectedCategory === c.name) setSelectedCategory("Default");
                          toast({ title: "Category deleted" });
                        },
                        onError: (err: Error) => {
                          toast({ title: "Delete failed", description: err.message, variant: "destructive" });
                        },
                      });
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>
        ) : null}

        <GraphicsModuleExamplesGrid
          mode="admin"
          examples={examplesData?.examples ?? []}
          resolvedCategory={examplesData?.resolvedCategory ?? selectedCategory}
          isLoading={isLoading}
          savingSlug={savingSlug}
          onUpload={handleUpload}
          onRemoveExample={handleRemoveExample}
          onClearAll={handleClearAll}
        />
      </CardContent>
    </Card>
  );
}
