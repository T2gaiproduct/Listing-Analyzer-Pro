import { pgTable, text, serial, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const imagePromptTemplateCategorySchema = z.enum(["graphics", "aplus"]);
export type ImagePromptTemplateCategory = z.infer<typeof imagePromptTemplateCategorySchema>;

export const aplusContentTierSchema = z.enum(["standard", "premium", "brand_story"]);
export type AplusContentTier = z.infer<typeof aplusContentTierSchema>;

export const imagePromptTemplateMetadataSchema = z.object({
  icon: z.string().optional(),
  /** Where generated graphics images are stored in the project record */
  graphicsBucket: z.enum(["feature", "lifestyle"]).optional(),
  /** User-provided prompt only (graphics "custom" type) */
  isUserCustomType: z.boolean().optional(),
  /** Prepended when using an uploaded product as OpenAI reference (Product graphics / A+). */
  referenceInstruction: z.string().optional(),
  /** Extra rules prepended with the main prompt_template during reference-based generation. */
  referenceRules: z.string().optional(),
  /** Shorter prompt if the provider rejects the full reference prompt (optional). */
  referenceRetry: z.string().optional(),
  /** Appended during composite fallback when the scene is generated without the product layer. */
  compositeSceneSuffix: z.string().optional(),
  /** Scene-only prompt when composite generation hits safety filters (optional). */
  compositeFallbackScene: z.string().optional(),
  /**
   * Amazon A+ content family. Standard and Premium cannot be mixed in one document.
   * Brand Story is a separate content type.
   */
  aplusTier: aplusContentTierSchema.optional(),
  /** Amazon upload width in pixels (primary image slot). */
  imageWidth: z.number().int().positive().optional(),
  /** Amazon upload height in pixels (primary image slot). */
  imageHeight: z.number().int().positive().optional(),
  /** How many image slots this module uses (when >1, prompts describe a composite grid). */
  imageCount: z.number().int().positive().optional(),
  /** Official Amazon module display name from Seller Central / module guides. */
  amazonModuleName: z.string().optional(),
});

export type ImagePromptTemplateMetadata = z.infer<typeof imagePromptTemplateMetadataSchema>;

export const imagePromptTemplatesTable = pgTable(
  "image_prompt_templates",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    category: text("category").notNull().$type<ImagePromptTemplateCategory>(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: integer("enabled").notNull().default(1),
    isSystem: integer("is_system").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    promptTemplate: text("prompt_template").notNull(),
    headlineTemplate: text("headline_template"),
    bodyTemplate: text("body_template"),
    metadata: jsonb("metadata").$type<ImagePromptTemplateMetadata>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugCategoryUnique: uniqueIndex("image_prompt_templates_slug_category_uidx").on(
      table.slug,
      table.category,
    ),
  }),
);

export const insertImagePromptTemplateSchema = createInsertSchema(imagePromptTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ImagePromptTemplate = typeof imagePromptTemplatesTable.$inferSelect;
export type InsertImagePromptTemplate = z.infer<typeof insertImagePromptTemplateSchema>;
