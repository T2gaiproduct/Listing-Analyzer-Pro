import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditsTable } from "./audits";

export const competitorsTable = pgTable("competitors", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").notNull().references(() => auditsTable.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  asin: text("asin"),
  title: text("title").notNull(),
  bulletPoints: jsonb("bullet_points").notNull().$type<string[]>(),
  imageCount: integer("image_count").notNull().default(0),
  targetKeywords: jsonb("target_keywords").notNull().$type<string[]>(),
  overallScore: integer("overall_score").notNull().default(0),
  strengths: jsonb("strengths").notNull().$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompetitorSchema = createInsertSchema(competitorsTable).omit({ id: true, createdAt: true });
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type Competitor = typeof competitorsTable.$inferSelect;
