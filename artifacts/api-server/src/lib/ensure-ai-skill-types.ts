import { asc, eq } from "drizzle-orm";
import { aiSkillTypesTable, db } from "@workspace/db";

const BUILTIN_TYPES: {
  slug: string;
  label: string;
  catalogGroup: "content" | "image" | "audit" | "other";
  editorMode: "content" | "image" | "audit" | "generic";
  handlerKey: string;
  description: string;
  sortOrder: number;
}[] = [
  {
    slug: "product_content",
    label: "Product content",
    catalogGroup: "content",
    editorMode: "content",
    handlerKey: "product_content",
    description: "Listing title, bullets, and description per marketplace and category.",
    sortOrder: 10,
  },
  {
    slug: "product_images",
    label: "Product images",
    catalogGroup: "image",
    editorMode: "image",
    handlerKey: "product_images",
    description: "Graphics studio image generation rules per category.",
    sortOrder: 20,
  },
  {
    slug: "aplus_content",
    label: "A+ content",
    catalogGroup: "image",
    editorMode: "image",
    handlerKey: "aplus_content",
    description: "A+ module image and copy prompts.",
    sortOrder: 30,
  },
  {
    slug: "listing_audit",
    label: "Listing audit",
    catalogGroup: "audit",
    editorMode: "audit",
    handlerKey: "listing_audit",
    description: "Audit rubric, weights, and score display.",
    sortOrder: 40,
  },
];

let readyPromise: Promise<void> | null = null;
let enabledSlugCache: Set<string> | null = null;
let slugMetaCache: Map<string, typeof BUILTIN_TYPES[number] & { handlerKey: string | null }> | null =
  null;

export function ensureAiSkillTypesReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = bootstrapAiSkillTypes().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

async function bootstrapAiSkillTypes(): Promise<void> {
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_skill_types (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      label text NOT NULL,
      catalog_group text NOT NULL DEFAULT 'other',
      editor_mode text NOT NULL DEFAULT 'generic',
      handler_key text,
      description text,
      enabled integer NOT NULL DEFAULT 1,
      is_builtin integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  for (const seed of BUILTIN_TYPES) {
    const [existing] = await db
      .select({ id: aiSkillTypesTable.id })
      .from(aiSkillTypesTable)
      .where(eq(aiSkillTypesTable.slug, seed.slug))
      .limit(1);
    if (existing) continue;
    await db.insert(aiSkillTypesTable).values({
      slug: seed.slug,
      label: seed.label,
      catalogGroup: seed.catalogGroup,
      editorMode: seed.editorMode,
      handlerKey: seed.handlerKey,
      description: seed.description,
      enabled: 1,
      isBuiltin: 1,
      sortOrder: seed.sortOrder,
    });
  }

  await refreshSkillTypeCache();
}

export async function refreshSkillTypeCache(): Promise<void> {
  const rows = await db
    .select()
    .from(aiSkillTypesTable)
    .where(eq(aiSkillTypesTable.enabled, 1))
    .orderBy(asc(aiSkillTypesTable.sortOrder), asc(aiSkillTypesTable.slug));

  enabledSlugCache = new Set(rows.map((r) => r.slug));
  slugMetaCache = new Map();
  for (const row of rows) {
    slugMetaCache.set(row.slug, {
      slug: row.slug,
      label: row.label,
      catalogGroup: row.catalogGroup as typeof BUILTIN_TYPES[number]["catalogGroup"],
      editorMode: row.editorMode as typeof BUILTIN_TYPES[number]["editorMode"],
      handlerKey: row.handlerKey,
      description: row.description ?? "",
      sortOrder: row.sortOrder,
    });
  }
}

export function isEnabledSkillTypeSlug(slug: string): boolean {
  if (!enabledSlugCache) return BUILTIN_TYPES.some((t) => t.slug === slug);
  return enabledSlugCache.has(slug);
}

export function resolveSkillHandlerKey(skillTypeSlug: string): string | null {
  const meta = slugMetaCache?.get(skillTypeSlug);
  if (meta?.handlerKey) return meta.handlerKey;
  if (BUILTIN_TYPES.some((t) => t.slug === skillTypeSlug)) return skillTypeSlug;
  return null;
}

export function invalidateSkillTypeCache(): void {
  enabledSlugCache = null;
  slugMetaCache = null;
}
