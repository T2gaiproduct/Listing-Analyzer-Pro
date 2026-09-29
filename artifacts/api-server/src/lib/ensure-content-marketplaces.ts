import { eq, sql } from "drizzle-orm";
import { contentMarketplacesTable, db } from "@workspace/db";
import { DEFAULT_CONTENT_MARKETPLACE_SEEDS } from "./content-marketplace-defaults.js";

let migrated = false;

export async function ensureContentMarketplacesSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS content_marketplaces (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      enabled integer NOT NULL DEFAULT 1,
      is_default integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      ai_instructions text NOT NULL,
      rules jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    ALTER TABLE audits ADD COLUMN IF NOT EXISTS content_marketplace_id integer
  `);

  migrated = true;
}

export async function ensureDefaultContentMarketplacesSeeded(): Promise<void> {
  await ensureContentMarketplacesSchemaMigrated();

  for (const seed of DEFAULT_CONTENT_MARKETPLACE_SEEDS) {
    const existing = await db
      .select({ id: contentMarketplacesTable.id })
      .from(contentMarketplacesTable)
      .where(eq(contentMarketplacesTable.slug, seed.slug))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(contentMarketplacesTable).values({
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      enabled: seed.enabled,
      isDefault: seed.isDefault,
      sortOrder: seed.sortOrder,
      aiInstructions: seed.aiInstructions,
      rules: seed.rules ?? null,
    });
  }
}
