import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const pinnedProjectsTable = pgTable("pinned_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  itemType: text("item_type").notNull(),
  itemId: integer("item_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique("pinned_projects_user_type_item_uniq").on(t.userId, t.itemType, t.itemId),
}));

export type PinnedProject = typeof pinnedProjectsTable.$inferSelect;
