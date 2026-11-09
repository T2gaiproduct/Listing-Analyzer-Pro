import { skillCatalogVersion } from "@/lib/admin-skills-catalog";
import type { AiSkillRecord } from "@/lib/admin-ai-skills-api";

export type ImageStyleSkillKeys = {
  aspect: string;
  imagesPerRun: string;
  referenceLock: string;
  textOverlay: string;
  background: string;
  people: string;
};

const DEFAULT_KEYS: ImageStyleSkillKeys = {
  aspect: "1:1",
  imagesPerRun: "4",
  referenceLock: "Category library only",
  textOverlay: "None",
  background: "White or lifestyle, no brand logos",
  people: "Children allowed, face forward",
};

function lineValue(text: string, key: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.toLowerCase().startsWith(`${key.toLowerCase()}:`)) continue;
    return line.slice(line.indexOf(":") + 1).trim();
  }
  return null;
}

export function parseImageStyleSkillKeys(instructionsText: string): ImageStyleSkillKeys {
  return {
    aspect: lineValue(instructionsText, "aspect") ?? DEFAULT_KEYS.aspect,
    imagesPerRun: lineValue(instructionsText, "images_per_run") ?? DEFAULT_KEYS.imagesPerRun,
    referenceLock: lineValue(instructionsText, "reference_lock") ?? DEFAULT_KEYS.referenceLock,
    textOverlay: lineValue(instructionsText, "text_overlay") ?? DEFAULT_KEYS.textOverlay,
    background: lineValue(instructionsText, "background") ?? DEFAULT_KEYS.background,
    people: lineValue(instructionsText, "people") ?? DEFAULT_KEYS.people,
  };
}

export function defaultImageCategorySkillInstructions(name: string, category: string): string {
  return [
    `name: ${name}`,
    ...Object.entries({
      aspect: DEFAULT_KEYS.aspect,
      images_per_run: DEFAULT_KEYS.imagesPerRun,
      reference_lock: DEFAULT_KEYS.referenceLock,
      text_overlay: DEFAULT_KEYS.textOverlay,
      background: DEFAULT_KEYS.background,
      people: DEFAULT_KEYS.people,
    }).map(([k, v]) => `${k}: ${v}`),
    "",
    "# Generation instructions",
    `Use approved reference images from the ${category} image library when generating this graphics type.`,
  ].join("\n");
}

export function imageSkillEditorVersionLabel(skill: AiSkillRecord | undefined): string {
  if (!skill) return "Editing v1";
  return `Editing ${skillCatalogVersion(skill)}`;
}

export function parseTemplateSlugFromInstructions(text: string): string | null {
  return lineValue(text, "template_slug");
}

export function parseTemplateCategoryFromInstructions(
  text: string,
): "graphics" | "aplus" | null {
  const raw = lineValue(text, "template_category");
  if (raw === "aplus" || raw === "graphics") return raw;
  return null;
}
