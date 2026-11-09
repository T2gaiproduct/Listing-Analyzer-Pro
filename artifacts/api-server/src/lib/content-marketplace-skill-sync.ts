import { and, eq } from "drizzle-orm";
import {
  aiSkillsTable,
  contentMarketplacesTable,
  db,
  type ContentMarketplace,
} from "@workspace/db";
import { getContentMarketplaceById } from "./content-marketplace-service.js";

export const MARKETPLACE_SKILL_SLUG_PREFIX = "marketplace-content-";

export function marketplaceContentSkillSlug(marketplaceSlug: string): string {
  return `${MARKETPLACE_SKILL_SLUG_PREFIX}${marketplaceSlug.trim().toLowerCase()}`;
}

export function isMarketplaceContentSkillSlug(slug: string): boolean {
  return slug.startsWith(MARKETPLACE_SKILL_SLUG_PREFIX);
}

/** YAML header + delimiter + marketplace AI instructions body (used in skill editor). */
export function buildMarketplaceSkillInstructionsText(mp: ContentMarketplace): string {
  const rules = mp.rules;
  const headerLines = [
    `name: ${mp.name} · Marketplace content`,
    "skill_kind: marketplace_content",
    `marketplace_slug: ${mp.slug}`,
  ];
  if (rules?.titleMaxChars != null) headerLines.push(`title_max: ${rules.titleMaxChars}`);
  if (rules?.bulletCount != null) headerLines.push(`bullets: ${rules.bulletCount}`);
  if (rules?.bulletMaxChars != null) headerLines.push(`bullet_max: ${rules.bulletMaxChars}`);
  if (rules?.descriptionMaxWords != null) headerLines.push(`desc_max_words: ${rules.descriptionMaxWords}`);

  const body = mp.aiInstructions.trim();

  return `${headerLines.join("\n")}\n---\n${body}`;
}

/** Instructions injected into listing-generation prompts (published skill or marketplace row). */
export function extractGenerationInstructionsFromSkillText(instructionsText: string): string {
  const marker = "\n---\n";
  const idx = instructionsText.indexOf(marker);
  if (idx >= 0) return instructionsText.slice(idx + marker.length).trim();
  return instructionsText.trim();
}

export async function findSkillByContentMarketplaceId(marketplaceId: number) {
  const [row] = await db
    .select()
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.contentMarketplaceId, marketplaceId))
    .limit(1);
  return row ?? null;
}

export async function syncContentMarketplaceToSkill(mp: ContentMarketplace): Promise<void> {
  const slug = marketplaceContentSkillSlug(mp.slug);
  const instructionsText = buildMarketplaceSkillInstructionsText(mp);
  const status = mp.enabled === 1 ? "published" : "draft";
  const now = new Date();

  const existing = await findSkillByContentMarketplaceId(mp.id);
  if (existing) {
    await db
      .update(aiSkillsTable)
      .set({
        slug,
        name: `${mp.name} · Marketplace content`,
        status,
        skillType: "product_content",
        category: "",
        marketplaceSlug: mp.slug,
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
        contentMarketplaceId: mp.id,
        name: `${mp.name} · Marketplace content`,
        status,
        skillType: "product_content",
        marketplaceSlug: mp.slug,
        instructionsText,
        updatedAt: now,
      })
      .where(eq(aiSkillsTable.id, bySlug.id));
    return;
  }

  await db.insert(aiSkillsTable).values({
    slug,
    name: `${mp.name} · Marketplace content`,
    status,
    skillType: "product_content",
    category: "",
    marketplaceSlug: mp.slug,
    aiModel: "",
    instructionsText,
    contentMarketplaceId: mp.id,
    updatedAt: now,
  });
}

export async function syncAllContentMarketplacesToSkills(): Promise<number> {
  const rows = await db
    .select()
    .from(contentMarketplacesTable)
    .orderBy(contentMarketplacesTable.sortOrder);
  for (const row of rows) {
    await syncContentMarketplaceToSkill(row);
  }
  return rows.length;
}

export async function deleteSkillForContentMarketplace(marketplaceId: number): Promise<void> {
  await db.delete(aiSkillsTable).where(eq(aiSkillsTable.contentMarketplaceId, marketplaceId));
}

/**
 * When a marketplace-linked skill is saved in the Skills UI, push body text back to content_marketplaces.ai_instructions.
 */
export async function applySkillTextToContentMarketplace(
  marketplaceId: number,
  instructionsText: string,
  status: "draft" | "published",
): Promise<void> {
  const mp = await getContentMarketplaceById(marketplaceId);
  if (!mp) return;

  const aiInstructions = extractGenerationInstructionsFromSkillText(instructionsText);
  if (aiInstructions.length < 20) return;

  await db
    .update(contentMarketplacesTable)
    .set({
      aiInstructions,
      enabled: status === "published" ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(contentMarketplacesTable.id, marketplaceId));
}

export async function resolvePublishedMarketplaceSkillInstructions(
  marketplace: ContentMarketplace,
): Promise<string | null> {
  const skill = await findSkillByContentMarketplaceId(marketplace.id);
  if (!skill || skill.status !== "published") return null;
  const body = extractGenerationInstructionsFromSkillText(skill.instructionsText);
  return body.length >= 20 ? body : null;
}

export async function resolveContentMarketplaceAiInstructions(
  marketplace: ContentMarketplace,
): Promise<string> {
  const fromSkill = await resolvePublishedMarketplaceSkillInstructions(marketplace);
  if (fromSkill) return fromSkill;
  return marketplace.aiInstructions;
}
