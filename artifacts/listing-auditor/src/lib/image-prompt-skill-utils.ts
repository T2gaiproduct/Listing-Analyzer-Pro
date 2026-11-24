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

export function parseImagePromptFieldsFromInstructions(instructionsText: string): {
  promptTemplate: string;
  headlineTemplate: string;
  bodyTemplate: string;
} {
  const marker = "\n---\n";
  const idx = instructionsText.indexOf(marker);
  const body = (idx >= 0 ? instructionsText.slice(idx + marker.length) : instructionsText).trim();
  if (!body) {
    return { promptTemplate: "", headlineTemplate: "", bodyTemplate: "" };
  }

  if (!body.includes(PROMPT_TEMPLATE_KEY)) {
    return { promptTemplate: body, headlineTemplate: "", bodyTemplate: "" };
  }

  type SectionKey = typeof PROMPT_TEMPLATE_KEY | typeof HEADLINE_TEMPLATE_KEY | typeof BODY_TEMPLATE_KEY;
  const sections: { key: SectionKey; start: number; valueStart: number }[] = [];
  for (const key of [PROMPT_TEMPLATE_KEY, HEADLINE_TEMPLATE_KEY, BODY_TEMPLATE_KEY] as const) {
    const start = body.indexOf(key);
    if (start >= 0) sections.push({ key, start, valueStart: start + key.length });
  }
  sections.sort((a, b) => a.start - b.start);

  let promptTemplate = "";
  let headlineTemplate = "";
  let bodyTemplate = "";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const nextStart = sections[i + 1]?.start;
    const value = body.slice(section.valueStart, nextStart ?? body.length).trim();
    if (section.key === PROMPT_TEMPLATE_KEY) promptTemplate = value;
    else if (section.key === HEADLINE_TEMPLATE_KEY) headlineTemplate = value;
    else if (section.key === BODY_TEMPLATE_KEY) bodyTemplate = value;
  }

  return { promptTemplate, headlineTemplate, bodyTemplate };
}
