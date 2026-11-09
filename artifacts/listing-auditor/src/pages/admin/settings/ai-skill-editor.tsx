import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, FileUp, Play, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  parseImagePromptFieldsFromInstructions,
} from "@/lib/image-prompt-skill-utils";
import { AdminImageSkillEditorPreview } from "@/components/admin-image-skill-editor-preview";
import {
  imageSkillEditorVersionLabel,
  parseTemplateCategoryFromInstructions,
  parseTemplateSlugFromInstructions,
} from "@/lib/admin-image-style-skill";
import { skillCatalogFilename } from "@/lib/admin-skills-catalog";
import {
  configuredProductCategoryNames,
  useAdminProductCategories,
} from "@/lib/graphics-module-examples";
import {
  deleteAdminImagePromptTemplate,
  saveAdminImagePromptTemplate,
  useAdminImagePromptTemplates,
  type ImagePromptTemplateAdmin,
} from "@/lib/image-prompt-templates";
import {
  DEFAULT_LISTING_AUDIT_SKILL_TEXT,
  DEFAULT_SKILL_INSTRUCTIONS_TEXT,
  SAMPLE_PRODUCTS,
  type SkillType,
  parseSkillInstructions,
} from "@/lib/admin-skill-editor";
import {
  createAdminAiSkill,
  runAdminAiSkillTest,
  updateAdminAiSkill,
  useAdminAiSkill,
  useAdminAiSkillSampleProducts,
  useInvalidateAdminAiSkills,
  type SkillTestOutput,
} from "@/lib/admin-ai-skills-api";

const AI_MODELS = [
  "Claude Sonnet 5.5",
  "GPT-5.4",
  "Gemini 2.5 Flash",
  "OpenAI GPT-4o",
] as const;

export default function AdminAiSkillEditorPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/settings/ai/skills/:skillId");
  const routeSkillId = params?.skillId ?? "new";
  const isNew = routeSkillId === "new";

  const [instructionsText, setInstructionsText] = useState(DEFAULT_SKILL_INSTRUCTIONS_TEXT);
  const [skillType, setSkillType] = useState<SkillType>("product_content");
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState("amazon");
  const [aiModel, setAiModel] = useState<string>(AI_MODELS[0]);
  const [sampleProductId, setSampleProductId] = useState<string>(SAMPLE_PRODUCTS[0].id);
  const [testOutput, setTestOutput] = useState<SkillTestOutput | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [persistedKey, setPersistedKey] = useState<string | null>(isNew ? null : routeSkillId);
  const [saving, setSaving] = useState(false);
  const [hydratedFromServer, setHydratedFromServer] = useState(isNew);
  const [marketplaceMeta, setMarketplaceMeta] = useState<ContentMarketplaceAdmin | null>(null);
  const [imagePromptMeta, setImagePromptMeta] = useState<ImagePromptTemplateAdmin | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: mpData } = useAdminContentMarketplaces();
  const { data: imageTemplatesData } = useAdminImagePromptTemplates();
  const { data: productCatData } = useAdminProductCategories();
  const { data: skillData, isLoading: skillLoading } = useAdminAiSkill(routeSkillId, !isNew);
  const { data: sampleProductsData } = useAdminAiSkillSampleProducts();
  const invalidateSkills = useInvalidateAdminAiSkills();

  const marketplaces = mpData?.marketplaces ?? [];
  const sampleProductOptions = sampleProductsData?.products ?? SAMPLE_PRODUCTS.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  useEffect(() => {
    if (isNew && !hydratedFromServer) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("skillType") === "listing_audit") {
        setSkillType("listing_audit");
        setInstructionsText(DEFAULT_LISTING_AUDIT_SKILL_TEXT);
      }
    }
  }, [isNew, hydratedFromServer]);

  useEffect(() => {
    const skill = skillData?.skill;
    if (!skill || hydratedFromServer) return;
    setInstructionsText(skill.instructionsText || DEFAULT_SKILL_INSTRUCTIONS_TEXT);
    setSkillType(skill.skillType);
    const hydratedCategory = skill.category?.trim() ?? "";
    setCategory(
      hydratedCategory === "Default" && (skill.skillType === "product_images" || skill.skillType === "aplus_content")
        ? ""
        : hydratedCategory,
    );
    setMarketplace(skill.marketplaceSlug);
    setAiModel(skill.aiModel || AI_MODELS[0]);
    setStatus(skill.status);
    setPersistedKey(skill.slug);
    setHydratedFromServer(true);
  }, [skillData?.skill, hydratedFromServer]);

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
  || (
    !isMarketplaceSkill
    && skillType !== "listing_audit"
    && skillType !== "product_content"
    && (skillType === "product_images" || skillType === "aplus_content")
  );
  const skillRecord = skillData?.skill;
  const displayTitle =
    skillRecord?.name?.trim()
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
  const lockImageCategory =
    isImageSkillEditor
    && !isImagePromptSkill
    && Boolean(skillRecord?.category?.trim());
  const configuredCategorySet = useMemo(
    () => new Set(configuredProductCategoryNames(productCatData?.categories ?? [])),
    [productCatData?.categories],
  );
  const previewCategory = useMemo(() => {
    const raw = category.trim() || skillRecord?.category?.trim() || "";
    if (!isImageSkillEditor) return raw;
    if (raw && configuredCategorySet.has(raw)) return raw;
    if (lockImageCategory && raw) return raw;
    return "";
  }, [category, configuredCategorySet, isImageSkillEditor, lockImageCategory, skillRecord?.category]);

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
      name: parsed.name,
      instructionsText,
      skillType,
      category,
      marketplaceSlug: marketplace,
      aiModel,
      status: nextStatus,
    }),
    [aiModel, category, instructionsText, marketplace, parsed.name, skillType],
  );

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setInstructionsText(text);
      setUploadName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const runTest = useCallback(async () => {
    try {
      const output = await runAdminAiSkillTest({
        idOrSlug: persistedKey ?? undefined,
        instructionsText,
        sampleProductId,
        aiModel,
      });
      setTestOutput(output);
    } catch (e) {
      toast({
        title: "Test failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }, [aiModel, instructionsText, persistedKey, sampleProductId, toast]);

  const persistSkill = async (nextStatus: "draft" | "published") => {
    setSaving(true);
    try {
      let instructionsForSave = instructionsText;
      if (isImagePromptSkill && imagePromptMeta) {
        const parsedPrompt = parseImagePromptFieldsFromInstructions(instructionsText);
        const mergedTpl = {
          ...imagePromptMeta,
          promptTemplate: parsedPrompt.promptTemplate || imagePromptMeta.promptTemplate,
          headlineTemplate: parsedPrompt.headlineTemplate || imagePromptMeta.headlineTemplate,
          bodyTemplate: parsedPrompt.bodyTemplate || imagePromptMeta.bodyTemplate,
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

      const payload = { ...buildPayload(nextStatus), instructionsText: instructionsForSave };
      if (persistedKey) {
        const { skill } = await updateAdminAiSkill(persistedKey, payload);
        setStatus(skill.status);
        setPersistedKey(skill.slug);
        invalidateSkills();
        toast({
          title: nextStatus === "published" ? "Skill published" : "Draft saved",
          description: `${skill.name} is stored on the server.`,
        });
      } else {
        const { skill } = await createAdminAiSkill(payload);
        setStatus(skill.status);
        setPersistedKey(skill.slug);
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
    const tplId = skillData?.skill?.imagePromptTemplateId;
    if (!tplId) return;
    if (!window.confirm("Delete this image prompt skill?")) return;
    setSaving(true);
    try {
      await deleteAdminImagePromptTemplate(tplId);
      invalidateSkills();
      navigate(ADMIN_AI_SKILLS_HREF);
      toast({ title: "Image prompt skill deleted" });
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

  return (
    <div className="min-h-full bg-slate-50/80">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <Link href={ADMIN_AI_SKILLS_HREF}>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Back to skills">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{displayTitle}</h1>
              {isImageSkillEditor && skillRecord && (
                <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{imageSkillEditorVersionLabel(skillRecord)}</span>
                </p>
              )}
            </div>
            {isImageSkillEditor && (
              <>
                <Badge variant="outline" className="text-slate-700 bg-white border-slate-200 font-medium">
                  {skillRecord ? imageSkillEditorVersionLabel(skillRecord) : "Editing v1"}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    status === "published"
                      ? "text-teal-800 bg-teal-50 border-teal-200 font-medium"
                      : "text-amber-800 bg-amber-50 border-amber-200 font-medium"
                  }
                >
                  {status === "published" ? "Live" : "Draft"}
                </Badge>
              </>
            )}
            {!isImageSkillEditor && (
              <Badge
                variant="outline"
                className={
                  status === "published"
                    ? "text-teal-800 bg-teal-50 border-teal-200 font-medium"
                    : "text-amber-800 bg-amber-50 border-amber-200 font-medium"
                }
              >
                {displayTitle} · {status === "published" ? "Published" : "Draft"}
              </Badge>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            {isImagePromptSkill && imagePromptMeta && !imagePromptMeta.isSystem && (
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
            <Button type="button" variant="outline" onClick={saveDraft} disabled={saving || skillLoading}>
              Save draft
            </Button>
            <Button
              type="button"
              className="bg-teal-700 hover:bg-teal-800 text-white"
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
                    ? "border-teal-300 bg-teal-50/50 hover:border-teal-400 hover:bg-teal-50"
                    : "border-slate-200 bg-slate-50/80 hover:border-teal-300 hover:bg-teal-50/40",
                )}
              >
                <FileUp className={cn("w-8 h-8 mx-auto mb-2", skillFileLabel ? "text-teal-700" : "text-slate-400")} />
                <p className="text-sm font-semibold text-slate-800">Upload a skill file</p>
                <p className="text-xs text-muted-foreground mt-1">.md, .txt or .json — replaces the text below</p>
                {skillFileLabel ? (
                  <p className="text-xs font-mono text-teal-800 mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-1 border border-teal-200">
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
                  onChange={(e) => setInstructionsText(e.target.value)}
                  className="mt-1.5 font-mono text-xs min-h-[220px] bg-slate-50"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  {skillType === "listing_audit"
                    ? "Keys: title_weight, bullet_weight, image_weight, keyword_weight, show_title/show_bullets/show_images/show_keywords (yes/no), score_offset, score_floor, score_ceiling. Rubric text under # Generation instructions. Re-run audits to apply changes."
                    : isImageSkillEditor
                      ? "One rule per line as key: value. Try changing aspect, images_per_run, or reference_lock and watch the test output."
                      : "One rule per line as key: value. Try changing bullets or title_max and watch the test output."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Where this skill applies</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminSkillScopeFields
                skillType={skillType}
                onSkillTypeChange={setSkillType}
                category={category}
                onCategoryChange={setCategory}
                marketplace={marketplace}
                onMarketplaceChange={setMarketplace}
                aiModel={aiModel}
                onAiModelChange={setAiModel}
                marketplaces={marketplaces}
                isMarketplaceSkill={isMarketplaceSkill}
                isImagePromptSkill={isImagePromptSkill}
                imageSkillEditorMode={isImageSkillEditor}
                lockImageCategory={lockImageCategory}
                contentMarketplaceId={skillData?.skill?.contentMarketplaceId}
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
            <CardTitle className="text-base">Test output</CardTitle>
            {!isImageSkillEditor && (
              <Button type="button" size="sm" className="gap-1.5" onClick={runTest}>
                <Play className="w-3.5 h-3.5" />
                Run test
              </Button>
            )}
            {isImageSkillEditor && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  toast({
                    title: "Preview updated",
                    description: "Reference previews reflect the category and skill keys above.",
                  });
                }}
              >
                <Play className="w-3.5 h-3.5" />
                Run test
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

            {!testOutput && (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Run a test to preview title, bullets, and description using this skill.
              </p>
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
    </div>
  );
}
