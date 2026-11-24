import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { DEFAULT_CONTENT_MARKETPLACE_SEEDS } from "./content-marketplace-defaults.js";

const SETTINGS_KEY = "dismissed_content_marketplace_slugs";

const DEFAULT_SEED_SLUGS = new Set(DEFAULT_CONTENT_MARKETPLACE_SEEDS.map((s) => s.slug));

export function isBundledContentMarketplaceSlug(slug: string): boolean {
  return DEFAULT_SEED_SLUGS.has(slug.trim().toLowerCase());
}

async function readDismissedSlugs(): Promise<Set<string>> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, SETTINGS_KEY))
    .limit(1);
  if (!row?.value?.trim()) return new Set();
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0));
  } catch {
    return new Set();
  }
}

export async function getDismissedContentMarketplaceSlugs(): Promise<Set<string>> {
  return readDismissedSlugs();
}

export async function dismissContentMarketplaceSlug(slug: string): Promise<void> {
  const normalized = slug.trim().toLowerCase();
  if (!isBundledContentMarketplaceSlug(normalized)) return;
  const current = await readDismissedSlugs();
  if (current.has(normalized)) return;
  current.add(normalized);
  const payload = JSON.stringify([...current].sort());
  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, SETTINGS_KEY))
    .limit(1);
  if (existing) {
    await db
      .update(settingsTable)
      .set({ value: payload, updatedAt: new Date() })
      .where(eq(settingsTable.key, SETTINGS_KEY));
  } else {
    await db.insert(settingsTable).values({
      key: SETTINGS_KEY,
      value: payload,
      updatedAt: new Date(),
    });
  }
}