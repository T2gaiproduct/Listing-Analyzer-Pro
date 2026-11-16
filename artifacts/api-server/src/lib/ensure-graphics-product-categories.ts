import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { db, graphicsProductCategoriesTable } from "@workspace/db";
import {
  AMAZON_CATEGORY_SEEDS,
  DEFAULT_GRAPHICS_PRODUCT_CATEGORY,
} from "./amazon-category-seeds.js";

const PFA_BROWSE_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../listing-auditor/src/data/pfa-browse-categories.json",
);

type PfaBrowseCatalog = { categories?: { browsePath: string }[] };

let migrated = false;
let seeded = false;
let readyPromise: Promise<void> | null = null;

export function ensureGraphicsProductCategoriesReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = seedGraphicsProductCategories().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

export async function ensureGraphicsProductCategoriesSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS graphics_product_categories (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      is_system integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS graphics_module_examples (
      id serial PRIMARY KEY,
      product_category_name text NOT NULL,
      template_slug text NOT NULL,
      example_image_url text NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    ALTER TABLE graphics_module_examples
    ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    ALTER TABLE graphics_module_examples
    ADD COLUMN IF NOT EXISTS template_category text NOT NULL DEFAULT 'graphics'
  `);
  await db.execute(sql`
    UPDATE graphics_module_examples
    SET template_category = 'graphics'
    WHERE template_category IS NULL OR trim(template_category) = ''
  `);
  await db.execute(sql`
    ALTER TABLE graphics_module_examples
    DROP CONSTRAINT IF EXISTS graphics_module_examples_product_category_name_template_slug_key
  `);
  await db.execute(sql`
    ALTER TABLE graphics_module_examples
    DROP CONSTRAINT IF EXISTS graphics_module_examples_product_category_name_template_slu_key
  `);
  await db.execute(sql`
    DROP INDEX IF EXISTS graphics_module_examples_category_slug_uidx
  `);

  migrated = true;
}

export async function seedGraphicsProductCategories(): Promise<void> {
  await ensureGraphicsProductCategoriesSchemaMigrated();

  if (!seeded) {
    const seeds: { name: string; isSystem: number; sortOrder: number }[] = [
      { name: DEFAULT_GRAPHICS_PRODUCT_CATEGORY, isSystem: 1, sortOrder: 0 },
      ...AMAZON_CATEGORY_SEEDS.map((name, i) => ({
        name,
        isSystem: 1,
        sortOrder: 10 + i,
      })),
    ];

    for (const seed of seeds) {
      const existing = await db
        .select({ id: graphicsProductCategoriesTable.id })
        .from(graphicsProductCategoriesTable)
        .where(eq(graphicsProductCategoriesTable.name, seed.name))
        .limit(1);
      if (existing.length > 0) continue;
      await db.insert(graphicsProductCategoriesTable).values(seed);
    }

    seeded = true;
  }

  await seedPfaBrowsePaths();
}

async function seedPfaBrowsePaths(): Promise<void> {
  let raw: PfaBrowseCatalog;
  try {
    const text = fs.readFileSync(PFA_BROWSE_JSON, "utf8");
    raw = JSON.parse(text) as PfaBrowseCatalog;
  } catch {
    return;
  }

  const paths = (raw.categories ?? [])
    .map((c) => c.browsePath?.trim())
    .filter((p): p is string => Boolean(p));

  const chunkSize = 200;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const values = chunk.map((name, j) => ({
      name,
      isSystem: 1,
      sortOrder: 1000 + i + j,
    }));
    await db
      .insert(graphicsProductCategoriesTable)
      .values(values)
      .onConflictDoNothing({ target: graphicsProductCategoriesTable.name });
  }
}
