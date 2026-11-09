import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  uploadAdminGraphicsExampleImage,
  useAdminGraphicsModuleExamples,
  useAdminProductCategories,
  useAdminProductCategoryMutations,
  type GraphicsModuleExampleItem,
} from "@/lib/graphics-module-examples";
import { useAdminImagePromptTemplates } from "@/lib/image-prompt-templates";
import type { CategoryCoverageRow } from "@/lib/admin-ai-skills-overview";
import { GraphicsModuleExamplesGrid } from "@/components/graphics-module-examples-grid";

type CategoryReferenceLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory: string;
  coverageRows: CategoryCoverageRow[];
};

function visibleTypeCount(examples: GraphicsModuleExampleItem[]) {
  return examples.filter(
    (e) => (e.exampleImages?.length ?? 0) > 0 || Boolean(e.exampleImageUrl),
  ).length;
}

export function CategoryReferenceLibraryDialog({
  open,
  onOpenChange,
  initialCategory,
  coverageRows,
}: CategoryReferenceLibraryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  useEffect(() => {
    if (open) setSelectedCategory(initialCategory);
  }, [open, initialCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col gap-3 p-0">
        <DialogHeader className="px-6 pt-6 pb-0 space-y-1">
          <DialogTitle>Image library</DialogTitle>
          <DialogDescription>
            Reference images set the style templates users can pick from, category by category. Upload several images
            per module (e.g. Hero Shot) with <strong>Add another</strong> on each card—only for the selected category.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <CategoryReferenceLibraryBody
            selectedCategory={selectedCategory}
            onSelectedCategoryChange={setSelectedCategory}
            coverageRows={coverageRows}
            enabled={open}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

type BodyProps = {
  selectedCategory: string;
  onSelectedCategoryChange: (name: string) => void;
  coverageRows: CategoryCoverageRow[];
  enabled: boolean;
};

function CategoryReferenceLibraryBody({
  selectedCategory,
  onSelectedCategoryChange,
  coverageRows,
  enabled,
}: BodyProps) {
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const { data: catData } = useAdminProductCategories();
  const categories = catData?.categories ?? [];
  const categoryNames = useMemo(() => {
    const fromCoverage = coverageRows.map((r) => r.category);
    const fromCatalog = categories.map((c) => c.name);
    return [...new Set([...fromCoverage, ...fromCatalog])].sort((a, b) => a.localeCompare(b));
  }, [coverageRows, categories]);

  const refCountByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of coverageRows) m.set(row.category, row.approvedRefCount);
    return m;
  }, [coverageRows]);

  const { data: examplesData, isLoading } = useAdminGraphicsModuleExamples(
    enabled ? selectedCategory : null,
    "graphics",
  );
  const { data: templatesData } = useAdminImagePromptTemplates("graphics");
  const { createCategory, addExample, removeExample } = useAdminProductCategoryMutations();

  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const examples = examplesData?.examples ?? [];
  const templates = templatesData?.templates ?? [];

  const mergedCards = useMemo(() => {
    const bySlug = new Map(examples.map((e) => [e.templateSlug, e]));
    const source = templates.filter((t) => t.enabled);
    return source.map((t) => {
      const ex = bySlug.get(t.slug);
      if (ex) return ex;
      return {
        templateSlug: t.slug,
        name: t.name,
        description: t.description ?? null,
        icon: t.metadata?.icon ?? null,
        exampleImageUrl: null,
        exampleImages: [] as { id: number; url: string }[],
        sortOrder: t.sortOrder,
      };
    });
  }, [examples, templates]);

  const filteredExamples =
    filterSlug === "all"
      ? mergedCards
      : mergedCards.filter((e) => e.templateSlug === filterSlug);

  const visibleToUsers = visibleTypeCount(mergedCards);
  const totalTypes = mergedCards.length;

  async function handleUpload(templateSlug: string, dataUrl: string) {
    setSavingSlug(templateSlug);
    try {
      const url = await uploadAdminGraphicsExampleImage(dataUrl);
      await addExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        exampleImageUrl: url,
        templateCategory: "graphics",
      });
      toast({ title: "Example added", description: `${templateSlug} · ${selectedCategory}` });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: (e as Error).message,
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
        templateCategory: "graphics",
      });
      toast({ title: "Image removed" });
    } catch (e) {
      toast({
        title: "Remove failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleClearAll(templateSlug: string) {
    if (!window.confirm(`Remove all reference images for “${templateSlug}” in ${selectedCategory}?`)) return;
    setSavingSlug(templateSlug);
    try {
      await removeExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        templateCategory: "graphics",
      });
      toast({ title: "Module hidden", description: "No images left for this type in this category." });
    } catch (e) {
      toast({
        title: "Could not remove",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSavingSlug(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 min-h-[420px]">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex flex-col gap-2 max-h-[min(560px,70vh)]">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-1">
          Categories
        </p>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {categoryNames.map((name) => {
            const count = refCountByCategory.get(name) ?? 0;
            const active = name === selectedCategory;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectedCategoryChange(name)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                  active
                    ? "bg-teal-50 border border-teal-200 font-medium text-teal-900"
                    : "hover:bg-white border border-transparent",
                )}
              >
                <span className="truncate">{name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    count > 0 ? "bg-slate-200 text-slate-700" : "bg-rose-100 text-rose-800",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Add category
          </p>
          <div className="flex gap-1.5">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Supplements"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 px-2"
              disabled={!newCategoryName.trim() || createCategory.isPending}
              title="Create category"
              onClick={() => {
                const name = newCategoryName.trim();
                createCategory.mutate(name, {
                  onSuccess: () => {
                    setNewCategoryName("");
                    onSelectedCategoryChange(name);
                    toast({ title: "Category added", description: name });
                  },
                  onError: (err: Error) => {
                    toast({
                      title: "Could not add category",
                      description: err.message,
                      variant: "destructive",
                    });
                  },
                });
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <div
          className="rounded-lg border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-950"
          role="status"
        >
          Uploads apply only to <span className="font-semibold">{selectedCategory}</span>. Pick that category on the
          left before adding Hero Shot or other module images.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">{selectedCategory}</h3>
            <p className="text-xs text-muted-foreground">
              {visibleToUsers} of {totalTypes || "—"} graphics types have reference images
            </p>
          </div>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm min-w-[140px]"
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value)}
          >
            <option value="all">All types</option>
            {templates.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <GraphicsModuleExamplesGrid
            mode="admin"
            examples={filteredExamples}
            resolvedCategory={examplesData?.resolvedCategory ?? selectedCategory}
            isLoading={false}
            savingSlug={savingSlug}
            onUpload={handleUpload}
            onRemoveExample={handleRemoveExample}
            onClearAll={handleClearAll}
          />
        )}
      </div>
    </div>
  );
}
