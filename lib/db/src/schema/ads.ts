import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const AD_STATUS = ["draft", "active", "paused", "completed", "failed"] as const;
export type AdStatus = (typeof AD_STATUS)[number];

export const adsProjectsTable = pgTable("ads_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  teamId: text("team_id"),
  auditId: integer("audit_id"),
  name: text("name").notNull().default("Untitled Campaign"),
  productName: text("product_name").notNull(),
  category: text("category"),
  status: text("status").notNull().default("draft"),
  platform: text("platform").notNull().default("amazon"),
  budget: integer("budget"),
  spend: integer("spend").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  targeting: jsonb("targeting").$type<string[]>(),
  creativeUrls: jsonb("creative_urls").$type<string[]>(),
  errorMessage: text("error_message"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdsProjectSchema = createInsertSchema(adsProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdsProject = z.infer<typeof insertAdsProjectSchema>;
export type AdsProject = typeof adsProjectsTable.$inferSelect;
