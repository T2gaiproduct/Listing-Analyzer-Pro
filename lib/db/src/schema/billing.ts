import { pgTable, text, serial, integer, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  planId: integer("plan_id"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  gateway: text("gateway").notNull(),
  gatewayPaymentId: text("gateway_payment_id"),
  invoiceId: integer("invoice_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("unpaid"),
  items: jsonb("items").notNull().$type<Array<{ description: string; amount: number; quantity: number }>>().default([]),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refundsTable = pgTable("refunds", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountPercent: integer("discount_percent"),
  discountAmount: real("discount_amount"),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").notNull().default(true),
  appliesTo: jsonb("applies_to").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Payment = typeof paymentsTable.$inferSelect;
export type Invoice = typeof invoicesTable.$inferSelect;
export type Refund = typeof refundsTable.$inferSelect;
export type Coupon = typeof couponsTable.$inferSelect;
