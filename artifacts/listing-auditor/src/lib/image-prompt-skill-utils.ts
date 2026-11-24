import type { ImagePromptTemplateAdmin } from "@/lib/image-prompt-templates";
import { parseImageStyleSkillKeys } from "@/lib/admin-image-style-skill";

export function buildImagePromptInstructionsFromTemplate(tpl: ImagePromptTemplateAdmin): string {
  const style = parseImageStyleSkillKeys("");
  const header = [
    `name: ${tpl.name} · Image prompt`,
    "skill_kind: image_prompt",
    `template_category: ${tpl.category}`,
    `template_slug: ${tpl.slug}`,
    `aspect: ${style.aspect}`,
    `images_per_run: ${style.imagesPerRun}`,
    `reference_lock: ${style.referenceLock}`,
    `text_overlay: ${style.textOverlay}`,
    `background: ${style.background}`,
    `people: ${style.people}`,
  ];
  const bodyParts = [`prompt_template: ${tpl.promptTemplate.trim()}`];
  if (tpl.headlineTemplate?.trim()) {
    bodyParts.push(`headline_template: ${tpl.headlineTemplate.trim()}`);
  }
  if (tpl.bodyTemplate?.trim()) {
    bodyParts.push(`body_template: ${tpl.bodyTemplate.trim()}`);
  }
  const meta = tpl.metadata ?? {};
  const wrapperLines: [string, string | undefined][] = [
    ["reference_instruction", meta.referenceInstruction],
    ["reference_rules", meta.referenceRules],
    ["reference_retry", meta.referenceRetry],
    ["composite_scene_suffix", meta.compositeSceneSuffix],
    ["composite_fallback_scene", meta.compositeFallbackScene],
  ];
  for (const [key, value] of wrapperLines) {
    if (value?.trim()) bodyParts.push(`${key}: ${value.trim()}`);
  }
  return `${header.join("\n")}\n---\n${bodyParts.join("\n")}`;
}

export function imagePromptCategoryForSkillType(skillType: string): "graphics" | "aplus" {
  return skillType === "aplus_content" ? "aplus" : "graphics";
}

/** When skill type is Product images, saves must hit the graphics template row (e.g. hero), not the A+ peer. */
export function resolveImagePromptTemplateForSkillType(
  current: ImagePromptTemplateAdmin,
  skillType: string,
  catalog: ImagePromptTemplateAdmin[],
): ImagePromptTemplateAdmin | null {
  const want = imagePromptCategoryForSkillType(skillType);
  if (current.category === want) return current;
  return catalog.find((t) => t.category === want && t.slug === current.slug) ?? null;
}

const PROMPT_TEMPLATE_KEY = "prompt_template:";
const HEADLINE_TEMPLATE_KEY = "headline_template:";
const BODY_TEMPLATE_KEY = "body_template:";
const REFERENCE_INSTRUCTION_KEY = "reference_instruction:";
const REFERENCE_RULES_KEY = "reference_rules:";
const REFERENCE_RETRY_KEY = "reference_retry:";
const COMPOSITE_SCENE_SUFFIX_KEY = "composite_scene_suffix:";
const COMPOSITE_FALLBACK_SCENE_KEY = "composite_fallback_scene:";

const IMAGE_PROMPT_SECTION_KEYS = [
  PROMPT_TEMPLATE_KEY,
  HEADLINE_TEMPLATE_KEY,
  BODY_TEMPLATE_KEY,
  REFERENCE_INSTRUCTION_KEY,
  REFERENCE_RULES_KEY,
  REFERENCE_RETRY_KEY,
  COMPOSITE_SCENE_SUFFIX_KEY,
  COMPOSITE_FALLBACK_SCENE_KEY,
] as const;

export function parseImagePromptFieldsFromInstructions(instructionsText: string): {
  promptTemplate: string;
  headlineTemplate: string;
  bodyTemplate: string;
  referenceInstruction: string;
  referenceRules: string;
  referenceRetry: string;
  compositeSceneSuffix: string;
  compositeFallbackScene: string;
} {
  const marker = "\n---\n";
  const idx = instructionsText.indexOf(marker);
  const body = (idx >= 0 ? instructionsText.slice(idx + marker.length) : instructionsText).trim();
  if (!body) {
    return {
      promptTemplate: "",
      headlineTemplate: "",
      bodyTemplate: "",
      referenceInstruction: "",
      referenceRules: "",
      referenceRetry: "",
      compositeSceneSuffix: "",
      compositeFallbackScene: "",
    };
  }

  if (!body.includes(PROMPT_TEMPLATE_KEY)) {
    return {
      promptTemplate: body,
      headlineTemplate: "",
      bodyTemplate: "",
      referenceInstruction: "",
      referenceRules: "",
      referenceRetry: "",
      compositeSceneSuffix: "",
      compositeFallbackScene: "",
    };
  }

  type SectionKey = (typeof IMAGE_PROMPT_SECTION_KEYS)[number];
  const sections: { key: SectionKey; start: number; valueStart: number }[] = [];
  for (const key of IMAGE_PROMPT_SECTION_KEYS) {
    const start = body.indexOf(key);
    if (start >= 0) sections.push({ key, start, valueStart: start + key.length });
  }
  sections.sort((a, b) => a.start - b.start);

  let promptTemplate = "";
  let headlineTemplate = "";
  let bodyTemplate = "";
  let referenceInstruction = "";
  let referenceRules = "";
  let referenceRetry = "";
  let compositeSceneSuffix = "";
  let compositeFallbackScene = "";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const nextStart = sections[i + 1]?.start;
    const value = body.slice(section.valueStart, nextStart ?? body.length).trim();
    if (section.key === PROMPT_TEMPLATE_KEY) promptTemplate = value;
    else if (section.key === HEADLINE_TEMPLATE_KEY) headlineTemplate = value;
    else if (section.key === BODY_TEMPLATE_KEY) bodyTemplate = value;
    else if (section.key === REFERENCE_INSTRUCTION_KEY) referenceInstruction = value;
    else if (section.key === REFERENCE_RULES_KEY) referenceRules = value;
    else if (section.key === REFERENCE_RETRY_KEY) referenceRetry = value;
    else if (section.key === COMPOSITE_SCENE_SUFFIX_KEY) compositeSceneSuffix = value;
    else if (section.key === COMPOSITE_FALLBACK_SCENE_KEY) compositeFallbackScene = value;
  }

  return {
    promptTemplate,
    headlineTemplate,
    bodyTemplate,
    referenceInstruction,
    referenceRules,
    referenceRetry,
    compositeSceneSuffix,
    compositeFallbackScene,
  };
}
