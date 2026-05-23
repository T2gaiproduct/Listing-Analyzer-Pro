import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  planId: integer("plan_id"),
  billingCycle: varchar("billing_cycle", { length: 10 }).notNull().default("monthly"),
  status: varchar("status", { length: 20 }).notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardBrand: varchar("card_brand", { length: 20 }),
  autoRenew: boolean("auto_renew").notNull().default(true),
  couponCode: varchar("coupon_code", { length: 50 }),
  discountAmount: integer("discount_amount").notNull().default(0),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
