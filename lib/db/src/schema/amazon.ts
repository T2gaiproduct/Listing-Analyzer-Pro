import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const amazonSellerConnectionsTable = pgTable("amazon_seller_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  sellerId: text("seller_id"),
  marketplaceId: text("marketplace_id").notNull().default("ATVPDKIKX0DER"),
  refreshToken: text("refresh_token"),
  connectedAt: timestamp("connected_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AmazonSellerConnection = typeof amazonSellerConnectionsTable.$inferSelect;
