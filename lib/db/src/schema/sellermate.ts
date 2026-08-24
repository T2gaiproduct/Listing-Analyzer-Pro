import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Platform default agents (workspaceId null) or seller-created agents per workspace. */
export const sellermateAgentsTable = pgTable("sellermate_agents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id"),
  userId: text("user_id"),
  slug: text("slug"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull(),
  icon: text("icon").notNull().default("sparkles"),
  isDefault: integer("is_default").notNull().default(0),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Conversation threads — one per seller per agent (separate memory). */
export const sellermateThreadsTable = pgTable("sellermate_threads", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => sellermateAgentsTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New chat"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sellermateMessagesTable = pgTable("sellermate_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => sellermateThreadsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Long-term memory snippets / files per agent per workspace. */
export const sellermateMemoryTable = pgTable("sellermate_memory", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => sellermateAgentsTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSellermateAgentSchema = createInsertSchema(sellermateAgentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SellermateAgent = typeof sellermateAgentsTable.$inferSelect;
export type InsertSellermateAgent = z.infer<typeof insertSellermateAgentSchema>;
export type SellermateThread = typeof sellermateThreadsTable.$inferSelect;
export type SellermateMessage = typeof sellermateMessagesTable.$inferSelect;
export type SellermateMemory = typeof sellermateMemoryTable.$inferSelect;
