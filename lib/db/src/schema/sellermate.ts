import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Per-workspace default agents or seller-created custom agents. */
export const sellermateAgentsTable = pgTable("sellermate_agents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id"),
  userId: text("user_id"),
  slug: text("slug"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull(),
  icon: text("icon").notNull().default("sparkles"),
  model: text("model").notNull().default("gpt-5.4"),
  status: text("status").notNull().default("active"),
  executionProvider: text("execution_provider").notNull().default("native"),
  makeAgentId: text("make_agent_id"),
  isDefault: integer("is_default").notNull().default(0),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Enabled tools per agent (Make callbacks into SellerLens APIs). */
export const sellermateAgentToolsTable = pgTable("sellermate_agent_tools", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => sellermateAgentsTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").notNull(),
  toolName: text("tool_name").notNull(),
  enabled: integer("enabled").notNull().default(1),
  requiresApproval: integer("requires_approval").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  externalConversationId: text("external_conversation_id"),
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
  /** JSON: phase, questions, options, selectedOptionId, toolsUsed */
  metadata: text("metadata"),
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
  description: text("description").notNull().default(""),
  memoryKey: text("memory_key"),
  memoryType: text("memory_type").notNull().default("file"),
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
export type SellermateAgentTool = typeof sellermateAgentToolsTable.$inferSelect;
export type SellermateThread = typeof sellermateThreadsTable.$inferSelect;
export type SellermateMessage = typeof sellermateMessagesTable.$inferSelect;
export type SellermateMemory = typeof sellermateMemoryTable.$inferSelect;
