import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoreDetailSchema = z.object({
  score: z.number(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export const auditResultSchema = z.object({
  titleScore: scoreDetailSchema,
  bulletScore: scoreDetailSchema,
  imageScore: scoreDetailSchema,
  keywordScore: scoreDetailSchema,
  overallScore: z.number(),
  summary: z.string(),
});

export type AuditResult = z.infer<typeof auditResultSchema>;

export const auditsTable = pgTable("audits", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  asin: text("asin"),
  category: text("category"),
  title: text("title").notNull(),
  bulletPoints: jsonb("bullet_points").notNull().$type<string[]>(),
  imageUrls: jsonb("image_urls").notNull().$type<string[]>(),
  targetKeywords: jsonb("target_keywords").notNull().$type<string[]>(),
  overallScore: integer("overall_score").notNull().default(0),
  status: text("status").notNull().default("pending"),
  result: jsonb("result").$type<AuditResult>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
