import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Plus } from "lucide-react";
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
import { useAdminImagePromptTemplates, type ImagePromptTemplateCategory } from "@/lib/image-prompt-templates";
import type { CategoryCoverageRow } from "@/lib/admin-ai-skills-overview";
import { GraphicsModuleExamplesGrid } from "@/components/graphics-module-examples-grid";

const CATEGORIES_PER_PAGE = 12;

type CategoryReferenceLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory: string;
  coverageRows: CategoryCoverageRow[];
  initialTemplateCategory?: ImagePromptTemplateCategory;
  /** When set, module filter preselects this template slug (e.g. brand_story). */
  initialFilterSlug?: string;
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
  initialTemplateCategory = "graphics",
  initialFilterSlug,
}: CategoryReferenceLibraryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [templateCategory, setTemplateCategory] =
    useState<ImagePromptTemplateCategory>(initialTemplateCategory);

  useEffect(() => {
    if (open) {
      setSelectedCategory(initialCategory);
      setTemplateCategory(initialTemplateCategory);
    }
  }, [open, initialCategory, initialTemplateCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col gap-3 p-0">
        <DialogHeader className="px-6 pt-6 pb-0 space-y-1">
          <DialogTitle>Image library</DialogTitle>
          <DialogDescription>
            Upload reference images per category and module. Switch <strong>Product graphics</strong> or{" "}
            <strong>A+ modules</strong> below. To add or edit module prompts, use{" "}
            <Link href="/admin/settings/ai/skills" className="text-orange-600 underline">
              Skills
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <CategoryReferenceLibraryBody
            selectedCategory={selectedCategory}
            onSelectedCategoryChange={setSelectedCategory}
            coverageRows={coverageRows}
            enabled={open}
            templateCategory={templateCategory}
            onTemplateCategoryChange={setTemplateCategory}
            initialFilterSlug={initialFilterSlug}
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
  templateCategory: ImagePromptTemplateCategory;
  onTemplateCategoryChange: (v: ImagePromptTemplateCategory) => void;
  initialFilterSlug?: string;
};

function CategoryReferenceLibraryBody({
  selectedCategory,
  onSelectedCategoryChange,
  coverageRows,
  enabled,
  templateCategory,
  onTemplateCategoryChange,
  initialFilterSlug,
}: BodyProps) {
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryPage, setCategoryPage] = useState(0);
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

  const categoryPageCount = Math.max(1, Math.ceil(categoryNames.length / CATEGORIES_PER_PAGE));

  useEffect(() => {
    const idx = categoryNames.indexOf(selectedCategory);
    if (idx >= 0) {
      setCategoryPage(Math.floor(idx / CATEGORIES_PER_PAGE));
    }
  }, [selectedCategory, categoryNames]);

  const pagedCategoryNames = useMemo(() => {
    const start = categoryPage * CATEGORIES_PER_PAGE;
    return categoryNames.slice(start, start + CATEGORIES_PER_PAGE);
  }, [categoryNames, categoryPage]);

  const { data: examplesData, isLoading } = useAdminGraphicsModuleExamples(
    enabled ? selectedCategory : null,
    templateCategory,
  );
  const { data: templatesData } = useAdminImagePromptTemplates(templateCategory);
  const { createCategory, addExample, removeExample } = useAdminProductCategoryMutations();

  const [filterSlug, setFilterSlug] = useState<string>("all");

  useEffect(() => {
    if (initialFilterSlug) setFilterSlug(initialFilterSlug);
    else setFilterSlug("all");
  }, [initialFilterSlug, templateCategory, selectedCategory]);
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
        templateCategory,
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
        templateCategory,
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
        templateCategory,
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
      <div className="rounded-lg border border-orange-200/70 bg-orange-50/30 p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-orange-900/80 uppercase tracking-wide px-2 pb-1">
          Categories
        </p>
        <div className="space-y-1 min-h-[min(360px,44vh)]">
          {pagedCategoryNames.map((name) => {
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
                    ? "bg-orange-100 border border-orange-300 font-medium text-orange-950 shadow-sm"
                    : "hover:bg-white/90 border border-transparent hover:border-orange-100",
                )}
              >
                <span className="truncate">{name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    count > 0 ? "bg-orange-200/80 text-orange-950" : "bg-rose-100 text-rose-800",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {categoryNames.length > CATEGORIES_PER_PAGE ? (
          <div className="flex items-center justify-between gap-1 border-t border-orange-200/60 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-orange-900 hover:bg-orange-100"
              disabled={categoryPage <= 0}
              aria-label="Previous categories"
              onClick={() => setCategoryPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[10px] text-orange-900/70 tabular-nums">
              {categoryPage + 1} / {categoryPageCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-orange-900 hover:bg-orange-100"
              disabled={categoryPage >= categoryPageCount - 1}
              aria-label="Next categories"
              onClick={() => setCategoryPage((p) => Math.min(categoryPageCount - 1, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
        <div className="pt-2 border-t border-orange-200/60 space-y-2">
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
              className="shrink-0 px-2 bg-orange-600 hover:bg-orange-700 text-white"
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={templateCategory === "graphics" ? "default" : "outline"}
            className={templateCategory === "graphics" ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200"}
            onClick={() => onTemplateCategoryChange("graphics")}
          >
            Product graphics
          </Button>
          <Button
            type="button"
            size="sm"
            variant={templateCategory === "aplus" ? "default" : "outline"}
            className={templateCategory === "aplus" ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200"}
            onClick={() => onTemplateCategoryChange("aplus")}
          >
            A+ modules
          </Button>
        </div>

        <div
          className="rounded-lg border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-950"
          role="status"
        >
          References for <span className="font-semibold">{selectedCategory}</span> only. Pick that category on the left,
          then upload one image per {templateCategory === "aplus" ? "A+ module" : "graphics type"}.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">{selectedCategory}</h3>
            <p className="text-xs text-muted-foreground">
              {visibleToUsers} of {totalTypes || "—"}{" "}
              {templateCategory === "aplus" ? "A+ modules" : "graphics types"} have reference images
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-orange-200 bg-white px-2 text-sm min-w-[140px]"
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
            <Link href="/admin/settings/ai/skills">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 border-orange-200 text-orange-900 hover:bg-orange-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Manage modules
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <GraphicsModuleExamplesGrid
            mode="admin"
            adminAccent="orange"
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
