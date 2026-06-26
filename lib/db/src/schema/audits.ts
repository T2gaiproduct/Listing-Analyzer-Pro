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

export const generatedContentSchema = z.object({
  title: z.string(),
  bulletPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  htmlDescription: z.string(),
});

export const generatedImagesSchema = z.object({
  main: z.array(z.string()),
  infographic: z.array(z.string()),
  lifestyle: z.array(z.string()),
});

export const IMAGE_STYLES = ["premium", "minimal", "luxury", "modern", "infographic", "lifestyle"] as const;
export const ASPECT_RATIOS = ["1:1", "3:2", "2:3"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const imageVersionSchema = z.object({
  url: z.string(),
  style: z.string(),
  aspectRatio: z.string(),
  prompt: z.string().optional(),
  isEdit: z.boolean(),
  generatedAt: z.string(),
});

export const imageRecordSchema = z.object({
  id: z.string(),
  type: z.enum(["main", "infographic", "lifestyle"]),
  index: z.number(),
  style: z.string(),
  aspectRatio: z.string(),
  currentUrl: z.string(),
  versions: z.array(imageVersionSchema),
});

export const imageRecordsSchema = z.array(imageRecordSchema);

export type AuditResult = z.infer<typeof auditResultSchema>;
export type GeneratedContent = z.infer<typeof generatedContentSchema>;
export type GeneratedImages = z.infer<typeof generatedImagesSchema>;
export type ImageVersion = z.infer<typeof imageVersionSchema>;
export type ImageRecord = z.infer<typeof imageRecordSchema>;
export type ImageRecords = z.infer<typeof imageRecordsSchema>;

export const auditsTable = pgTable("audits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  productName: text("product_name").notNull(),
  asin: text("asin"),
  brandName: text("brand_name"),
  category: text("category"),
  title: text("title").notNull(),
  bulletPoints: jsonb("bullet_points").notNull().$type<string[]>(),
  imageUrls: jsonb("image_urls").notNull().$type<string[]>(),
  targetKeywords: jsonb("target_keywords").notNull().$type<string[]>(),
  overallScore: integer("overall_score").notNull().default(0),
  status: text("status").notNull().default("pending"),
  result: jsonb("result").$type<AuditResult>(),
  generatedContent: jsonb("generated_content").$type<GeneratedContent>(),
  generatedImages: jsonb("generated_images").$type<GeneratedImages>(),
  imageRecords: jsonb("image_records").$type<ImageRecords>(),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
