import { useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { AdminSearchableCategorySelect } from "@/components/admin-searchable-category-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ContentMarketplaceAdmin } from "@/lib/content-marketplaces";
import {
  configuredProductCategoryNames,
  isConfiguredProductCategory,
  useAdminProductCategories,
  useAdminProductCategoryMutations,
} from "@/lib/graphics-module-examples";
import type { SkillType } from "@/lib/admin-skill-editor";

const AI_MODELS = [
  "Claude Sonnet 5.5",
  "GPT-5.4",
  "Gemini 2.5 Flash",
  "OpenAI GPT-4o",
] as const;

type AdminSkillScopeFieldsProps = {
  skillType: SkillType;
  onSkillTypeChange: (v: SkillType) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  marketplace: string;
  onMarketplaceChange: (v: string) => void;
  aiModel: string;
  onAiModelChange: (v: string) => void;
  marketplaces: ContentMarketplaceAdmin[];
  isMarketplaceSkill: boolean;
  isImagePromptSkill?: boolean;
  imageSkillEditorMode?: boolean;
  lockImageCategory?: boolean;
  contentMarketplaceId?: number | null;
};

export function AdminSkillScopeFields({
  skillType,
  onSkillTypeChange,
  category,
  onCategoryChange,
  marketplace,
  onMarketplaceChange,
  aiModel,
  onAiModelChange,
  marketplaces,
  isMarketplaceSkill,
  isImagePromptSkill = false,
  imageSkillEditorMode = false,
  lockImageCategory = false,
  contentMarketplaceId,
}: AdminSkillScopeFieldsProps) {
  const { toast } = useToast();
  const { data: catData } = useAdminProductCategories();
  const categories = catData?.categories ?? [];
  const configuredCategoryNames = configuredProductCategoryNames(categories);
  const categorySelectOptions = (() => {
    const names = [...configuredCategoryNames];
    const current = category.trim();
    if (current && !names.includes(current)) {
      names.push(current);
      names.sort((a, b) => a.localeCompare(b));
    }
    return names;
  })();
  const { createCategory, removeCategory } = useAdminProductCategoryMutations();
  const [newCategoryName, setNewCategoryName] = useState("");

  const selectedMarketplace = marketplaces.find((m) => m.slug === marketplace);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Skill type</Label>
          {imageSkillEditorMode ? (
            <p className="text-sm font-medium mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              Image generation
            </p>
          ) : (
            <Select
              value={skillType}
              onValueChange={(v) => onSkillTypeChange(v as SkillType)}
              disabled={isMarketplaceSkill || isImagePromptSkill}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listing_audit">Listing audit</SelectItem>
                <SelectItem value="product_content">Product content</SelectItem>
                <SelectItem value="product_images">Product images</SelectItem>
                <SelectItem value="aplus_content">A+ content</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {!imageSkillEditorMode && (
          <div>
            <Label className="text-xs text-muted-foreground">AI model</Label>
            <Select value={aiModel} onValueChange={onAiModelChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Category</Label>
            {!isMarketplaceSkill && (!isImagePromptSkill || imageSkillEditorMode) && (
              <Link
                href="/admin/settings/image-prompt-templates"
                className="text-[11px] text-orange-600 hover:underline"
              >
                Full category manager
              </Link>
            )}
          </div>
          {isMarketplaceSkill ? (
            <p className="text-sm text-muted-foreground mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              Marketplace content skills apply to all product categories for that marketplace.
            </p>
          ) : isImagePromptSkill && !imageSkillEditorMode ? (
            <p className="text-sm text-muted-foreground mt-1.5 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2">
              This skill is global for one graphics/A+ type (
              <span className="font-mono text-[11px]">template_slug</span> in instructions). Per-category{" "}
              <Link href="/admin/settings/ai/overview" className="text-orange-600 underline">
                reference images
              </Link>{" "}
              and optional category <strong>Product images</strong> skills are configured on the Skills list page.
            </p>
          ) : lockImageCategory && category.trim() ? (
            <p className="text-sm font-medium mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              {category.trim()}
              <span className="text-xs text-muted-foreground font-normal block mt-0.5">
                This image skill is scoped to one configured category. Add categories under{" "}
                <Link href="/admin/settings/ai/overview" className="text-orange-600 underline">
                  Overview → Image library
                </Link>
                .
              </span>
            </p>
          ) : (
            <>
              {imageSkillEditorMode ? (
                <AdminSearchableCategorySelect
                  value={category}
                  onChange={onCategoryChange}
                  options={categorySelectOptions}
                  placeholder="Search categories…"
                />
              ) : (
                <Select value={category || undefined} onValueChange={onCategoryChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!imageSkillEditorMode && (
                <>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="text-sm h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!newCategoryName.trim() || createCategory.isPending}
                      onClick={() => {
                        const name = newCategoryName.trim();
                        createCategory.mutate(name, {
                          onSuccess: () => {
                            setNewCategoryName("");
                            onCategoryChange(name);
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
                  {configuredCategoryNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categories
                        .filter((c) => isConfiguredProductCategory(c))
                        .map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px]"
                          >
                            {c.name}
                            <button
                              type="button"
                              className="text-slate-400 hover:text-red-600"
                              title={`Delete category ${c.name}`}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Delete category “${c.name}” and its reference images?`,
                                  )
                                ) {
                                  return;
                                }
                                removeCategory.mutate(c.id, {
                                  onSuccess: () => {
                                    if (category === c.name) onCategoryChange("");
                                    toast({ title: "Category deleted" });
                                  },
                                  onError: (err: Error) => {
                                    toast({
                                      title: "Delete failed",
                                      description: err.message,
                                      variant: "destructive",
                                    });
                                  },
                                });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </>
              )}
              {imageSkillEditorMode && categorySelectOptions.length === 0 && (
                <p className="text-xs text-amber-800 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                  No configured categories yet. Add one from{" "}
                  <Link href="/admin/settings/ai/overview" className="underline">
                    Overview → Image library
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </div>
        {!imageSkillEditorMode && (
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Marketplace</Label>
          {isMarketplaceSkill ? (
            <p className="text-sm font-medium mt-1.5 rounded-md border border-orange-200 bg-orange-50/50 px-3 py-2">
              {selectedMarketplace?.name ?? marketplace}
              <span className="text-xs text-muted-foreground font-normal block mt-0.5">
                Listing skill for this marketplace — display name and sort order are in Seller marketplace settings below.
              </span>
            </p>
          ) : isImagePromptSkill ? (
            <p className="text-sm text-muted-foreground mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              Not scoped to marketplace — edit the prompt in Image prompt settings below.
            </p>
          ) : (
            <Select value={marketplace} onValueChange={onMarketplaceChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {marketplaces.map((m) => (
                  <SelectItem key={m.id} value={m.slug}>
                    {m.name}
                    {!m.enabled ? " (disabled)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        )}
      </div>
      {!imageSkillEditorMode && (
      <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-3">
        <strong>Marketplace listing skills:</strong> create with{" "}
        <Link href="/admin/settings/ai/skills" className="text-orange-600 underline">
          New marketplace
        </Link>{" "}
        on the Skills page. <strong>Categories:</strong> add above or under{" "}
        <Link href="/admin/settings/image-prompt-templates" className="text-orange-600 underline">
          Image Prompts
        </Link>
        .
      </p>
      )}
      {imageSkillEditorMode && (
        <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-3">
          Category drives which reference library appears in <strong>Test output</strong>. Upload refs in{" "}
          <Link href="/admin/settings/ai/overview" className="text-orange-600 underline">
            Overview → Image library
          </Link>
          .
        </p>
      )}
    </div>
  );
}
