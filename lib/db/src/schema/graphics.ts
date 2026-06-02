import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { imageRecordSchema, imageVersionSchema } from "./audits";

export const DESIGN_STYLES = ["modern", "luxury", "outdoor", "minimalist"] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number];

export const GRAPHICS_TYPES = ["lifestyle", "feature"] as const;
export type GraphicsType = (typeof GRAPHICS_TYPES)[number];

export const PROJECT_STATUS = ["draft", "generating", "completed", "failed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const graphicsImageRecordSchema = z.object({
  id: z.string(),
  type: z.enum(["lifestyle", "feature"]),
  index: z.number(),
  style: z.string(),
  aspectRatio: z.string(),
  currentUrl: z.string(),
  versions: z.array(imageVersionSchema),
});

export const graphicsImageRecordsSchema = z.array(graphicsImageRecordSchema);

export type GraphicsImageRecord = z.infer<typeof graphicsImageRecordSchema>;
export type GraphicsImageRecords = z.infer<typeof graphicsImageRecordsSchema>;

export const graphicsProjectsTable = pgTable("graphics_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  teamId: text("team_id"),
  name: text("name").notNull().default("Untitled Project"),
  productName: text("product_name").notNull(),
  category: text("category"),
  sourceImageUrl: text("source_image_url"),
  designStyle: text("design_style").notNull().default("modern"),
  status: text("status").notNull().default("draft"),
  lifestyleCount: integer("lifestyle_count").notNull().default(0),
  featureCount: integer("feature_count").notNull().default(0),
  imageRecords: jsonb("image_records").$type<GraphicsImageRecords>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGraphicsProjectSchema = createInsertSchema(graphicsProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGraphicsProject = z.infer<typeof insertGraphicsProjectSchema>;
export type GraphicsProject = typeof graphicsProjectsTable.$inferSelect;
