import { and, eq, sql } from "drizzle-orm";
import { db, imagePromptTemplatesTable } from "@workspace/db";
import { DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS } from "./image-prompt-template-defaults.js";

let migrated = false;

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

export async function ensureDefaultImagePromptTemplatesSeeded(): Promise<void> {
  await ensureImagePromptTemplatesSchemaMigrated();

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
      metadata: seed.metadata ?? null,
    });
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
}
