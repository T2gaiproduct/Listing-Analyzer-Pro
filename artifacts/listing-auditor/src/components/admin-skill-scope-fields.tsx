import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AdminSearchableCategorySelect } from "@/components/admin-searchable-category-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  createAdminMarketplaceChannel,
  slugFromMarketplaceName,
} from "@/lib/create-marketplace-channel";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CREATE_MARKETPLACE_VALUE = "__create_marketplace__";

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
  isNew?: boolean;
  onDeleteMarketplace?: () => void;
  marketplaceDeleteDisabled?: boolean;
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
  isNew = false,
  onDeleteMarketplace,
  marketplaceDeleteDisabled = false,
}: AdminSkillScopeFieldsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const typeMeta = findAdminSkillType(skillTypeOptions, skillType);
  const isProductContentType = skillType === "product_content";
  const [channelName, setChannelName] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [showAdvancedScope, setShowAdvancedScope] = useState(false);
  const [showChannelCreate, setShowChannelCreate] = useState(false);

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
  const derivedChannelSlug = channelSlug.trim() || slugFromMarketplaceName(channelName);

  const skillTypeSelectOptions = useMemo(() => {
    if (skillTypeOptions.some((t) => t.slug === skillType)) return skillTypeOptions;
    if (typeMeta) return [typeMeta, ...skillTypeOptions];
    return skillTypeOptions;
  }, [skillType, skillTypeOptions, typeMeta]);

  const { data: chatModelsData, isLoading: chatModelsLoading } = useAdminSkillChatModels(skillType);
  const chatModelOptions = chatModelsData?.options ?? [];
  const emptyRouteValue = "__ai_settings__";
  const selectAiModel = aiModel.trim() ? aiModel : emptyRouteValue;

  async function handleCreateChannel() {
    const n = channelName.trim();
    const s = derivedChannelSlug;
    if (!n || !s) {
      toast({ title: "Name and slug required", variant: "destructive" });
      return;
    }
    setCreatingChannel(true);
    try {
      const saved = await createAdminMarketplaceChannel(n, s);
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-marketplaces"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
      const skillSlug = saved.skillSlug ?? `marketplace-content-${saved.slug}`;
      toast({ title: "Sales channel created", description: n });
      navigate(`/admin/settings/ai/skills/${skillSlug}`);
    } catch (e) {
      toast({
        title: "Could not create channel",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setCreatingChannel(false);
    }
  }

  function renderProductContentMarketplaceSection() {
    if (isMarketplaceSkill) {
      return (
        <div className="mt-1.5 space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-3">
          <div>
            <p className="text-sm font-medium">{selectedMarketplace?.name ?? marketplace}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applies to all categories. Name and sort order: Marketplace settings below.
            </p>
          </div>
          {onDeleteMarketplace && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-700 border-red-200 hover:bg-red-50"
              disabled={marketplaceDeleteDisabled}
              onClick={() => onDeleteMarketplace()}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete sales channel
            </Button>
          )}
        </div>
      );
    }

    if (isNew && !showAdvancedScope) {
      return (
        <div className="mt-1.5 space-y-3 rounded-lg border border-orange-200 bg-orange-50/40 px-3 py-3">
          <p className="text-sm font-medium text-orange-950">Add a sales channel</p>
          <p className="text-xs text-muted-foreground">
            Creates a <strong className="font-medium text-orange-950">new</strong> marketplace skill and opens it —
            separate from the skill name above. One channel = one Product content skill (all categories).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sales channel name</Label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. TikTok Shop"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={channelSlug}
                onChange={(e) => setChannelSlug(e.target.value)}
                placeholder={derivedChannelSlug || "tiktok-shop"}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
              onClick={() => void handleCreateChannel()}
              disabled={creatingChannel}
            >
              {creatingChannel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add marketplace
            </Button>
            <button
              type="button"
              className="text-xs text-orange-800 underline"
              onClick={() => setShowAdvancedScope(true)}
            >
              Per-category skill instead
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-1.5 space-y-2">
        {!showChannelCreate ? (
          <Select
            value={marketplace}
            onValueChange={(v) => {
              if (v === CREATE_MARKETPLACE_VALUE) {
                setChannelName("");
                setChannelSlug("");
                setShowChannelCreate(true);
                return;
              }
              onMarketplaceChange(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select marketplace" />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map((m) => (
                <SelectItem key={m.id} value={m.slug}>
                  {m.name}
                  {!m.enabled ? " (disabled)" : ""}
                </SelectItem>
              ))}
              <SelectItem value={CREATE_MARKETPLACE_VALUE} className="text-orange-800 font-medium">
                + Add marketplace…
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Channel name</Label>
                <Input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g. TikTok Shop"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Slug</Label>
                <Input
                  value={channelSlug}
                  onChange={(e) => setChannelSlug(e.target.value)}
                  placeholder={derivedChannelSlug || "tiktok-shop"}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => void handleCreateChannel()}
                disabled={creatingChannel}
              >
                {creatingChannel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add marketplace"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowChannelCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Pick a channel or <strong>Add marketplace…</strong> to create one.
        </p>
        {isNew && showAdvancedScope && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowAdvancedScope(false)}
          >
            Back to add sales channel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Skill type</Label>
          {isMarketplaceSkill ? (
            <p className="text-sm font-medium mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              {typeMeta?.label ?? "Product content"}
              <span className="text-xs text-muted-foreground font-normal block mt-0.5">
                Linked sales channel — type cannot be changed here.
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
              From{" "}
              <Link href="/admin/settings/ai" className="text-orange-600 underline">
                AI Settings
              </Link>
              , or default for this skill type.
            </p>
          </div>
        )}
        {!(isProductContentType && isNew && !showAdvancedScope) && (
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Category</Label>
          {isMarketplaceSkill ? (
            <p className="text-sm text-muted-foreground mt-1.5 rounded-md border bg-slate-50 px-3 py-2">
              All product categories on this channel.
            </p>
          ) : isImagePromptSkill && !imageSkillEditorMode ? (
            <p className="text-sm text-muted-foreground mt-1.5 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2">
              One module per skill. Per-category refs: <strong>Reference images</strong> in the test panel, or
              Overview → Image library → <strong>A+ modules</strong> / <strong>Product graphics</strong>.
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
        )}
        {!imageSkillEditorMode && (
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Marketplace</Label>
          {isProductContentType ? (
            renderProductContentMarketplaceSection()
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
