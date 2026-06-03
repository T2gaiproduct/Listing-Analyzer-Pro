import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const adminRolesTable = pgTable("admin_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().$type<string[]>().default([]),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  roleId: integer("role_id").notNull(),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const downloadsTable = pgTable("downloads", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  auditId: integer("audit_id"),
  type: text("type").notNull(),
  filename: text("filename"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminRole = typeof adminRolesTable.$inferSelect;
export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type Download = typeof downloadsTable.$inferSelect;
