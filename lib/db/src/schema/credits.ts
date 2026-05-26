import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const creditsTable = pgTable("credits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  aiCredits: integer("ai_credits").notNull().default(0),
  imageCredits: integer("image_credits").notNull().default(0),
  auditCredits: integer("audit_credits").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  creditType: text("credit_type").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  featureType: text("feature_type"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditPacksTable = pgTable("credit_packs", {
  id: serial("id").primaryKey(),
  creditType: text("credit_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceCents: integer("price_cents").notNull().default(0),
  label: text("label"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creditRulesTable = pgTable("credit_rules", {
  id: serial("id").primaryKey(),
  activityName: text("activity_name").notNull(),
  featureType: text("feature_type").notNull().unique(),
  creditType: text("credit_type").notNull().default("audit"),
  creditsRequired: integer("credits_required").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Credits = typeof creditsTable.$inferSelect;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
export type CreditPack = typeof creditPacksTable.$inferSelect;
export type InsertCreditPack = typeof creditPacksTable.$inferInsert;
export type CreditRule = typeof creditRulesTable.$inferSelect;
export type InsertCreditRule = typeof creditRulesTable.$inferInsert;
