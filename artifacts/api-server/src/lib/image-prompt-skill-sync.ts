import { and, asc, eq } from "drizzle-orm";
import {
  aiSkillsTable,
  db,
  imagePromptTemplatesTable,
  type ImagePromptTemplate,
  type ImagePromptTemplateCategory,
} from "@workspace/db";
import { extractGenerationInstructionsFromSkillText } from "./content-marketplace-skill-sync.js";
import {
  getImagePromptTemplateById,
  getImagePromptTemplateBySlug,
} from "./image-prompt-template-service.js";

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

export function skillTypeForTemplate(category: ImagePromptTemplateCategory): "product_images" | "aplus_content" {
  return category === "aplus" ? "aplus_content" : "product_images";
}

export function imagePromptCategoryForSkillType(
  skillType: string,
): ImagePromptTemplateCategory {
  return skillType === "aplus_content" ? "aplus" : "graphics";
}

/** Same slug exists in both graphics and aplus (e.g. hero) — pick row that matches skill type. */
export async function resolveImagePromptTemplateIdForSkillType(
  templateId: number,
  skillType: string,
): Promise<number> {
  const tpl = await getImagePromptTemplateById(templateId);
  if (!tpl) return templateId;
  const want = imagePromptCategoryForSkillType(skillType);
  if (tpl.category === want) return templateId;
  const peer = await getImagePromptTemplateBySlug(want, tpl.slug);
  return peer?.id ?? templateId;
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

const PROMPT_TEMPLATE_KEY = "prompt_template:";
const HEADLINE_TEMPLATE_KEY = "headline_template:";
const BODY_TEMPLATE_KEY = "body_template:";

/** Multiline-safe: entire body or all lines after `prompt_template:` until the next template key. */
export function parseImagePromptSkillBody(instructionsText: string): ParsedImagePromptSkillBody {
  const body = extractGenerationInstructionsFromSkillText(instructionsText).trim();
  if (!body) {
    return { promptTemplate: "", headlineTemplate: null, bodyTemplate: null };
  }

  if (!body.includes(PROMPT_TEMPLATE_KEY)) {
    return { promptTemplate: body, headlineTemplate: null, bodyTemplate: null };
  }

  type SectionKey = typeof PROMPT_TEMPLATE_KEY | typeof HEADLINE_TEMPLATE_KEY | typeof BODY_TEMPLATE_KEY;
  const sections: { key: SectionKey; start: number; valueStart: number }[] = [];
  for (const key of [PROMPT_TEMPLATE_KEY, HEADLINE_TEMPLATE_KEY, BODY_TEMPLATE_KEY] as const) {
    const start = body.indexOf(key);
    if (start >= 0) sections.push({ key, start, valueStart: start + key.length });
  }
  sections.sort((a, b) => a.start - b.start);

  const sliceValue = (valueStart: number, nextSectionStart: number | undefined) =>
    body.slice(valueStart, nextSectionStart ?? body.length).trim();

  let promptTemplate = "";
  let headlineTemplate: string | null = null;
  let bodyTemplate: string | null = null;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const nextStart = sections[i + 1]?.start;
    const value = sliceValue(section.valueStart, nextStart);
    if (section.key === PROMPT_TEMPLATE_KEY) promptTemplate = value;
    else if (section.key === HEADLINE_TEMPLATE_KEY) headlineTemplate = value || null;
    else if (section.key === BODY_TEMPLATE_KEY) bodyTemplate = value || null;
  }

  return { promptTemplate, headlineTemplate, bodyTemplate };
}

/** Admin-uploaded skill files (multi-section markdown) should not get generic suffixes appended. */
export function isSubstantialAdminImagePrompt(prompt: string): boolean {
  const t = prompt.trim();
  return (
    t.length > 140
    || t.includes("\n")
    || /##\s+/.test(t)
    || /^[\s-]*\d+\./m.test(t)
  );
}

/** Prefer the fullest published prompt: skill file text vs synced template row. */
export function resolveImagePromptTemplateText(
  skillInstructionsText: string,
  templatePrompt: string,
): string {
  const fromSkill = parseImagePromptSkillBody(skillInstructionsText).promptTemplate.trim();
  const fromRow = templatePrompt.trim();
  if (fromSkill.length === 0) return fromRow;
  if (fromRow.length === 0) return fromSkill;
  return fromSkill.length >= fromRow.length ? fromSkill : fromRow;
}

export async function findSkillByImagePromptTemplateId(templateId: number) {
  const [row] = await db
    .select()
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.imagePromptTemplateId, templateId))
    .limit(1);
  return row ?? null;
}

export async function disableSystemImagePromptTemplate(templateId: number): Promise<void> {
  await db
    .update(imagePromptTemplatesTable)
    .set({ enabled: 0, updatedAt: new Date() })
    .where(
      and(
        eq(imagePromptTemplatesTable.id, templateId),
        eq(imagePromptTemplatesTable.isSystem, 1),
      ),
    );
  await deleteSkillForImagePromptTemplate(templateId);
}

export type SyncImagePromptTemplateToSkillOptions = {
  /** Rebuild instructions from template row (Image prompt templates admin). Default: do not clobber skill editor text. */
  refreshInstructions?: boolean;
};

export async function syncImagePromptTemplateToSkill(
  tpl: ImagePromptTemplate,
  options: SyncImagePromptTemplateToSkillOptions = {},
): Promise<void> {
  if (tpl.isSystem === 1 && tpl.enabled !== 1) {
    await deleteSkillForImagePromptTemplate(tpl.id);
    return;
  }

  const refreshInstructions = options.refreshInstructions === true;
  const slug = imagePromptSkillSlug(tpl.category, tpl.slug);
  const builtInstructions = buildImagePromptSkillInstructionsText(tpl);
  const status = tpl.enabled === 1 ? "published" : "draft";
  const skillType = skillTypeForTemplate(tpl.category);
  const now = new Date();

  const linkPatch = {
    slug,
    name: `${tpl.name} · Image prompt`,
    status,
    skillType,
    category: "",
    marketplaceSlug: "amazon",
  };

  const existing = await findSkillByImagePromptTemplateId(tpl.id);
  if (existing) {
    const shouldRefreshInstructions =
      refreshInstructions || !existing.instructionsText?.trim();
    await db
      .update(aiSkillsTable)
      .set({
        ...linkPatch,
        ...(shouldRefreshInstructions
          ? { instructionsText: builtInstructions, updatedAt: now }
          : {}),
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
    const shouldRefreshInstructions =
      refreshInstructions || !bySlug.instructionsText?.trim();
    await db
      .update(aiSkillsTable)
      .set({
        imagePromptTemplateId: tpl.id,
        ...linkPatch,
        ...(shouldRefreshInstructions
          ? { instructionsText: builtInstructions, updatedAt: now }
          : {}),
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
    instructionsText: builtInstructions,
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
  const minLen = tpl.category === "aplus" ? 20 : 10;
  if (parsed.promptTemplate.length < minLen) {
    throw new Error(
      "Could not parse image prompt for save. Put prompt_template: … after ---, or paste the full prompt body below the header.",
    );
  }

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
  const promptTemplate = resolveImagePromptTemplateText(skill.instructionsText, tpl.promptTemplate);
  const minLen = tpl.category === "aplus" ? 20 : 10;
  if (promptTemplate.length < minLen) return null;
  return {
    promptTemplate,
    headlineTemplate: parsed.headlineTemplate ?? tpl.headlineTemplate,
    bodyTemplate: parsed.bodyTemplate ?? tpl.bodyTemplate,
  };
}

async function resolveCategorySkillAddon(
  productCategory: string,
  skillType: "product_images" | "aplus_content",
): Promise<string> {
  const category = productCategory.trim();
  if (!category) return "";
  const [skill] = await db
    .select()
    .from(aiSkillsTable)
    .where(
      and(
        eq(aiSkillsTable.category, category),
        eq(aiSkillsTable.skillType, skillType),
        eq(aiSkillsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!skill || skill.imagePromptTemplateId != null) return "";
  const addon = extractGenerationInstructionsFromSkillText(skill.instructionsText).trim();
  return addon.length >= 10 ? `\n\n${addon}` : "";
}

type AiSkillRow = typeof aiSkillsTable.$inferSelect;

function normalizeTemplateSlugPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/** Map standalone skills (e.g. "Heroshot") onto built-in module slugs when intended. */
export function resolveImageTemplateSlugFromSkill(skill: Pick<AiSkillRow, "id" | "slug" | "name">): string {
  const skillSlug = skill.slug.trim();
  const prefix = skillSlug.match(/^image-prompt-(?:graphics|aplus)-(.+)$/);
  if (prefix?.[1]) return normalizeTemplateSlugPart(prefix[1]);

  const blob = `${skill.name} ${skillSlug}`.toLowerCase();
  if (/\bhero\s*shot\b|\bheroshot\b|(^|\s)hero(\s|$)/.test(blob)) return "hero";

  const derived = normalizeTemplateSlugPart(skillSlug) || normalizeTemplateSlugPart(skill.name);
  if (derived) return derived.slice(0, 48);
  return `skill-${skill.id}`;
}

/**
 * Standalone Product images / A+ skills (no template link) are not shown in the graphics wizard.
 * On publish, attach them to the matching image_prompt_templates row (creates one if needed).
 */
export async function ensureImagePromptTemplateLinkedForSkill(skill: AiSkillRow): Promise<AiSkillRow> {
  if (skill.skillType !== "product_images" && skill.skillType !== "aplus_content") return skill;
  if (skill.imagePromptTemplateId != null) return skill;

  const templateCategory = imagePromptCategoryForSkillType(skill.skillType);
  const templateSlug = resolveImageTemplateSlugFromSkill(skill);
  const parsed = parseImagePromptSkillBody(skill.instructionsText);
  let promptTemplate = parsed.promptTemplate.trim();
  if (promptTemplate.length < 10) {
    promptTemplate = extractGenerationInstructionsFromSkillText(skill.instructionsText).trim();
  }
  const minLen = templateCategory === "aplus" ? 20 : 10;
  if (promptTemplate.length < minLen) {
    throw new Error(
      `Product ${templateCategory === "graphics" ? "graphics" : "A+"} skills need at least ${minLen} characters of image prompt text before publish.`,
    );
  }

  const enabled = skill.status === "published" ? 1 : 0;
  const now = new Date();
  const displayName = skill.name.replace(/\s*·\s*Image prompt\s*$/i, "").trim() || skill.name;

  let template = await getImagePromptTemplateBySlug(templateCategory, templateSlug);
  if (template) {
    await db
      .update(imagePromptTemplatesTable)
      .set({
        promptTemplate,
        headlineTemplate: templateCategory === "aplus" ? parsed.headlineTemplate : null,
        bodyTemplate: templateCategory === "aplus" ? parsed.bodyTemplate : null,
        enabled,
        updatedAt: now,
        ...(template.isSystem === 0 ? { name: displayName } : {}),
      })
      .where(eq(imagePromptTemplatesTable.id, template.id));
    template = (await getImagePromptTemplateById(template.id))!;
  } else {
    const [inserted] = await db
      .insert(imagePromptTemplatesTable)
      .values({
        slug: templateSlug,
        category: templateCategory,
        name: displayName,
        description: null,
        enabled,
        isSystem: 0,
        sortOrder: 500,
        promptTemplate,
        headlineTemplate: templateCategory === "aplus" ? parsed.headlineTemplate : null,
        bodyTemplate: templateCategory === "aplus" ? parsed.bodyTemplate : null,
        metadata: { icon: "✨", graphicsBucket: "lifestyle" },
        updatedAt: now,
      })
      .returning();
    template = inserted!;
  }

  const canonicalSkillSlug = imagePromptSkillSlug(template.category, template.slug);
  const linkedSkill = await findSkillByImagePromptTemplateId(template.id);
  if (linkedSkill && linkedSkill.id !== skill.id) {
    await db
      .update(aiSkillsTable)
      .set({
        instructionsText: skill.instructionsText,
        status: skill.status,
        updatedAt: now,
      })
      .where(eq(aiSkillsTable.id, linkedSkill.id));
  }

  const [slugOwner] = await db
    .select({ id: aiSkillsTable.id })
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.slug, canonicalSkillSlug))
    .limit(1);
  const nextSlug =
    !slugOwner || slugOwner.id === skill.id ? canonicalSkillSlug : skill.slug;

  const [updated] = await db
    .update(aiSkillsTable)
    .set({
      imagePromptTemplateId: template.id,
      slug: nextSlug,
      skillType: skillTypeForTemplate(template.category),
      updatedAt: now,
    })
    .where(eq(aiSkillsTable.id, skill.id))
    .returning();

  await syncImagePromptTemplateToSkill(template, { refreshInstructions: false });
  return updated ?? skill;
}

/** Optional published per-category product_images skill (custom skills, not templates). */
export async function resolveCategoryImageSkillAddon(productCategory: string): Promise<string> {
  return resolveCategorySkillAddon(productCategory, "product_images");
}

/** Optional published per-category aplus_content skill (custom skills, not templates). */
export async function resolveCategoryAplusSkillAddon(productCategory: string): Promise<string> {
  return resolveCategorySkillAddon(productCategory, "aplus_content");
}

