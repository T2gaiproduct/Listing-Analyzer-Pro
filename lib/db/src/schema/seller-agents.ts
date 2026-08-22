import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sellerAgentsTable = pgTable("seller_agents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  icon: text("icon").notNull().default("bot"),
  isDefault: integer("is_default").notNull().default(0),
  isPlatformTemplate: integer("is_platform_template").notNull().default(0),
  mode: text("mode").notNull().default("basic"),
  enabledSkills: jsonb("enabled_skills").$type<string[]>().default([]),
  learnFromWorkspace: integer("learn_from_workspace").notNull().default(1),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sellerAgentMemoryFilesTable = pgTable("seller_agent_memory_files", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size").notNull().default(0),
  source: text("source").notNull().default("upload"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sellerAgentMemoryChunksTable = pgTable("seller_agent_memory_chunks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  memoryFileId: integer("memory_file_id"),
  workspaceId: integer("workspace_id").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding").$type<number[] | null>(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sellerAgentChatsTable = pgTable("seller_agent_chats", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New chat"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sellerAgentMessagesTable = pgTable("seller_agent_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  agentId: integer("agent_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSellerAgentSchema = createInsertSchema(sellerAgentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SellerAgent = typeof sellerAgentsTable.$inferSelect;
export type InsertSellerAgent = z.infer<typeof insertSellerAgentSchema>;
export type SellerAgentMemoryFile = typeof sellerAgentMemoryFilesTable.$inferSelect;
export type SellerAgentMemoryChunk = typeof sellerAgentMemoryChunksTable.$inferSelect;
export type SellerAgentChat = typeof sellerAgentChatsTable.$inferSelect;
export type SellerAgentMessage = typeof sellerAgentMessagesTable.$inferSelect;
