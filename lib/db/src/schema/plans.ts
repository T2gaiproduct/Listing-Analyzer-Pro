import { pgTable, text, serial, integer, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceYearly: integer("price_yearly").notNull().default(0),
  aiCredits: integer("ai_credits").notNull().default(0),
  imageCredits: integer("image_credits").notNull().default(0),
  auditCredits: integer("audit_credits").notNull().default(0),
  teamMembers: integer("team_members").notNull().default(1),
  creditAllocations: jsonb("credit_allocations").$type<Record<string, number>>().notNull().default({}),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  excludedFeatures: jsonb("excluded_features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isTrial: boolean("is_trial").notNull().default(false),
  trialDays: integer("trial_days").notNull().default(0),
  tag: varchar("tag", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  ctaText: varchar("cta_text", { length: 100 }),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = typeof plansTable.$inferInsert;
