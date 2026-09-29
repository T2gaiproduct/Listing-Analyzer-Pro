import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const imagePromptTemplateCategorySchema = z.enum(["graphics", "aplus"]);
export type ImagePromptTemplateCategory = z.infer<typeof imagePromptTemplateCategorySchema>;

export const imagePromptTemplateMetadataSchema = z.object({
  icon: z.string().optional(),
  /** Where generated graphics images are stored in the project record */
  graphicsBucket: z.enum(["feature", "lifestyle"]).optional(),
  /** User-provided prompt only (graphics "custom" type) */
  isUserCustomType: z.boolean().optional(),
});

export type ImagePromptTemplateMetadata = z.infer<typeof imagePromptTemplateMetadataSchema>;

export const imagePromptTemplatesTable = pgTable("image_prompt_templates", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
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
});

export const insertImagePromptTemplateSchema = createInsertSchema(imagePromptTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ImagePromptTemplate = typeof imagePromptTemplatesTable.$inferSelect;
export type InsertImagePromptTemplate = z.infer<typeof insertImagePromptTemplateSchema>;
