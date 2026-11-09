import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

type AdminOverviewImageLibraryProps = {
  selectedCategory: string;
  onSelectedCategoryChange: (name: string) => void;
  coverageRows: CategoryCoverageRow[];
};

function visibleCount(examples: { exampleImages?: { url: string }[]; exampleImageUrl?: string | null }[]) {
  return examples.filter(
    (e) => (e.exampleImages?.length ?? 0) > 0 || Boolean(e.exampleImageUrl),
  ).length;
}

export function AdminOverviewImageLibrary({
  selectedCategory,
  onSelectedCategoryChange,
  coverageRows,
}: AdminOverviewImageLibraryProps) {
  const { toast } = useToast();
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
    selectedCategory,
    "graphics",
  );
  const { data: templatesData } = useAdminImagePromptTemplates("graphics");
  const { addExample } = useAdminProductCategoryMutations();

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

  return (
    <Card id="overview-image-library" className="scroll-mt-6 border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Image library</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Reference images set the style templates users can pick from, category by category. Edit global
          prompts under{" "}
          <Link href="/admin/settings/ai/skills" className="text-teal-700 underline">
            Skills → Graphics image prompts
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-1 max-h-[480px] overflow-y-auto">
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
                <h3 className="font-semibold text-base">{selectedCategory}</h3>
                <p className="text-xs text-muted-foreground">
                  {visibleToUsers} of {totalTypes || "—"} types have reference images for users
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground sr-only">Filter type</Label>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
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
                  const template = templates.find((t) => t.slug === item.templateSlug);
                  const promptSkillSlug = `image-prompt-graphics-${item.templateSlug}`;

                  return (
                    <div
                      key={item.templateSlug}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
                    >
                      <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                        {hasImages ? (
                          <ProtectedAppImage
                            src={imgs[0]!.url}
                            alt={item.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <span className="text-3xl opacity-30">{item.icon ?? "🖼️"}</span>
                        )}
                      </div>
                      <div className="p-3 space-y-2 border-t">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch checked={hasImages} disabled className="scale-90" />
                            <span className="text-[11px] text-muted-foreground">
                              {hasImages ? "Visible to users" : "Hidden"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <label className="flex-1 min-w-0">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={uploadingSlug === item.templateSlug}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void uploadForSlug(item.templateSlug, file);
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full h-8 text-xs gap-1"
                              disabled={uploadingSlug === item.templateSlug}
                              onClick={(e) => {
                                const input = (e.currentTarget.parentElement as HTMLLabelElement)?.querySelector(
                                  "input",
                                );
                                input?.click();
                              }}
                            >
                              {uploadingSlug === item.templateSlug ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              Upload
                            </Button>
                          </label>
                          <Link href={`/admin/settings/ai/skills/${promptSkillSlug}`}>
                            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs">
                              Prompt
                            </Button>
                          </Link>
                        </div>
                        {!template?.enabled && (
                          <p className="text-[10px] text-amber-800">Prompt skill disabled in admin</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Need more controls? Open{" "}
              <Link
                href={`/admin/settings/ai/skills#studio-references`}
                className="text-teal-700 underline"
              >
                Skills → Studio references
              </Link>{" "}
              for multi-image uploads per type.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
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
