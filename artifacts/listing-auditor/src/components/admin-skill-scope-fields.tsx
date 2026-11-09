import { useMemo } from "react";
import { Link } from "wouter";
import { AdminSearchableCategorySelect } from "@/components/admin-searchable-category-select";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentMarketplaceAdmin } from "@/lib/content-marketplaces";
import { configuredProductCategoryNames, useAdminProductCategories } from "@/lib/graphics-module-examples";
import type { SkillType } from "@/lib/admin-skill-editor";
import {
  findAdminSkillType,
  type AdminSkillType,
} from "@/lib/admin-skill-types";
import { useAdminSkillChatModels } from "@/lib/admin-skill-chat-models";
import { Loader2 } from "lucide-react";

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
  skillTypeOptions?: AdminSkillType[];
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
  skillTypeOptions = [],
  contentMarketplaceId,
}: AdminSkillScopeFieldsProps) {
  const typeMeta = findAdminSkillType(skillTypeOptions, skillType);
  const { data: catData } = useAdminProductCategories();
  const categories = catData?.categories ?? [];
  const categorySelectOptions = useMemo(() => {
    const fromCatalog = categories.map((c) => c.name).filter(Boolean);
    const configured = configuredProductCategoryNames(categories);
    const names = [...new Set([...fromCatalog, ...configured])].sort((a, b) => a.localeCompare(b));
    const current = category.trim();
    if (current && !names.includes(current)) {
      names.push(current);
      names.sort((a, b) => a.localeCompare(b));
    }
    return names;
  }, [categories, category]);

  const selectedMarketplace = marketplaces.find((m) => m.slug === marketplace);

  const skillTypeSelectOptions = useMemo(() => {
    if (skillTypeOptions.some((t) => t.slug === skillType)) return skillTypeOptions;
    if (typeMeta) return [typeMeta, ...skillTypeOptions];
    return skillTypeOptions;
  }, [skillType, skillTypeOptions, typeMeta]);

  const { data: chatModelsData, isLoading: chatModelsLoading } = useAdminSkillChatModels(skillType);
  const chatModelOptions = chatModelsData?.options ?? [];
  const emptyRouteValue = "__ai_settings__";
  const selectAiModel = aiModel.trim() ? aiModel : emptyRouteValue;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Skill type</Label>
          {isMarketplaceSkill ? (
            <p className="text-sm font-medium mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              {typeMeta?.label ?? "Product content"}
              <span className="text-xs text-muted-foreground font-normal block mt-0.5">
                Synced from Seller marketplace settings — type cannot be changed here.
              </span>
            </p>
          ) : (
            <Select
              value={skillType}
              onValueChange={(v) => onSkillTypeChange(v as SkillType)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select skill type" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {skillTypeSelectOptions.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!imageSkillEditorMode && (
          <div>
            <Label className="text-xs text-muted-foreground">AI model</Label>
            <Select
              value={selectAiModel}
              onValueChange={(v) => onAiModelChange(v === emptyRouteValue ? "" : v)}
              disabled={chatModelsLoading}
            >
              <SelectTrigger className="mt-1.5">
                {chatModelsLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading from AI Settings…
                  </span>
                ) : (
                  <SelectValue placeholder="Use AI Settings" />
                )}
              </SelectTrigger>
              <SelectContent>
                {chatModelOptions.map((m) => (
                  <SelectItem
                    key={m.value || "default"}
                    value={m.value.trim() ? m.value : emptyRouteValue}
                  >
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-[10px] text-muted-foreground leading-snug">{m.detail}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Options come from{" "}
              <Link href="/admin/settings/ai" className="text-orange-600 underline">
                Admin → AI Settings
              </Link>
              . Default follows use-case routing for this skill type.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Category</Label>
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
          ) : (
            <>
              <AdminSearchableCategorySelect
                value={category}
                onChange={onCategoryChange}
                options={categorySelectOptions}
                placeholder="Search categories…"
              />
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
    </div>
  );
}
