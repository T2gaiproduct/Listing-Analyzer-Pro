import type { ImagePromptTemplate, ImagePromptTemplateMetadata } from "@workspace/db";
import type { ImagePromptTemplateCategory } from "@workspace/db";
import {
  getImagePromptTemplateBySlug,
  parseImagePromptMetadata,
  renderPromptTemplate,
} from "./image-prompt-template-service.js";
import {
  findSkillByImagePromptTemplateId,
  parseImagePromptSkillBody,
  resolveCategoryImageSkillAddon,
  resolvePublishedImagePromptFields,
} from "./image-prompt-skill-sync.js";

export type ImagePromptRuntimeWrappers = {
  referenceInstruction: string;
  referenceRules: string;
  referenceRetry: string;
  compositeSceneSuffix: string;
  compositeFallbackScene: string;
};

function pickString(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

function wrappersFromMetadata(meta: ImagePromptTemplateMetadata): ImagePromptRuntimeWrappers {
  return {
    referenceInstruction: meta.referenceInstruction?.trim() ?? "",
    referenceRules: meta.referenceRules?.trim() ?? "",
    referenceRetry: meta.referenceRetry?.trim() ?? "",
    compositeSceneSuffix: meta.compositeSceneSuffix?.trim() ?? "",
    compositeFallbackScene: meta.compositeFallbackScene?.trim() ?? "",
  };
}

function wrappersFromSkillInstructions(instructionsText: string): ImagePromptRuntimeWrappers {
  const parsed = parseImagePromptSkillBody(instructionsText);
  return {
    referenceInstruction: parsed.referenceInstruction ?? "",
    referenceRules: parsed.referenceRules ?? "",
    referenceRetry: parsed.referenceRetry ?? "",
    compositeSceneSuffix: parsed.compositeSceneSuffix ?? "",
    compositeFallbackScene: parsed.compositeFallbackScene ?? "",
  };
}

/** Merged wrappers: published skill body overrides template metadata when non-empty. */
export async function resolveImagePromptRuntimeWrappers(
  tpl: ImagePromptTemplate,
): Promise<ImagePromptRuntimeWrappers> {
  const fromMeta = wrappersFromMetadata(parseImagePromptMetadata(tpl.metadata));
  const skill = await findSkillByImagePromptTemplateId(tpl.id);
  if (!skill?.instructionsText?.trim() || skill.status !== "published") {
    return fromMeta;
  }
  const fromSkill = wrappersFromSkillInstructions(skill.instructionsText);
  return {
    referenceInstruction: pickString(fromSkill.referenceInstruction, fromMeta.referenceInstruction),
    referenceRules: pickString(fromSkill.referenceRules, fromMeta.referenceRules),
    referenceRetry: pickString(
      fromSkill.referenceRetry,
      fromMeta.referenceRetry,
      fromSkill.referenceRules,
      fromMeta.referenceRules,
    ),
    compositeSceneSuffix: pickString(fromSkill.compositeSceneSuffix, fromMeta.compositeSceneSuffix),
    compositeFallbackScene: pickString(fromSkill.compositeFallbackScene, fromMeta.compositeFallbackScene),
  };
}

export type GraphicsImagePromptRuntime = {
  modulePrompt: string;
  wrappers: ImagePromptRuntimeWrappers;
};

export async function resolveGraphicsImagePromptRuntime(
  typeSlug: string,
  productDesc: string,
  productCategory?: string | null,
  tpl?: ImagePromptTemplate | null,
): Promise<GraphicsImagePromptRuntime | null> {
  if (!tpl) return null;
  if (tpl.enabled !== 1) return null;

  const fromSkill = await resolvePublishedImagePromptFields(tpl);
  const promptTemplate = fromSkill?.promptTemplate?.trim() || tpl.promptTemplate.trim();
  if (!promptTemplate) return null;

  const base = renderPromptTemplate(promptTemplate, { productDesc });
  const addon = productCategory ? await resolveCategoryImageSkillAddon(productCategory) : "";
  const modulePrompt = `${base}${addon}`.trim();
  const wrappers = await resolveImagePromptRuntimeWrappers(tpl);
  return { modulePrompt, wrappers };
}

export function buildReferenceGenerationPrompt(
  modulePrompt: string,
  wrappers: ImagePromptRuntimeWrappers,
): string {
  return [
    wrappers.referenceInstruction,
    wrappers.referenceRules,
    modulePrompt,
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

export function buildReferenceRetryPrompt(wrappers: ImagePromptRuntimeWrappers): string {
  const retry = wrappers.referenceRetry.trim() || wrappers.referenceRules.trim();
  return [wrappers.referenceInstruction, retry].map((p) => p.trim()).filter(Boolean).join(" ");
}

const EMPTY_WRAPPERS: ImagePromptRuntimeWrappers = {
  referenceInstruction: "",
  referenceRules: "",
  referenceRetry: "",
  compositeSceneSuffix: "",
  compositeFallbackScene: "",
};

export async function resolveWrappersForTemplateSlug(
  category: ImagePromptTemplateCategory,
  slug: string | undefined,
): Promise<ImagePromptRuntimeWrappers> {
  const normalized = (slug ?? "").trim().toLowerCase();
  if (!normalized) return { ...EMPTY_WRAPPERS };
  const { ensureImagePromptTemplatesReady } = await import("./ensure-image-prompt-templates.js");
  await ensureImagePromptTemplatesReady();
  const row = await getImagePromptTemplateBySlug(category, normalized);
  if (!row) return { ...EMPTY_WRAPPERS };
  return resolveImagePromptRuntimeWrappers(row);
}