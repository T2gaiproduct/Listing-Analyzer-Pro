import { and, eq, inArray, sql } from "drizzle-orm";
import { db, imagePromptTemplatesTable } from "@workspace/db";
import { DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS } from "./image-prompt-template-defaults.js";
import {
  defaultAplusReferenceMetadata,
  defaultGraphicsReferenceMetadataForSlug,
} from "./image-prompt-reference-seeds.js";
import { parseImagePromptMetadata } from "./image-prompt-template-service.js";
import type { ImagePromptTemplateMetadata } from "@workspace/db";

let migrated = false;
let constraintMigrated = false;
let readyPromise: Promise<void> | null = null;

/** Idempotent: schema + default rows (graphics + A+). Safe to await before listing or generating. */
export function ensureImagePromptTemplatesReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = ensureDefaultImagePromptTemplatesSeeded().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

export async function ensureImagePromptTemplatesSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS image_prompt_templates (
      id serial PRIMARY KEY,
      slug text NOT NULL,
      category text NOT NULL,
      name text NOT NULL,
      description text,
      enabled integer NOT NULL DEFAULT 1,
      is_system integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      prompt_template text NOT NULL,
      headline_template text,
      body_template text,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (slug, category)
    )
  `);

  migrated = true;
}

/** Older DBs used UNIQUE(slug) only, which blocks A+ rows that share slugs with graphics (e.g. hero). */
async function ensureImagePromptTemplatesSlugCategoryUnique(): Promise<void> {
  if (constraintMigrated) return;
  await ensureImagePromptTemplatesSchemaMigrated();

  await db.execute(sql`
    ALTER TABLE image_prompt_templates
    DROP CONSTRAINT IF EXISTS image_prompt_templates_slug_unique
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS image_prompt_templates_slug_category_uidx
    ON image_prompt_templates (slug, category)
  `);

  constraintMigrated = true;
}

export async function ensureDefaultImagePromptTemplatesSeeded(): Promise<void> {
  await ensureImagePromptTemplatesSchemaMigrated();
  await ensureImagePromptTemplatesSlugCategoryUnique();

  const wrapperDefaultsForSeed = (
    category: (typeof DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS)[number]["category"],
    slug: string,
  ): Partial<ImagePromptTemplateMetadata> =>
    category === "aplus"
      ? defaultAplusReferenceMetadata()
      : defaultGraphicsReferenceMetadataForSlug(slug);

  for (const seed of DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS) {
    const existing = await db
      .select({ id: imagePromptTemplatesTable.id })
      .from(imagePromptTemplatesTable)
      .where(
        and(
          eq(imagePromptTemplatesTable.slug, seed.slug),
          eq(imagePromptTemplatesTable.category, seed.category),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(imagePromptTemplatesTable).values({
      slug: seed.slug,
      category: seed.category,
      name: seed.name,
      description: seed.description,
      enabled: seed.enabled,
      isSystem: seed.isSystem,
      sortOrder: seed.sortOrder,
      promptTemplate: seed.promptTemplate,
      headlineTemplate: seed.headlineTemplate ?? null,
      bodyTemplate: seed.bodyTemplate ?? null,
      metadata: {
        ...(seed.metadata ?? {}),
        ...wrapperDefaultsForSeed(seed.category, seed.slug),
      },
    });
  }

  const existingRows = await db.select().from(imagePromptTemplatesTable);
  for (const row of existingRows) {
    const meta = parseImagePromptMetadata(row.metadata);
    const seed = DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS.find(
      (s) => s.slug === row.slug && s.category === row.category,
    );
    const needsAplusMeta =
      row.category === "aplus" &&
      seed?.metadata &&
      (!meta.aplusTier || !meta.imageWidth || !meta.imageHeight);
    const needsReference = !meta.referenceInstruction?.trim();

    if (!needsReference && !needsAplusMeta) continue;

    const defaults = needsReference ? wrapperDefaultsForSeed(row.category, row.slug) : {};
    const aplusPatch = needsAplusMeta
      ? {
          aplusTier: seed?.metadata?.aplusTier ?? meta.aplusTier,
          imageWidth: seed?.metadata?.imageWidth ?? meta.imageWidth,
          imageHeight: seed?.metadata?.imageHeight ?? meta.imageHeight,
          imageCount: seed?.metadata?.imageCount ?? meta.imageCount,
          amazonModuleName: seed?.metadata?.amazonModuleName ?? meta.amazonModuleName,
          icon: meta.icon ?? seed?.metadata?.icon,
        }
      : {};

    await db
      .update(imagePromptTemplatesTable)
      .set({
        // Only enrich Amazon dimension/tier metadata — never overwrite admin-edited prompts.
        ...(needsAplusMeta && seed && row.isSystem === 1
          ? {
              name: seed.name,
              description: seed.description,
              sortOrder: seed.sortOrder,
            }
          : {}),
        metadata: { ...meta, ...defaults, ...aplusPatch },
        updatedAt: new Date(),
      })
      .where(eq(imagePromptTemplatesTable.id, row.id));
  }

  const customSeed = DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS.find(
    (s) => s.category === "graphics" && s.slug === "custom",
  );
  if (customSeed) {
    await db
      .update(imagePromptTemplatesTable)
      .set({
        promptTemplate: customSeed.promptTemplate,
        metadata: customSeed.metadata ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imagePromptTemplatesTable.slug, "custom"),
          eq(imagePromptTemplatesTable.category, "graphics"),
          eq(imagePromptTemplatesTable.isSystem, 1),
          sql`length(trim(${imagePromptTemplatesTable.promptTemplate})) < 10`,
        ),
      );
  }

  // Keep system A+ catalog (Standard / Premium / Brand Story) aligned with seeds + Admin AI Skills.
  const aplusSystemTemplateIds: number[] = [];
  for (const seed of DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS) {
    if (seed.category !== "aplus" || seed.isSystem !== 1) continue;
    const meta = parseImagePromptMetadata(seed.metadata);
    const rows = await db
      .select()
      .from(imagePromptTemplatesTable)
      .where(
        and(
          eq(imagePromptTemplatesTable.slug, seed.slug),
          eq(imagePromptTemplatesTable.category, "aplus"),
          eq(imagePromptTemplatesTable.isSystem, 1),
        ),
      )
      .limit(1);
    if (rows.length === 0) continue;
    const row = rows[0]!;
    const existingMeta = parseImagePromptMetadata(row.metadata);
    await db
      .update(imagePromptTemplatesTable)
      .set({
        name: seed.name,
        description: seed.description,
        sortOrder: seed.sortOrder,
        enabled: seed.enabled,
        // System A+ prompts track seeds so Admin → AI Skills stays configured for every module.
        promptTemplate: seed.promptTemplate,
        headlineTemplate: seed.headlineTemplate ?? row.headlineTemplate,
        bodyTemplate: seed.bodyTemplate ?? row.bodyTemplate,
        metadata: {
          ...existingMeta,
          icon: meta.icon ?? existingMeta.icon,
          aplusTier: meta.aplusTier ?? existingMeta.aplusTier ?? "standard",
          imageWidth: meta.imageWidth ?? existingMeta.imageWidth,
          imageHeight: meta.imageHeight ?? existingMeta.imageHeight,
          imageCount: meta.imageCount ?? existingMeta.imageCount ?? 1,
          amazonModuleName: meta.amazonModuleName ?? existingMeta.amazonModuleName,
        },
        updatedAt: new Date(),
      })
      .where(eq(imagePromptTemplatesTable.id, row.id));
    aplusSystemTemplateIds.push(row.id);
  }

  const {
    syncAllImagePromptTemplatesToSkills,
    syncImagePromptTemplateToSkill,
  } = await import("./image-prompt-skill-sync.js");
  await syncAllImagePromptTemplatesToSkills();

  // Force-publish/refresh AI Skills for every system A+ module (Standard, Premium, Brand Story).
  if (aplusSystemTemplateIds.length > 0) {
    const refreshed = await db
      .select()
      .from(imagePromptTemplatesTable)
      .where(inArray(imagePromptTemplatesTable.id, aplusSystemTemplateIds));
    for (const row of refreshed) {
      await syncImagePromptTemplateToSkill(row, { refreshInstructions: true });
    }
  }
}
