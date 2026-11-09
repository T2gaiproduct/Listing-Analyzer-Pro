import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const AI_SKILL_TYPE_CATALOG_GROUPS = [
  "content",
  "image",
  "audit",
  "other",
] as const;
export type AiSkillTypeCatalogGroup = (typeof AI_SKILL_TYPE_CATALOG_GROUPS)[number];

export const AI_SKILL_TYPE_EDITOR_MODES = [
  "content",
  "image",
  "audit",
  "generic",
] as const;
export type AiSkillTypeEditorMode = (typeof AI_SKILL_TYPE_EDITOR_MODES)[number];

export const aiSkillTypesTable = pgTable("ai_skill_types", {
  id: serial("id").primaryKey(),
  /** Stored on ai_skills.skill_type */
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  catalogGroup: text("catalog_group").notNull().default("other").$type<AiSkillTypeCatalogGroup>(),
  editorMode: text("editor_mode").notNull().default("generic").$type<AiSkillTypeEditorMode>(),
  /** When set, maps to a built-in runtime handler (e.g. product_content). Null = instructions only until wired in code. */
  handlerKey: text("handler_key"),
  description: text("description"),
  enabled: integer("enabled").notNull().default(1),
  isBuiltin: integer("is_builtin").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiSkillTypeSchema = createInsertSchema(aiSkillTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiSkillTypeRow = typeof aiSkillTypesTable.$inferSelect;
export type InsertAiSkillType = z.infer<typeof insertAiSkillTypeSchema>;
