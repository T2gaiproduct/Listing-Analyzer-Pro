import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const VIDEO_STATUS = ["draft", "processing", "completed", "failed"] as const;
export type VideoStatus = (typeof VIDEO_STATUS)[number];

export const videosProjectsTable = pgTable("videos_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  teamId: text("team_id"),
  auditId: integer("audit_id"),
  name: text("name").notNull().default("Untitled Video"),
  productName: text("product_name").notNull(),
  category: text("category"),
  status: text("status").notNull().default("draft"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  script: text("script"),
  style: text("style"),
  errorMessage: text("error_message"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVideosProjectSchema = createInsertSchema(videosProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideosProject = z.infer<typeof insertVideosProjectSchema>;
export type VideosProject = typeof videosProjectsTable.$inferSelect;
