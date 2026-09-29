import { and, asc, eq } from "drizzle-orm";
import {
  contentMarketplacesTable,
  type ContentMarketplace,
  type ContentMarketplaceRules,
} from "@workspace/db";
import { db } from "@workspace/db";

export class ContentMarketplaceError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "disabled" = "not_found",
  ) {
    super(message);
    this.name = "ContentMarketplaceError";
  }
}

export function formatContentMarketplaceRulesForPrompt(rules?: ContentMarketplaceRules | null): string {
  if (!rules) return "";
  const lines: string[] = ["--- CONFIGURED CONTENT RULES (admin) ---"];
  if (rules.titleMinChars != null) lines.push(`Title minimum length: ${rules.titleMinChars} characters.`);
  if (rules.titleMaxChars != null) lines.push(`Title maximum length: ${rules.titleMaxChars} characters.`);
  if (rules.bulletCount != null) lines.push(`Bullet point count: exactly ${rules.bulletCount}.`);
  if (rules.bulletMinChars != null) lines.push(`Each bullet minimum length: ${rules.bulletMinChars} characters.`);
  if (rules.bulletMaxChars != null) lines.push(`Each bullet maximum length: ${rules.bulletMaxChars} characters.`);
  if (rules.keywordCount != null) lines.push(`Keyword count: ${rules.keywordCount}.`);
  if (rules.descriptionMinWords != null) lines.push(`Description minimum words: ${rules.descriptionMinWords}.`);
  if (rules.descriptionMaxWords != null) lines.push(`Description maximum words: ${rules.descriptionMaxWords}.`);
  if (rules.requiredFields?.length) {
    lines.push(`Required JSON fields: ${rules.requiredFields.join(", ")}.`);
  }
  if (rules.formattingNotes?.trim()) {
    lines.push(`Formatting notes: ${rules.formattingNotes.trim()}`);
  }
  return lines.length > 1 ? `${lines.join("\n")}\n` : "";
}

export async function listEnabledContentMarketplaces(): Promise<ContentMarketplace[]> {
  return db
    .select()
    .from(contentMarketplacesTable)
    .where(eq(contentMarketplacesTable.enabled, 1))
    .orderBy(asc(contentMarketplacesTable.sortOrder), asc(contentMarketplacesTable.name));
}

export async function listAllContentMarketplacesAdmin(): Promise<ContentMarketplace[]> {
  return db
    .select()
    .from(contentMarketplacesTable)
    .orderBy(asc(contentMarketplacesTable.sortOrder), asc(contentMarketplacesTable.name));
}

export async function getContentMarketplaceById(id: number): Promise<ContentMarketplace | undefined> {
  const [row] = await db
    .select()
    .from(contentMarketplacesTable)
    .where(eq(contentMarketplacesTable.id, id))
    .limit(1);
  return row;
}

export async function getContentMarketplaceBySlug(slug: string): Promise<ContentMarketplace | undefined> {
  const [row] = await db
    .select()
    .from(contentMarketplacesTable)
    .where(eq(contentMarketplacesTable.slug, slug.trim().toLowerCase()))
    .limit(1);
  return row;
}

export async function resolveContentMarketplaceForGeneration(opts: {
  contentMarketplaceId?: number | null;
  contentMarketplaceSlug?: string | null;
}): Promise<ContentMarketplace> {
  if (opts.contentMarketplaceId != null) {
    const row = await getContentMarketplaceById(opts.contentMarketplaceId);
    if (!row) throw new ContentMarketplaceError("Marketplace not found");
    if (row.enabled !== 1) throw new ContentMarketplaceError("Marketplace is disabled", "disabled");
    return row;
  }
  if (opts.contentMarketplaceSlug?.trim()) {
    const row = await getContentMarketplaceBySlug(opts.contentMarketplaceSlug);
    if (!row) throw new ContentMarketplaceError("Marketplace not found");
    if (row.enabled !== 1) throw new ContentMarketplaceError("Marketplace is disabled", "disabled");
    return row;
  }

  const [defaultRow] = await db
    .select()
    .from(contentMarketplacesTable)
    .where(and(eq(contentMarketplacesTable.isDefault, 1), eq(contentMarketplacesTable.enabled, 1)))
    .orderBy(asc(contentMarketplacesTable.sortOrder))
    .limit(1);
  if (defaultRow) return defaultRow;

  const [amazonRow] = await db
    .select()
    .from(contentMarketplacesTable)
    .where(and(eq(contentMarketplacesTable.slug, "amazon"), eq(contentMarketplacesTable.enabled, 1)))
    .limit(1);
  if (amazonRow) return amazonRow;

  throw new ContentMarketplaceError("No enabled content marketplace configured");
}

export function serializeContentMarketplaceForClient(row: ContentMarketplace) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    rules: row.rules ?? null,
  };
}

export function serializeContentMarketplaceAdmin(row: ContentMarketplace) {
  return {
    ...serializeContentMarketplaceForClient(row),
    enabled: row.enabled === 1,
    isDefault: row.isDefault === 1,
    aiInstructions: row.aiInstructions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
