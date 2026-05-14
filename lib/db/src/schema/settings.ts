import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export type Setting = typeof settingsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
