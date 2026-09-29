import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentMarketplaceRulesSchema = z.object({
  titleMinChars: z.number().int().positive().optional(),
  titleMaxChars: z.number().int().positive().optional(),
  bulletCount: z.number().int().positive().optional(),
  bulletMinChars: z.number().int().positive().optional(),
  bulletMaxChars: z.number().int().positive().optional(),
  keywordCount: z.number().int().positive().optional(),
  descriptionMinWords: z.number().int().positive().optional(),
  descriptionMaxWords: z.number().int().positive().optional(),
  requiredFields: z.array(z.string()).optional(),
  formattingNotes: z.string().optional(),
});

export type ContentMarketplaceRules = z.infer<typeof contentMarketplaceRulesSchema>;

export const contentMarketplacesTable = pgTable("content_marketplaces", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled").notNull().default(1),
  isDefault: integer("is_default").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  aiInstructions: text("ai_instructions").notNull(),
  rules: jsonb("rules").$type<ContentMarketplaceRules>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentMarketplaceSchema = createInsertSchema(contentMarketplacesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContentMarketplace = typeof contentMarketplacesTable.$inferSelect;
export type InsertContentMarketplace = z.infer<typeof insertContentMarketplaceSchema>;
