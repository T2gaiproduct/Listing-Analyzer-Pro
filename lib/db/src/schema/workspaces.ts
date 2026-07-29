import { pgTable, text, serial, integer, timestamp, jsonb, boolean, unique } from "drizzle-orm/pg-core";
import type { WorkspaceRolePermissions } from "@workspace/workspace-permissions";

export const workspacesTable = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  accountOwnerId: text("account_owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  clientLabel: text("client_label"),
  isDefault: boolean("is_default").notNull().default(false),
  preserveLegacyPermissions: boolean("preserve_legacy_permissions").notNull().default(true),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workspaceRolesTable = pgTable("workspace_roles", {
  id: serial("id").primaryKey(),
  accountOwnerId: text("account_owner_id"),
  workspaceId: integer("workspace_id"),
  name: text("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<WorkspaceRolePermissions>().notNull().default({}),
  isSystem: boolean("is_system").notNull().default(false),
  legacyRoleKey: text("legacy_role_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqAccountName: unique("workspace_roles_account_name_uniq").on(t.accountOwnerId, t.name),
}));

export const workspaceMembersTable = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id"),
  invitedEmail: text("invited_email").notNull(),
  invitedName: text("invited_name").notNull().default(""),
  roleId: integer("role_id"),
  legacyRole: text("legacy_role"),
  status: text("status").notNull().default("pending"),
  inviteToken: text("invite_token").notNull().unique(),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  uniqMember: unique("workspace_members_workspace_user_uniq").on(t.workspaceId, t.userId),
}));

export type Workspace = typeof workspacesTable.$inferSelect;
export type WorkspaceRole = typeof workspaceRolesTable.$inferSelect;
export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;
