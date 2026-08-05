import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const productMarketplaceListingsTable = pgTable("product_marketplace_listings", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").notNull(),
  workspaceId: integer("workspace_id"),
  marketplace: text("marketplace").notNull(),
  status: text("status").notNull(),
  sku: text("sku"),
  priceCents: integer("price_cents"),
  currency: text("currency").notNull().default("USD"),
  inventory: integer("inventory"),
  publishedAt: timestamp("published_at"),
  listingUrl: text("listing_url"),
  isDeleted: integer("is_deleted").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProductMarketplaceListing = typeof productMarketplaceListingsTable.$inferSelect;
export type NewProductMarketplaceListing = typeof productMarketplaceListingsTable.$inferInsert;
