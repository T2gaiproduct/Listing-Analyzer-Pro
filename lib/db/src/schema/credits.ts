import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Credits = typeof creditsTable.$inferSelect;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
