import { and, asc, eq } from "drizzle-orm";
import {
  aiSkillsTable,
  db,
  imagePromptTemplatesTable,
  type ImagePromptTemplate,
  type ImagePromptTemplateCategory,
} from "@workspace/db";
import { extractGenerationInstructionsFromSkillText } from "./content-marketplace-skill-sync.js";
import { getImagePromptTemplateById } from "./image-prompt-template-service.js";

export const IMAGE_PROMPT_SKILL_SLUG_PREFIX = "image-prompt-";

export function imagePromptSkillSlug(
  category: ImagePromptTemplateCategory,
  templateSlug: string,
): string {
  return `${IMAGE_PROMPT_SKILL_SLUG_PREFIX}${category}-${templateSlug.trim().toLowerCase()}`;
}

export function isImagePromptSkillSlug(slug: string): boolean {
  return slug.startsWith(IMAGE_PROMPT_SKILL_SLUG_PREFIX);
}

function skillTypeForTemplate(category: ImagePromptTemplateCategory): "product_images" | "aplus_content" {
  return category === "aplus" ? "aplus_content" : "product_images";
}

/** YAML header + body (main prompt; optional headline/body lines for A+). */
export function buildImagePromptSkillInstructionsText(tpl: ImagePromptTemplate): string {
  const headerLines = [
    `name: ${tpl.name} · Image prompt`,
    "skill_kind: image_prompt",
    `template_category: ${tpl.category}`,
    `template_slug: ${tpl.slug}`,
  ];
  const bodyParts = [`prompt_template: ${tpl.promptTemplate.trim()}`];
  if (tpl.headlineTemplate?.trim()) {
    bodyParts.push(`headline_template: ${tpl.headlineTemplate.trim()}`);
  }
  if (tpl.bodyTemplate?.trim()) {
    bodyParts.push(`body_template: ${tpl.bodyTemplate.trim()}`);
  }
  return `${headerLines.join("\n")}\n---\n${bodyParts.join("\n")}`;
}

export type ParsedImagePromptSkillBody = {
  promptTemplate: string;
  headlineTemplate: string | null;
  bodyTemplate: string | null;
};

export function parseImagePromptSkillBody(instructionsText: string): ParsedImagePromptSkillBody {
  const body = extractGenerationInstructionsFromSkillText(instructionsText);
  let promptTemplate = "";
  let headlineTemplate: string | null = null;
  let bodyTemplate: string | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("prompt_template:")) {
      promptTemplate = line.slice("prompt_template:".length).trim();
    } else if (line.startsWith("headline_template:")) {
      headlineTemplate = line.slice("headline_template:".length).trim() || null;
    } else if (line.startsWith("body_template:")) {
      bodyTemplate = line.slice("body_template:".length).trim() || null;
    }
  }

  if (!promptTemplate && body && !body.includes("prompt_template:")) {
    promptTemplate = body.trim();
  }

  return { promptTemplate, headlineTemplate, bodyTemplate };
}

export async function findSkillByImagePromptTemplateId(templateId: number) {
  const [row] = await db
    .select()
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.imagePromptTemplateId, templateId))
    .limit(1);
  return row ?? null;
}

export async function syncImagePromptTemplateToSkill(tpl: ImagePromptTemplate): Promise<void> {
  const slug = imagePromptSkillSlug(tpl.category, tpl.slug);
  const instructionsText = buildImagePromptSkillInstructionsText(tpl);
  const status = tpl.enabled === 1 ? "published" : "draft";
  const skillType = skillTypeForTemplate(tpl.category);
  const now = new Date();

  const existing = await findSkillByImagePromptTemplateId(tpl.id);
  if (existing) {
    await db
      .update(aiSkillsTable)
      .set({
        slug,
        name: `${tpl.name} · Image prompt`,
        status,
        skillType,
        category: "",
        marketplaceSlug: "amazon",
        instructionsText,
        updatedAt: now,
      })
      .where(eq(aiSkillsTable.id, existing.id));
    return;
  }

  const [bySlug] = await db
    .select()
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.slug, slug))
    .limit(1);

  if (bySlug) {
    await db
      .update(aiSkillsTable)
      .set({
        imagePromptTemplateId: tpl.id,
        name: `${tpl.name} · Image prompt`,
        status,
        skillType,
        instructionsText,
        updatedAt: now,
      })
      .where(eq(aiSkillsTable.id, bySlug.id));
    return;
  }

  await db.insert(aiSkillsTable).values({
    slug,
    name: `${tpl.name} · Image prompt`,
    status,
    skillType,
    category: "",
    marketplaceSlug: "amazon",
    aiModel: "",
    instructionsText,
    imagePromptTemplateId: tpl.id,
    updatedAt: now,
  });
}

export async function syncAllImagePromptTemplatesToSkills(): Promise<number> {
  const rows = await db
    .select()
    .from(imagePromptTemplatesTable)
    .orderBy(
      asc(imagePromptTemplatesTable.category),
      asc(imagePromptTemplatesTable.sortOrder),
      asc(imagePromptTemplatesTable.name),
    );
  for (const row of rows) {
    await syncImagePromptTemplateToSkill(row);
  }
  return rows.length;
}

export async function deleteSkillForImagePromptTemplate(templateId: number): Promise<void> {
  await db.delete(aiSkillsTable).where(eq(aiSkillsTable.imagePromptTemplateId, templateId));
}

export async function applySkillTextToImagePromptTemplate(
  templateId: number,
  instructionsText: string,
  status: "draft" | "published",
): Promise<void> {
  const tpl = await getImagePromptTemplateById(templateId);
  if (!tpl) return;

  const parsed = parseImagePromptSkillBody(instructionsText);
  if (parsed.promptTemplate.length < (tpl.category === "aplus" ? 20 : 10)) return;

  await db
    .update(imagePromptTemplatesTable)
    .set({
      promptTemplate: parsed.promptTemplate,
      headlineTemplate: parsed.headlineTemplate,
      bodyTemplate: parsed.bodyTemplate,
      enabled: status === "published" ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(imagePromptTemplatesTable.id, templateId));
}

export async function resolvePublishedImagePromptFields(
  tpl: ImagePromptTemplate,
): Promise<ParsedImagePromptSkillBody | null> {
  const skill = await findSkillByImagePromptTemplateId(tpl.id);
  if (!skill || skill.status !== "published") return null;
  const parsed = parseImagePromptSkillBody(skill.instructionsText);
  if (parsed.promptTemplate.length < (tpl.category === "aplus" ? 20 : 10)) return null;
  return parsed;
}

/** Optional published per-category product_images skill (custom skills, not templates). */
export async function resolveCategoryImageSkillAddon(productCategory: string): Promise<string> {
  const category = productCategory.trim();
  if (!category) return "";
  const [skill] = await db
    .select()
    .from(aiSkillsTable)
    .where(
      and(
        eq(aiSkillsTable.category, category),
        eq(aiSkillsTable.skillType, "product_images"),
        eq(aiSkillsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!skill || skill.imagePromptTemplateId != null) return "";
  const addon = extractGenerationInstructionsFromSkillText(skill.instructionsText).trim();
  return addon.length >= 10 ? `\n\n${addon}` : "";
}

