import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ProtectedAppImage } from "@/components/protected-app-image";
import {
  uploadAdminGraphicsExampleImage,
  useAdminGraphicsModuleExamples,
  useAdminProductCategories,
  useAdminProductCategoryMutations,
} from "@/lib/graphics-module-examples";
import { useAdminImagePromptTemplates } from "@/lib/image-prompt-templates";
import type { CategoryCoverageRow } from "@/lib/admin-ai-skills-overview";

type CategoryReferenceLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory: string;
  coverageRows: CategoryCoverageRow[];
};

function visibleCount(examples: { exampleImages?: { url: string }[]; exampleImageUrl?: string | null }[]) {
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
            Reference images set the style templates users can pick from, category by category. Configure uploads
            here only—one card per graphics type.
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
  const bulkUploadRef = useRef<HTMLInputElement>(null);
  const { data: catData } = useAdminProductCategories();
  const categories = catData?.categories ?? [];
  const categoryNames = useMemo(() => {
    const fromCoverage = coverageRows.map((r) => r.category);
    const fromCatalog = categories.map((c) => c.name);
    return [...new Set([...fromCoverage, ...fromCatalog])];
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
  const { addExample, removeExample } = useAdminProductCategoryMutations();

  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);

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

  const visibleToUsers = visibleCount(mergedCards);
  const totalTypes = mergedCards.length;

  async function uploadForSlug(templateSlug: string, file: File) {
    setUploadingSlug(templateSlug);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await uploadAdminGraphicsExampleImage(dataUrl);
      await addExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        exampleImageUrl: url,
        templateCategory: "graphics",
      });
      toast({ title: "Image uploaded", description: `${templateSlug} · ${selectedCategory}` });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploadingSlug(null);
    }
  }

  async function clearAllForSlug(templateSlug: string) {
    setUploadingSlug(templateSlug);
    try {
      await removeExample.mutateAsync({
        productCategoryName: selectedCategory,
        templateSlug,
        templateCategory: "graphics",
      });
      toast({ title: "Hidden from users", description: templateSlug });
    } catch (e) {
      toast({
        title: "Could not remove",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploadingSlug(null);
    }
  }

  const filterLabel =
    filterSlug === "all"
      ? "All types"
      : (templates.find((t) => t.slug === filterSlug)?.name ?? filterSlug);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 min-h-[420px]">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-1 max-h-[min(560px,70vh)] overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-2">
          Categories
        </p>
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

      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">{selectedCategory}</h3>
            <p className="text-xs text-muted-foreground">
              {visibleToUsers} of {totalTypes || "—"} visible to users
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <input
              ref={bulkUploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const slug =
                  filterSlug !== "all"
                    ? filterSlug
                    : mergedCards.find(
                        (c) => !(c.exampleImages?.length || c.exampleImageUrl),
                      )?.templateSlug;
                if (!slug) {
                  toast({
                    title: "Pick a type",
                    description: "Choose a graphics type in the dropdown before uploading.",
                    variant: "destructive",
                  });
                  return;
                }
                void uploadForSlug(slug, file);
              }}
            />
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-teal-700 hover:bg-teal-800"
              onClick={() => bulkUploadRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Upload images
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredExamples.map((item) => {
              const imgs =
                item.exampleImages?.length
                  ? item.exampleImages
                  : item.exampleImageUrl
                    ? [{ id: 0, url: item.exampleImageUrl }]
                    : [];
              const hasImages = imgs.length > 0;
              const busy = uploadingSlug === item.templateSlug;

              return (
                <TemplateCard
                  key={item.templateSlug}
                  name={item.name}
                  icon={item.icon}
                  hasImages={hasImages}
                  previewUrl={imgs[0]?.url ?? null}
                  busy={busy}
                  onUploadFile={(file) => void uploadForSlug(item.templateSlug, file)}
                  onVisibilityChange={(visible) => {
                    if (!visible && hasImages) void clearAllForSlug(item.templateSlug);
                  }}
                />
              );
            })}
          </div>
        )}

        {filterSlug !== "all" && (
          <p className="text-[11px] text-muted-foreground">Uploading to: {filterLabel}</p>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  name,
  icon,
  hasImages,
  previewUrl,
  busy,
  onUploadFile,
  onVisibilityChange,
}: {
  name: string;
  icon: string | null;
  hasImages: boolean;
  previewUrl: string | null;
  busy: boolean;
  onUploadFile: (file: File) => void;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col shadow-sm">
      <h4 className="px-3 pt-3 text-sm font-medium truncate">{name}</h4>
      <div className="mt-2 mx-3 aspect-square bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
        {hasImages && previewUrl ? (
          <ProtectedAppImage src={previewUrl} alt={name} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-4xl opacity-25">{icon ?? "🖼️"}</span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2 border-t mt-2">
        <span className="text-[11px] text-muted-foreground">
          {hasImages ? "Visible to users" : "Hidden"}
        </span>
        <Switch
          checked={hasImages}
          disabled={busy}
          onCheckedChange={(visible) => {
            if (visible && !hasImages) uploadInputRef.current?.click();
            else onVisibilityChange(visible);
          }}
          className="scale-90"
        />
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUploadFile(file);
        }}
      />
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
