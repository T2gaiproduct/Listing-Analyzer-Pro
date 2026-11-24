import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Images, Loader2, Play, Trash2 } from "lucide-react";
import { CategoryReferenceLibraryDialog } from "@/components/admin-overview-image-library";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ADMIN_AI_SKILLS_HREF } from "@/lib/admin-ai-settings-nav";
import {
  deleteAdminContentMarketplace,
  saveAdminContentMarketplace,
  useAdminContentMarketplaces,
  type ContentMarketplaceAdmin,
} from "@/lib/content-marketplaces";
import { AdminSkillScopeFields } from "@/components/admin-skill-scope-fields";
import { AdminMarketplaceSkillSettings } from "@/components/admin-marketplace-skill-settings";
import { AdminImagePromptSkillSettings } from "@/components/admin-image-prompt-skill-settings";
import { extractSkillInstructionBody } from "@/lib/marketplace-skill-utils";
import {
  buildImagePromptInstructionsFromTemplate,
  imagePromptCategoryForSkillType,
  parseImagePromptFieldsFromInstructions,
  resolveImagePromptTemplateForSkillType,
} from "@/lib/image-prompt-skill-utils";
import { AdminImageSkillEditorPreview } from "@/components/admin-image-skill-editor-preview";
import {
  imageSkillEditorVersionLabel,
  parseTemplateCategoryFromInstructions,
  parseTemplateSlugFromInstructions,
} from "@/lib/admin-image-style-skill";
import {
  imagePromptSkillCatalogTitle,
  setSkillInstructionsNameLine,
  stripImagePromptSkillSuffix,
} from "@/lib/admin-skill-rename";
import { skillCatalogFilename } from "@/lib/admin-skills-catalog";
import {
  configuredProductCategoryNames,
  useAdminProductCategories,
} from "@/lib/graphics-module-examples";
import {
  saveAdminImagePromptTemplate,
  useAdminImagePromptTemplates,
  type ImagePromptTemplateAdmin,
} from "@/lib/image-prompt-templates";
import {
  DEFAULT_LISTING_AUDIT_SKILL_TEXT,
  DEFAULT_SKILL_INSTRUCTIONS_TEXT,
  DEFAULT_SKILL_TYPE_SLUG,
  SAMPLE_PRODUCTS,
  type SkillType,
  parseSkillInstructions,
} from "@/lib/admin-skill-editor";
import { skillTypeEditorMode, useAdminSkillTypes } from "@/lib/admin-skill-types";
import {
  createAdminAiSkill,
  deleteAdminAiSkill,
  runAdminAiSkillTest,
  updateAdminAiSkill,
  useAdminAiSkill,
  useAdminAiSkillSampleProducts,
  useInvalidateAdminAiSkills,
  type ListingAuditSkillTestPayload,
  type MarketplaceContentSkillTestPayload,
  type SkillTestOutput,
} from "@/lib/admin-ai-skills-api";
import { AdminAuditSkillTestPreview } from "@/components/admin-audit-skill-test-preview";
import {
  normalizeLegacySkillAiModel,
  useAdminSkillChatModels,
} from "@/lib/admin-skill-chat-models";

function isImagePromptSkillRecord(skill: {
  skillKind?: string;
  imagePromptTemplateId?: number | null;
}) {
  return skill.skillKind === "image_prompt" || (skill.imagePromptTemplateId != null && skill.imagePromptTemplateId > 0);
}

export default function AdminAiSkillEditorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [refLibraryOpen, setRefLibraryOpen] = useState(false);
  const [, params] = useRoute("/admin/settings/ai/skills/:skillId");
  const routeSkillId = params?.skillId ?? "new";
  const isNew = routeSkillId === "new";

  const [instructionsText, setInstructionsText] = useState(DEFAULT_SKILL_INSTRUCTIONS_TEXT);
  const [skillType, setSkillType] = useState<SkillType>(DEFAULT_SKILL_TYPE_SLUG);
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState("amazon");
  const [aiModel, setAiModel] = useState<string>("");
  const [sampleProductId, setSampleProductId] = useState<string>(SAMPLE_PRODUCTS[0].id);
  const [testOutput, setTestOutput] = useState<SkillTestOutput | null>(null);
  const [marketplaceTestPayload, setMarketplaceTestPayload] =
    useState<MarketplaceContentSkillTestPayload | null>(null);
  const [auditTestPayload, setAuditTestPayload] = useState<ListingAuditSkillTestPayload | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [persistedKey, setPersistedKey] = useState<string | null>(isNew ? null : routeSkillId);
  const [saving, setSaving] = useState(false);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const instructionsTouchedRef = useRef(false);
  const skillNameTouchedRef = useRef(false);
  const [skillCatalogName, setSkillCatalogName] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [marketplaceMeta, setMarketplaceMeta] = useState<ContentMarketplaceAdmin | null>(null);
  const [imagePromptMeta, setImagePromptMeta] = useState<ImagePromptTemplateAdmin | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: mpData } = useAdminContentMarketplaces();
  const { data: imageTemplatesData } = useAdminImagePromptTemplates();
  const { data: productCatData } = useAdminProductCategories();
  const { data: skillData, isLoading: skillLoading } = useAdminAiSkill(routeSkillId, !isNew);
  const { data: sampleProductsData } = useAdminAiSkillSampleProducts();
  const invalidateSkills = useInvalidateAdminAiSkills();
  const { data: skillTypeRegistry = [] } = useAdminSkillTypes();
  const skillEditorMode = skillTypeEditorMode(skillTypeRegistry, skillType);
  const { data: chatModelsData } = useAdminSkillChatModels(skillType);

  const marketplaces = mpData?.marketplaces ?? [];
  const sampleProductOptions = sampleProductsData?.products ?? SAMPLE_PRODUCTS.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  useEffect(() => {
    if (!isNew || hydratedFromServer) return;
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("skillType")?.trim();
    if (typeParam) {
      setSkillType(typeParam);
      if (typeParam === "listing_audit") {
        setInstructionsText(DEFAULT_LISTING_AUDIT_SKILL_TEXT);
      }
    }
    setHydratedFromServer(true);
  }, [isNew, hydratedFromServer]);

  useEffect(() => {
    const skill = skillData?.skill;
    if (!skill || hydratedFromServer) return;
    if (!instructionsTouchedRef.current) {
      setInstructionsText(skill.instructionsText || DEFAULT_SKILL_INSTRUCTIONS_TEXT);
    }
    setSkillType(skill.skillType);
    const hydratedCategory = skill.category?.trim() ?? "";
    setCategory(
      hydratedCategory === "Default" && (skill.skillType === "product_images" || skill.skillType === "aplus_content")
        ? ""
        : hydratedCategory,
    );
    setMarketplace(skill.marketplaceSlug);
    const optionValues = chatModelsData?.options ?? [];
    setAiModel(normalizeLegacySkillAiModel(skill.aiModel, optionValues));
    setStatus(skill.status);
    setPersistedKey(skill.slug);
    if (!skillNameTouchedRef.current) {
      const fromInstructions = parseSkillInstructions(skill.instructionsText || "").name.trim();
      const recordName = skill.name?.trim() ?? "";
      const displayName = isImagePromptSkillRecord(skill)
        ? stripImagePromptSkillSuffix(recordName || fromInstructions)
        : recordName || fromInstructions;
      if (displayName && displayName !== "New skill") {
        setSkillCatalogName(displayName);
      } else {
        setSkillCatalogName("");
      }
    }
    setHydratedFromServer(true);
  }, [skillData?.skill, hydratedFromServer, chatModelsData?.options]);

  useEffect(() => {
    const skill = skillData?.skill;
    if (!skill || instructionsTouchedRef.current) return;
    setInstructionsText(skill.instructionsText || DEFAULT_SKILL_INSTRUCTIONS_TEXT);
  }, [skillData?.skill?.instructionsText, skillData?.skill?.updatedAt]);

  useEffect(() => {
    const mpId = skillData?.skill?.contentMarketplaceId;
    if (mpId == null) {
      setMarketplaceMeta(null);
      return;
    }
    const mp = marketplaces.find((m) => m.id === mpId);
    if (mp) setMarketplaceMeta({ ...mp });
  }, [skillData?.skill?.contentMarketplaceId, marketplaces]);

  const parsed = useMemo(() => parseSkillInstructions(instructionsText), [instructionsText]);
  const isMarketplaceSkill =
    skillData?.skill?.skillKind === "marketplace_content"
    || skillData?.skill?.contentMarketplaceId != null;
  const isImagePromptSkill =
    skillData?.skill?.skillKind === "image_prompt"
    || skillData?.skill?.imagePromptTemplateId != null;
  const isImageSkillEditor =
    isImagePromptSkill
    || (!isMarketplaceSkill && skillEditorMode === "image");
  const isAuditSkillEditor =
    !isMarketplaceSkill && !isImageSkillEditor && (skillEditorMode === "audit" || skillType === "listing_audit");
  const skillRecord = skillData?.skill;
  const resolvePayloadSkillName = useCallback(() => {
    const fromField = skillCatalogName.trim();
    if (fromField) {
      return isImagePromptSkill ? imagePromptSkillCatalogTitle(fromField) : fromField;
    }
    const parsedName = parsed.name.trim();
    if (parsedName && parsedName !== "New skill") {
      return isImagePromptSkill ? imagePromptSkillCatalogTitle(stripImagePromptSkillSuffix(parsedName)) : parsedName;
    }
    const recordName = skillRecord?.name?.trim() ?? "";
    if (recordName && recordName !== "New skill") return recordName;
    return "New skill";
  }, [isImagePromptSkill, parsed.name, skillCatalogName, skillRecord?.name]);

  const skillNameFieldValue = useMemo(() => {
    if (skillCatalogName.trim()) {
      return isImagePromptSkill ? stripImagePromptSkillSuffix(skillCatalogName) : skillCatalogName;
    }
    const raw = parsed.name.trim();
    if (isImagePromptSkill) {
      const fromRecord = stripImagePromptSkillSuffix(skillRecord?.name?.trim() ?? "");
      if (fromRecord && fromRecord !== "New skill") return fromRecord;
      return stripImagePromptSkillSuffix(raw === "New skill" ? "" : raw);
    }
    const fromRecord = skillRecord?.name?.trim() ?? "";
    if (fromRecord && fromRecord !== "New skill") return fromRecord;
    if (isNew && raw === "New skill") return "";
    return raw === "New skill" ? "" : raw;
  }, [isImagePromptSkill, isNew, parsed.name, skillCatalogName, skillRecord?.name]);

  const applySkillName = useCallback(
    (nextRaw: string) => {
      skillNameTouchedRef.current = true;
      const trimmed = nextRaw.trim();
      setSkillCatalogName(trimmed);
      const instructionsName = isImagePromptSkill
        ? imagePromptSkillCatalogTitle(trimmed || "New skill")
        : trimmed || "New skill";
      setInstructionsText((prev) => setSkillInstructionsNameLine(prev, instructionsName));
      if (isImagePromptSkill && imagePromptMeta) {
        setImagePromptMeta({
          ...imagePromptMeta,
          name: stripImagePromptSkillSuffix(instructionsName),
        });
      }
    },
    [imagePromptMeta, isImagePromptSkill],
  );

  const displayTitle =
    (skillNameFieldValue.trim() || stripImagePromptSkillSuffix(skillRecord?.name?.trim() ?? ""))
    || skillRecord?.name?.trim()
    || parsed.name
    || (isNew ? "New skill" : "Edit skill");
  const skillFileLabel =
    uploadName
    ?? (skillRecord ? skillCatalogFilename(skillRecord) : null);
  const imageTemplateSlug =
    imagePromptMeta?.slug
    ?? parseTemplateSlugFromInstructions(instructionsText);
  const imageTemplateCategory =
    imagePromptMeta?.category
    ?? parseTemplateCategoryFromInstructions(instructionsText)
    ?? (skillType === "aplus_content" ? "aplus" : "graphics");
  const configuredCategorySet = useMemo(
    () => new Set(configuredProductCategoryNames(productCatData?.categories ?? [])),
    [productCatData?.categories],
  );
  const previewCategory = useMemo(() => {
    const raw = category.trim() || skillRecord?.category?.trim() || "";
    if (!isImageSkillEditor) return raw;
    if (raw && configuredCategorySet.has(raw)) return raw;
    if (raw) return raw;
    return "";
  }, [category, configuredCategorySet, isImageSkillEditor, skillRecord?.category]);

  useEffect(() => {
    const tplId = skillData?.skill?.imagePromptTemplateId;
    if (tplId == null) {
      setImagePromptMeta(null);
      return;
    }
    const tpl = imageTemplatesData?.templates.find((t) => t.id === tplId);
    if (tpl) setImagePromptMeta({ ...tpl });
  }, [skillData?.skill?.imagePromptTemplateId, imageTemplatesData?.templates]);

  const buildPayload = useCallback(
    (nextStatus: "draft" | "published") => ({
      name: resolvePayloadSkillName(),
      instructionsText,
      skillType,
      category,
      marketplaceSlug: marketplace,
      aiModel,
      status: nextStatus,
    }),
    [aiModel, category, instructionsText, marketplace, resolvePayloadSkillName, skillType],
  );

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result ?? "");
      instructionsTouchedRef.current = true;
      setInstructionsDirty(true);
      const fileBase = file.name.replace(/\.(md|txt|json)$/i, "").trim();
      if (fileBase && !/^name\s*:/im.test(text)) {
        text = setSkillInstructionsNameLine(text, fileBase);
        skillNameTouchedRef.current = true;
        setSkillCatalogName(fileBase);
      } else {
        const uploadedName = parseSkillInstructions(text).name.trim();
        if (uploadedName && uploadedName !== "New skill") {
          skillNameTouchedRef.current = true;
          setSkillCatalogName(
            isImagePromptSkill ? stripImagePromptSkillSuffix(uploadedName) : uploadedName,
          );
        } else if (fileBase) {
          skillNameTouchedRef.current = true;
          setSkillCatalogName(fileBase);
          text = setSkillInstructionsNameLine(text, fileBase);
        }
      }
      setInstructionsText(text);
      setUploadName(file.name);
      toast({
        title: "Skill file loaded",
        description: isMarketplaceSkill
          ? "Text below was replaced. Publish skill (or Save draft) so Optimize Listing generation uses this file on each marketplace."
          : "Text below was replaced. Publish skill (or Save draft) to store it on the server.",
      });
    };
    reader.readAsText(file);
  }, [isImagePromptSkill, isMarketplaceSkill, toast]);

  const handleSkillTypeChange = useCallback(
    (next: SkillType) => {
      setSkillType(next);
      setTestOutput(null);
      setMarketplaceTestPayload(null);
      setAuditTestPayload(null);
      const nextMode = skillTypeEditorMode(skillTypeRegistry, next);
      if (
        (nextMode === "audit" || next === "listing_audit")
        && !/title_weight\s*:/i.test(instructionsText)
      ) {
        setInstructionsText(DEFAULT_LISTING_AUDIT_SKILL_TEXT);
      }
    },
    [instructionsText, skillTypeRegistry],
  );

  const runTest = useCallback(async () => {
    setTestRunning(true);
    try {
      const mpId =
        marketplaceMeta?.id ?? skillData?.skill?.contentMarketplaceId ?? undefined;
      const mpSlug =
        marketplaceMeta?.slug ?? skillData?.skill?.marketplaceSlug ?? undefined;
      const response = await runAdminAiSkillTest({
        idOrSlug: persistedKey ?? undefined,
        instructionsText,
        sampleProductId,
        aiModel,
        skillType,
        category: category.trim() || previewCategory,
        ...(isMarketplaceSkill && mpId != null ? { contentMarketplaceId: mpId } : {}),
        ...(isMarketplaceSkill && mpSlug ? { contentMarketplaceSlug: mpSlug } : {}),
      });
      if (response.mode === "listing_audit") {
        setAuditTestPayload(response);
        setTestOutput(null);
        setMarketplaceTestPayload(null);
      } else if (response.mode === "marketplace_content") {
        setMarketplaceTestPayload(response);
        setTestOutput(null);
        setAuditTestPayload(null);
      } else {
        setTestOutput(response.output);
        setMarketplaceTestPayload(null);
        setAuditTestPayload(null);
      }
    } catch (e) {
      toast({
        title: "Test failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setTestRunning(false);
    }
  }, [
    aiModel,
    category,
    instructionsText,
    isMarketplaceSkill,
    marketplaceMeta?.id,
    marketplaceMeta?.slug,
    persistedKey,
    previewCategory,
    sampleProductId,
    skillData?.skill?.contentMarketplaceId,
    skillData?.skill?.marketplaceSlug,
    skillType,
    toast,
  ]);

  const persistSkill = async (nextStatus: "draft" | "published") => {
    setSaving(true);
    try {
      let instructionsForSave = instructionsText;
      if (isImagePromptSkill && imagePromptMeta) {
        const parsedPrompt = parseImagePromptFieldsFromInstructions(instructionsText);
        const moduleName =
          stripImagePromptSkillSuffix(skillCatalogName)
          || stripImagePromptSkillSuffix(parsed.name)
          || imagePromptMeta.name;
        const catalog = imageTemplatesData?.templates ?? [];
        const linkedImageSkillType =
          imagePromptMeta.category === "aplus" ? "aplus_content" : "product_images";
        const skillTypeForSave =
          skillType === "aplus_content" || skillType === "product_images" ? skillType : linkedImageSkillType;
        const targetMeta = resolveImagePromptTemplateForSkillType(
          imagePromptMeta,
          skillTypeForSave,
          catalog,
        );
        if (!targetMeta) {
          const want = imagePromptCategoryForSkillType(skillTypeForSave);
          throw new Error(
            `No ${want} template exists for slug “${imagePromptMeta.slug}”. `
            + `Product images skills must save to the graphics template row.`,
          );
        }
        const mergedTpl = {
          ...targetMeta,
          name: moduleName,
          promptTemplate: parsedPrompt.promptTemplate || targetMeta.promptTemplate,
          headlineTemplate:
            targetMeta.category === "aplus"
              ? parsedPrompt.headlineTemplate || targetMeta.headlineTemplate
              : null,
          bodyTemplate:
            targetMeta.category === "aplus"
              ? parsedPrompt.bodyTemplate || targetMeta.bodyTemplate
              : null,
          enabled: nextStatus === "published",
        };
        await saveAdminImagePromptTemplate(mergedTpl);
        setImagePromptMeta(mergedTpl);
        instructionsForSave = instructionsText.includes("prompt_template:")
          ? instructionsText
          : buildImagePromptInstructionsFromTemplate(mergedTpl);
        setInstructionsText(instructionsForSave);
      }

      if (isMarketplaceSkill && marketplaceMeta) {
        await saveAdminContentMarketplace(
          {
            slug: marketplaceMeta.slug,
            name: marketplaceMeta.name,
            description: marketplaceMeta.description,
            enabled: nextStatus === "published",
            isDefault: marketplaceMeta.isDefault,
            sortOrder: marketplaceMeta.sortOrder,
            aiInstructions: extractSkillInstructionBody(instructionsText),
            rules: marketplaceMeta.rules,
          },
          marketplaceMeta.id,
        );
      }

      const catalogName = resolvePayloadSkillName();
      instructionsForSave = setSkillInstructionsNameLine(instructionsForSave, catalogName);
      const linkedImageSkillType =
        isImagePromptSkill && imagePromptMeta
          ? (imagePromptMeta.category === "aplus" ? "aplus_content" : "product_images")
          : skillType;
      const payloadSkillType =
        skillType === "aplus_content" || skillType === "product_images" ? skillType : linkedImageSkillType;
      const payload = {
        ...buildPayload(nextStatus),
        skillType: payloadSkillType,
        instructionsText: instructionsForSave,
      };
      if (persistedKey) {
        const priorSlug = persistedKey;
        const { skill } = await updateAdminAiSkill(persistedKey, payload);
        setStatus(skill.status);
        setPersistedKey(skill.slug);
        if (skill.slug !== priorSlug) {
          navigate(`/admin/settings/ai/skills/${skill.slug}`, { replace: true });
        }
        setInstructionsText(skill.instructionsText);
        instructionsTouchedRef.current = false;
        skillNameTouchedRef.current = false;
        setSkillCatalogName(
          isImagePromptSkill
            ? stripImagePromptSkillSuffix(skill.name)
            : skill.name?.trim() ?? "",
        );
        setInstructionsDirty(false);
        setUploadName(null);
        invalidateSkills();
        await queryClient.invalidateQueries({ queryKey: ["image-prompt-templates"] });
        toast({
          title: nextStatus === "published" ? "Skill published" : "Draft saved",
          description: isMarketplaceSkill
            ? `${skill.name} is stored. Live listing generation uses this skill when status is Published.`
            : skill.skillKind === "image_prompt" || skill.imagePromptTemplateId
              ? `${skill.name} is live in the ${skillType === "aplus_content" ? "A+" : "Product graphics"} module picker when Published.`
              : `${skill.name} is stored on the server.`,
        });
      } else {
        const { skill } = await createAdminAiSkill(payload);
        setStatus(skill.status);
        setPersistedKey(skill.slug);
        setInstructionsText(skill.instructionsText);
        instructionsTouchedRef.current = false;
        skillNameTouchedRef.current = false;
        setSkillCatalogName(
          isImagePromptSkill
            ? stripImagePromptSkillSuffix(skill.name)
            : skill.name?.trim() ?? "",
        );
        setInstructionsDirty(false);
        setUploadName(null);
        invalidateSkills();
        navigate(`/admin/settings/ai/skills/${skill.slug}`);
        toast({
          title: nextStatus === "published" ? "Skill published" : "Draft saved",
          description: `${skill.name} was created.`,
        });
      }
    } catch (e) {
      toast({
        title: "Could not save skill",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => void persistSkill("draft");
  const publishSkill = () => void persistSkill("published");

  const deleteImagePromptSkill = async () => {
    const key = persistedKey ?? skillData?.skill?.slug;
    if (!key) return;
    const isSystem = Boolean(imagePromptMeta?.isSystem);
    if (
      !window.confirm(
        isSystem
          ? "Remove this built-in image prompt from the skills list? The template will be disabled (you can re-enable it under Image prompt templates)."
          : "Delete this image prompt skill?",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await deleteAdminAiSkill(key);
      invalidateSkills();
      navigate(ADMIN_AI_SKILLS_HREF);
      toast({
        title: isSystem ? "Built-in image prompt disabled" : "Image prompt skill deleted",
      });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteMarketplaceSkill = async () => {
    const mpId = skillData?.skill?.contentMarketplaceId;
    if (!mpId) return;
    if (!window.confirm("Delete this marketplace and its listing skill?")) return;
    setSaving(true);
    try {
      await deleteAdminContentMarketplace(mpId);
      invalidateSkills();
      navigate(ADMIN_AI_SKILLS_HREF);
      toast({ title: "Marketplace skill deleted" });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomSkill = async () => {
    if (!persistedKey) return;
    if (!window.confirm(`Delete “${displayTitle}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteAdminAiSkill(persistedKey);
      invalidateSkills();
      navigate(ADMIN_AI_SKILLS_HREF);
      toast({ title: "Skill deleted" });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href={ADMIN_AI_SKILLS_HREF}>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Back to skills">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[12rem]">
            <h1 className="text-lg sm:text-xl font-bold truncate">{displayTitle}</h1>
            {isImageSkillEditor && skillRecord ? (
              <span className="text-xs text-muted-foreground shrink-0">
                {imageSkillEditorVersionLabel(skillRecord)}
              </span>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 font-medium",
                status === "published"
                  ? "text-orange-900 bg-orange-50 border-orange-200"
                  : "text-amber-800 bg-amber-50 border-amber-200",
              )}
            >
              {status === "published" ? "Live" : "Draft"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto justify-end">
            {isImagePromptSkill && imagePromptMeta && (
              <Button
                type="button"
                variant="outline"
                className="text-red-700 border-red-200"
                onClick={() => void deleteImagePromptSkill()}
                disabled={saving || skillLoading}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            {isMarketplaceSkill && marketplaceMeta && (
              <Button
                type="button"
                variant="outline"
                className="text-red-700 border-red-200"
                onClick={() => void deleteMarketplaceSkill()}
                disabled={saving || skillLoading}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            {persistedKey && !isMarketplaceSkill && !isImagePromptSkill && (
              <Button
                type="button"
                variant="outline"
                className="text-red-700 border-red-200"
                onClick={() => void deleteCustomSkill()}
                disabled={saving || skillLoading}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={saveDraft} disabled={saving || skillLoading}>
              Save draft
            </Button>
            <Button
              type="button"
              className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
              onClick={publishSkill}
              disabled={saving || skillLoading}
            >
              Publish skill
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skill file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                  skillFileLabel
                    ? "border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50"
                    : "border-slate-200 bg-slate-50/80 hover:border-orange-300 hover:bg-orange-50/40",
                )}
              >
                <FileUp className={cn("w-8 h-8 mx-auto mb-2", skillFileLabel ? "text-orange-600" : "text-slate-400")} />
                <p className="text-sm font-semibold text-slate-800">Upload a skill file</p>
                <p className="text-xs text-muted-foreground mt-1">.md, .txt or .json — replaces the text below</p>
                {skillFileLabel ? (
                  <p className="text-xs font-mono text-orange-900 mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-1 border border-orange-200">
                    {skillFileLabel}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-3">No file yet</p>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".md,.txt,.json,text/plain,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              <div>
                <Label className="text-xs text-muted-foreground">Skill instructions (editable)</Label>
                <Textarea
                  value={instructionsText}
                  onChange={(e) => {
                    instructionsTouchedRef.current = true;
                    setInstructionsDirty(true);
                    setInstructionsText(e.target.value);
                  }}
                  className="mt-1.5 font-mono text-xs min-h-[220px] bg-slate-50"
                  spellCheck={false}
                />
                {instructionsDirty && uploadName && (
                  <p className="text-[11px] text-amber-800 mt-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5">
                    Unsaved changes from <span className="font-mono">{uploadName}</span>. Publish skill or Save draft
                    before generating marketplace content in Build Your Brand.
                  </p>
                )}
                {isAuditSkillEditor
                  && /title_max\s*:/i.test(instructionsText)
                  && !/title_weight\s*:/i.test(instructionsText) && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
                    These instructions use product-content keys (title_max, bullets). Listing audits need{" "}
                    <span className="font-mono">title_weight</span> and related keys — same as live audits.
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 ml-1 text-[11px] text-amber-950 underline"
                      onClick={() => setInstructionsText(DEFAULT_LISTING_AUDIT_SKILL_TEXT)}
                    >
                      Load audit template
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  {skillEditorMode === "audit" || skillType === "listing_audit"
                    ? "Keys: title_weight, bullet_weight, image_weight, keyword_weight, show_title/show_bullets/show_images/show_keywords (yes/no), score_offset, score_floor, score_ceiling. Rubric text under # Generation instructions. Run audit test to preview seller results."
                    : isImageSkillEditor
                      ? "One rule per line as key: value. Try changing aspect, images_per_run, or reference_lock and watch the test output."
                      : skillEditorMode === "generic"
                        ? "One rule per line as key: value. This type is admin-configured; wire a product handler before it affects live Video/Ads flows."
                        : "One rule per line as key: value. Try changing bullets or title_max and watch the test output."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Where this skill applies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(skillType === "product_images" || skillType === "aplus_content")
                && !isImagePromptSkill
                && !skillLoading && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
                  <p className="font-semibold">Custom image skill</p>
                  <p className="mt-1">
                    The Product graphics picker only lists linked image modules.{" "}
                    <strong>Publish</strong> stores your prompt on the matching module (e.g. Hero Shot → slug{" "}
                    <span className="font-mono">hero</span>) so it appears under{" "}
                    {skillType === "product_images" ? "Product graphics" : "A+ Content"}.
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-orange-200/70 bg-orange-50/25 px-3 py-3 space-y-2">
                <Label htmlFor="admin-skill-name" className="text-xs font-semibold text-orange-950">
                  Skill name
                </Label>
                <Input
                  id="admin-skill-name"
                  value={skillNameFieldValue}
                  onChange={(e) => applySkillName(e.target.value)}
                  placeholder={
                    isImagePromptSkill
                      ? "e.g. Hero Shot"
                      : skillType === "product_content"
                        ? "e.g. Amazon title & bullets"
                        : "e.g. Supplements listing rules"
                  }
                  className="bg-white border-orange-200/80"
                />
                <p className="text-[11px] text-muted-foreground">
                  {isImagePromptSkill
                    ? "Catalog title for this image module — not the same as category or marketplace below."
                    : "Name for this skill in the Skills table. Sales channel name below is only when you add a marketplace."}
                </p>
              </div>
              <AdminSkillScopeFields
                skillType={skillType}
                onSkillTypeChange={handleSkillTypeChange}
                category={category}
                onCategoryChange={setCategory}
                marketplace={marketplace}
                onMarketplaceChange={setMarketplace}
                aiModel={aiModel}
                onAiModelChange={setAiModel}
                marketplaces={marketplaces}
                isMarketplaceSkill={isMarketplaceSkill}
                isImagePromptSkill={isImagePromptSkill}
                imagePromptTemplateCategory={imagePromptMeta?.category ?? null}
                imageSkillEditorMode={isImageSkillEditor}
                skillTypeOptions={skillTypeRegistry}
                contentMarketplaceId={skillData?.skill?.contentMarketplaceId}
                isNew={isNew}
                onDeleteMarketplace={
                  isMarketplaceSkill && marketplaceMeta ? () => void deleteMarketplaceSkill() : undefined
                }
                marketplaceDeleteDisabled={saving || skillLoading}
              />
            </CardContent>
          </Card>

          {isImagePromptSkill && imagePromptMeta && !isImageSkillEditor && (
            <AdminImagePromptSkillSettings
              value={imagePromptMeta}
              onChange={(next) => {
                setImagePromptMeta(next);
                setInstructionsText(buildImagePromptInstructionsFromTemplate(next));
              }}
            />
          )}

          {isMarketplaceSkill && marketplaceMeta && (
            <AdminMarketplaceSkillSettings value={marketplaceMeta} onChange={setMarketplaceMeta} />
          )}
        </div>

        {/* Right column — test output */}
        <Card className="xl:min-h-[640px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {isAuditSkillEditor ? "Audit preview (seller view)" : "Test output"}
            </CardTitle>
            {!isImageSkillEditor && (
              <Button type="button" size="sm" className="gap-1.5" onClick={runTest} disabled={testRunning}>
                {testRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {isAuditSkillEditor ? "Run audit test" : "Run test"}
              </Button>
            )}
            {isImageSkillEditor && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-orange-200 text-orange-900 hover:bg-orange-50"
                onClick={() => setRefLibraryOpen(true)}
              >
                <Images className="w-3.5 h-3.5" />
                Reference images
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            {isImageSkillEditor ? (
              <AdminImageSkillEditorPreview
                instructionsText={instructionsText}
                category={previewCategory}
                templateSlug={imageTemplateSlug}
                templateCategory={imageTemplateCategory}
              />
            ) : isAuditSkillEditor ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Sample product</Label>
                  <Select value={sampleProductId} onValueChange={setSampleProductId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleProductOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {testRunning && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running AI audit on sample listing…
                  </div>
                )}
                {!testRunning && !auditTestPayload && (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Run audit test to preview scores, issues, and visibility flags exactly as sellers see them.
                  </p>
                )}
                {auditTestPayload && <AdminAuditSkillTestPreview payload={auditTestPayload} />}
              </>
            ) : (
              <>
            <div>
              <Label className="text-xs text-muted-foreground">Sample product</Label>
              <Select value={sampleProductId} onValueChange={setSampleProductId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleProductOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {testRunning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isMarketplaceSkill
                  ? "Running AI listing generation with this marketplace skill…"
                  : "Running test…"}
              </div>
            )}

            {!testRunning && !testOutput && !marketplaceTestPayload && (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Run a test to preview title, bullets, and description using this skill.
              </p>
            )}

            {marketplaceTestPayload && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Badge variant="secondary" className="text-xs">
                  {marketplaceTestPayload.marketplace.name} · same prompt as Optimize Listing
                </Badge>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Title
                  </p>
                  <p className="text-sm font-medium leading-snug border rounded-lg bg-white px-3 py-2.5">
                    {marketplaceTestPayload.generated.title}
                  </p>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {marketplaceTestPayload.generated.bulletPoints.length} bullet points
                  </p>
                  <ul className="space-y-2 text-sm border rounded-lg bg-white px-3 py-2.5 list-disc pl-5">
                    {marketplaceTestPayload.generated.bulletPoints.map((b) => (
                      <li key={b.slice(0, 24)}>{b}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Description (HTML)
                  </p>
                  <div
                    className="text-sm leading-relaxed border rounded-lg bg-white px-3 py-2.5 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: marketplaceTestPayload.generated.htmlDescription,
                    }}
                  />
                </section>
                {marketplaceTestPayload.generated.keywords &&
                  marketplaceTestPayload.generated.keywords.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Keywords: {marketplaceTestPayload.generated.keywords.join(", ")}
                    </p>
                  )}
              </div>
            )}

            {testOutput && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <section>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    <span>Title</span>
                    <span className="tabular-nums">
                      {testOutput.titleCount}/{testOutput.titleMax}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug border rounded-lg bg-white px-3 py-2.5">
                    {testOutput.title}
                  </p>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {testOutput.bullets.length} bullet points
                  </p>
                  <ul className="space-y-2 text-sm border rounded-lg bg-white px-3 py-2.5 list-disc pl-5">
                    {testOutput.bullets.map((b) => (
                      <li key={b.slice(0, 24)}>{b}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm leading-relaxed border rounded-lg bg-white px-3 py-2.5">
                    {testOutput.description}
                  </p>
                </section>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge
                    variant="outline"
                    className={
                      testOutput.bannedFound.length === 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }
                  >
                    {parsed.banned.length} banned terms,{" "}
                    {testOutput.bannedFound.length === 0 ? "none found" : testOutput.bannedFound.join(", ")}
                  </Badge>
                  <Badge variant="secondary">Tone: {parsed.tone}</Badge>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Generated by {testOutput.modelLabel} following this skill. Sample product category:{" "}
                  {testOutput.sampleCategory}.
                </p>
              </div>
            )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isImageSkillEditor && (
        <CategoryReferenceLibraryDialog
          open={refLibraryOpen}
          onOpenChange={(open) => {
            setRefLibraryOpen(open);
            if (!open) {
              void queryClient.invalidateQueries({ queryKey: ["admin", "graphics-module-examples"] });
            }
          }}
          initialCategory={previewCategory || category.trim() || "Default"}
          initialTemplateCategory={imageTemplateCategory}
          initialFilterSlug={imageTemplateSlug ?? undefined}
        />
      )}
    </div>
  );
}
