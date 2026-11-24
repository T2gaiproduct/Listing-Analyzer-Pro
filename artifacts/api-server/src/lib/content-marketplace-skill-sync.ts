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

function normalizeSkillInstructionText(instructionsText: string): string {
  return instructionsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Instructions injected into listing-generation prompts (published skill or marketplace row). */
export function extractGenerationInstructionsFromSkillText(instructionsText: string): string {
  const normalized = normalizeSkillInstructionText(instructionsText).trim();
  const marker = "\n---\n";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length).trim();
  if (normalized.startsWith("---\n")) return normalized.slice(4).trim();
  return normalized;
}

export async function findSkillByContentMarketplaceId(marketplaceId: number) {
  const [row] = await db
    .select()
    .from(aiSkillsTable)
    .where(eq(aiSkillsTable.contentMarketplaceId, marketplaceId))
    .limit(1);
  return row ?? null;
}

export type SyncContentMarketplaceToSkillOptions = {
  /** Rebuild instructions from marketplace row (Content Marketplaces admin saves). Default: do not clobber skill editor text. */
  refreshInstructions?: boolean;
};

export async function syncContentMarketplaceToSkill(
  mp: ContentMarketplace,
  options: SyncContentMarketplaceToSkillOptions = {},
): Promise<void> {
  const refreshInstructions = options.refreshInstructions === true;
  const slug = marketplaceContentSkillSlug(mp.slug);
  const builtInstructions = buildMarketplaceSkillInstructionsText(mp);
  const status = mp.enabled === 1 ? "published" : "draft";
  const now = new Date();

  const linkPatch = {
    slug,
    name: `${mp.name} · Marketplace content`,
    status,
    skillType: "product_content" as const,
    category: "",
    marketplaceSlug: mp.slug,
  };

  const existing = await findSkillByContentMarketplaceId(mp.id);
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
        contentMarketplaceId: mp.id,
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
    name: `${mp.name} · Marketplace content`,
    status,
    skillType: "product_content",
    category: "",
    marketplaceSlug: mp.slug,
    aiModel: "",
    instructionsText: builtInstructions,
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
  const trimmedSkill = normalizeSkillInstructionText(instructionsText).trim();
  if (trimmedSkill.length > 0 && aiInstructions.length === 0) {
    throw new Error(
      "Could not parse skill body. Put a line with --- between the YAML header and the markdown instructions.",
    );
  }

  const bodyForMarketplace =
    aiInstructions.length > 0 ? aiInstructions : trimmedSkill;

  await db
    .update(contentMarketplacesTable)
    .set({
      aiInstructions: bodyForMarketplace,
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
