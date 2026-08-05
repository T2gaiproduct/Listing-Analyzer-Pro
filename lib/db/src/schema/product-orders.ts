import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const productOrdersTable = pgTable("product_orders", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").notNull(),
  workspaceId: integer("workspace_id"),
  orderNumber: text("order_number").notNull(),
  marketplace: text("marketplace").notNull(),
  customerName: text("customer_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(),
  orderedAt: timestamp("ordered_at").notNull(),
  trackingNumber: text("tracking_number"),
  isDeleted: integer("is_deleted").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProductOrder = typeof productOrdersTable.$inferSelect;
export type NewProductOrder = typeof productOrdersTable.$inferInsert;
