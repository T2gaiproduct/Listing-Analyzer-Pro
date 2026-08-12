import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";

export const productProfilesTable = pgTable("product_profiles", {
  auditId: integer("audit_id").primaryKey(),
  sku: text("sku").notNull(),
  priority: text("priority").notNull().default("medium"),
  assignedManager: text("assigned_manager"),
  referenceLinks: text("reference_links"),
  driveFolderUrl: text("drive_folder_url"),
  workflowTemplate: text("workflow_template").notNull(),
  targetMarketplaces: jsonb("target_marketplaces").notNull().$type<string[]>().default([]),
});

export type ProductProfile = typeof productProfilesTable.$inferSelect;
export type NewProductProfile = typeof productProfilesTable.$inferInsert;
