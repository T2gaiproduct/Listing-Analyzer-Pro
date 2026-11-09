import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const AI_SKILL_TYPES = ["product_content", "product_images", "aplus_content"] as const;
export type AiSkillType = (typeof AI_SKILL_TYPES)[number];

export const AI_SKILL_STATUSES = ["draft", "published"] as const;
export type AiSkillStatus = (typeof AI_SKILL_STATUSES)[number];

export const aiSkillsTable = pgTable("ai_skills", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft").$type<AiSkillStatus>(),
  skillType: text("skill_type").notNull().default("product_content").$type<AiSkillType>(),
  category: text("category").notNull().default(""),
  marketplaceSlug: text("marketplace_slug").notNull().default("amazon"),
  aiModel: text("ai_model").notNull().default(""),
  instructionsText: text("instructions_text").notNull().default(""),
  /** When set, this skill mirrors admin Marketplace Content for that row. */
  contentMarketplaceId: integer("content_marketplace_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiSkillSchema = createInsertSchema(aiSkillsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiSkill = typeof aiSkillsTable.$inferSelect;
export type InsertAiSkill = z.infer<typeof insertAiSkillSchema>;
