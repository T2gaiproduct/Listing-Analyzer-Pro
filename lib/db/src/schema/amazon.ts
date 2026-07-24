import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const amazonSellerConnectionsTable = pgTable("amazon_seller_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  sellerId: text("seller_id").notNull(),
  refreshToken: text("refresh_token").notNull(),
  marketplaceIds: jsonb("marketplace_ids").$type<string[]>().notNull().default([]),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const amazonPublishJobsTable = pgTable("amazon_publish_jobs", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").notNull(),
  userId: text("user_id").notNull(),
  marketplace: text("marketplace").notNull(),
  sku: text("sku").notNull(),
  status: text("status").notNull(),
  response: jsonb("response"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AmazonSellerConnection = typeof amazonSellerConnectionsTable.$inferSelect;
export type AmazonPublishJob = typeof amazonPublishJobsTable.$inferSelect;
