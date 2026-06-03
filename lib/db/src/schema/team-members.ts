import { pgTable, serial, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  memberUserId: text("member_user_id"),
  invitedEmail: text("invited_email").notNull(),
  invitedName: varchar("invited_name", { length: 200 }).notNull(),
  role: text("role").notNull().default("editor"),
  status: text("status").notNull().default("pending"),
  inviteToken: text("invite_token").notNull().unique(),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
});

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type InsertTeamMember = typeof teamMembersTable.$inferInsert;
