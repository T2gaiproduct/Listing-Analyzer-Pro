import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  sellermateAgentsTable,
  sellermateAgentToolsTable,
  sellermateMemoryTable,
  sellermateMessagesTable,
  sellermateThreadsTable,
  type SellermateAgent,
} from "@workspace/db";
import {
  AGENT_TOOL_CATALOG,
  SUPPORTED_AGENT_MODELS,
  isValidAgentToolName,
  type AgentToolName,
} from "./agent-registry.js";
import { generateChatCompletion } from "./ai-provider.js";
import {
  invokeMakeAgentWebhook,
  shouldUseMakeForAgent,
} from "./make-agent-client.js";
import {
  ensureWorkspaceDefaultAgents,
  listAgentTools,
  replaceAgentTools,
} from "./workspace-agents.js";

export { AGENT_TOOL_CATALOG, SUPPORTED_AGENT_MODELS };

export async function listSellermateAgents(workspaceId: number): Promise<SellermateAgent[]> {
  await ensureWorkspaceDefaultAgents(workspaceId);

  return db
    .select()
    .from(sellermateAgentsTable)
    .where(and(
      eq(sellermateAgentsTable.workspaceId, workspaceId),
      eq(sellermateAgentsTable.isDeleted, 0),
    ))
    .orderBy(desc(sellermateAgentsTable.isDefault), asc(sellermateAgentsTable.name));
}

export async function getSellermateAgentForWorkspace(
  agentId: number,
  workspaceId: number,
): Promise<SellermateAgent | null> {
  await ensureWorkspaceDefaultAgents(workspaceId);

  const [agent] = await db
    .select()
    .from(sellermateAgentsTable)
    .where(and(
      eq(sellermateAgentsTable.id, agentId),
      eq(sellermateAgentsTable.workspaceId, workspaceId),
      eq(sellermateAgentsTable.isDeleted, 0),
    ))
    .limit(1);

  return agent ?? null;
}

export async function getSellermateAgentTools(agentId: number, workspaceId: number) {
  return listAgentTools(agentId, workspaceId);
}

function normalizeModel(model?: string): string {
  const value = model?.trim() || "gpt-5.4";
  if ((SUPPORTED_AGENT_MODELS as readonly string[]).includes(value)) return value;
  return "gpt-5.4";
}

function normalizeTools(tools?: Array<{ toolName: string; enabled?: boolean; requiresApproval?: boolean }>) {
  if (!tools) return [];
  return tools
    .filter((tool) => isValidAgentToolName(tool.toolName))
    .map((tool) => ({
      toolName: tool.toolName as AgentToolName,
      enabled: tool.enabled !== false,
      requiresApproval: Boolean(tool.requiresApproval),
    }));
}

export async function createSellermateAgent(input: {
  workspaceId: number;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  tools?: Array<{ toolName: string; enabled?: boolean; requiresApproval?: boolean }>;
  executionProvider?: string;
}): Promise<SellermateAgent> {
  const name = input.name.trim();
  const systemPrompt = input.systemPrompt.trim();
  if (!name) throw new Error("Agent name is required.");
  if (!systemPrompt) throw new Error("System instructions are required.");

  const [agent] = await db
    .insert(sellermateAgentsTable)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      name,
      description: input.description?.trim() ?? "",
      systemPrompt,
      icon: "bot",
      model: normalizeModel(input.model),
      status: "active",
      executionProvider: input.executionProvider === "make" ? "make" : "native",
      isDefault: 0,
    })
    .returning();

  if (!agent) throw new Error("Failed to create agent.");

  const tools = normalizeTools(input.tools);
  if (tools.length > 0) {
    await replaceAgentTools({
      agentId: agent.id,
      workspaceId: input.workspaceId,
      tools,
    });
  }

  return agent;
}

export async function duplicateSellermateAgent(input: {
  sourceAgentId: number;
  workspaceId: number;
  userId: string;
  name?: string;
}): Promise<SellermateAgent> {
  const source = await getSellermateAgentForWorkspace(input.sourceAgentId, input.workspaceId);
  if (!source) throw new Error("Agent not found.");

  const name = input.name?.trim() || `${source.name} (copy)`;
  const [agent] = await db
    .insert(sellermateAgentsTable)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      slug: null,
      name,
      description: source.description,
      systemPrompt: source.systemPrompt,
      icon: source.icon,
      model: source.model,
      status: "active",
      executionProvider: source.executionProvider,
      makeAgentId: source.makeAgentId,
      isDefault: 0,
    })
    .returning();

  if (!agent) throw new Error("Failed to duplicate agent.");

  const sourceTools = await listAgentTools(source.id, input.workspaceId);
  if (sourceTools.length > 0) {
    await replaceAgentTools({
      agentId: agent.id,
      workspaceId: input.workspaceId,
      tools: sourceTools.map((tool) => ({
        toolName: tool.toolName as AgentToolName,
        enabled: tool.enabled === 1,
        requiresApproval: tool.requiresApproval === 1,
      })),
    });
  }

  return agent;
}

export async function updateSellermateAgent(input: {
  agentId: number;
  workspaceId: number;
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  tools?: Array<{ toolName: string; enabled?: boolean; requiresApproval?: boolean }>;
}): Promise<SellermateAgent> {
  const agent = await getSellermateAgentForWorkspace(input.agentId, input.workspaceId);
  if (!agent) throw new Error("Agent not found.");
  if (agent.isDefault) throw new Error("Default agents cannot be edited. Duplicate it to customize.");

  const name = input.name !== undefined ? input.name.trim() : agent.name;
  const description = input.description !== undefined ? input.description.trim() : agent.description;
  const systemPrompt = input.systemPrompt !== undefined ? input.systemPrompt.trim() : agent.systemPrompt;
  const model = input.model !== undefined ? normalizeModel(input.model) : agent.model;

  if (!name) throw new Error("Agent name is required.");
  if (!systemPrompt) throw new Error("System instructions are required.");

  const [updated] = await db
    .update(sellermateAgentsTable)
    .set({
      name,
      description,
      systemPrompt,
      model,
      updatedAt: new Date(),
    })
    .where(eq(sellermateAgentsTable.id, input.agentId))
    .returning();

  if (!updated) throw new Error("Failed to update agent.");

  if (input.tools) {
    await replaceAgentTools({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      tools: normalizeTools(input.tools),
    });
  }

  return updated;
}

export async function deleteSellermateAgent(agentId: number, workspaceId: number): Promise<void> {
  const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
  if (!agent) throw new Error("Agent not found.");
  if (agent.isDefault) throw new Error("Default agents cannot be deleted.");

  await db
    .update(sellermateAgentsTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(sellermateAgentsTable.id, agentId));
}

async function loadAgentMemoryContext(agentId: number, workspaceId: number): Promise<string> {
  const rows = await db
    .select({
      name: sellermateMemoryTable.name,
      description: sellermateMemoryTable.description,
      content: sellermateMemoryTable.content,
    })
    .from(sellermateMemoryTable)
    .where(and(
      eq(sellermateMemoryTable.agentId, agentId),
      eq(sellermateMemoryTable.workspaceId, workspaceId),
      eq(sellermateMemoryTable.isDeleted, 0),
    ))
    .orderBy(desc(sellermateMemoryTable.createdAt))
    .limit(20);

  if (rows.length === 0) return "";

  return rows
    .map((row) => {
      const header = row.description?.trim()
        ? `### ${row.name}\n${row.description.trim()}`
        : `### ${row.name}`;
      return `${header}\n${row.content}`;
    })
    .join("\n\n");
}

export async function getOrCreateActiveThread(input: {
  agentId: number;
  workspaceId: number;
  userId: string;
  threadId?: number;
}): Promise<typeof sellermateThreadsTable.$inferSelect> {
  if (input.threadId) {
    const [thread] = await db
      .select()
      .from(sellermateThreadsTable)
      .where(and(
        eq(sellermateThreadsTable.id, input.threadId),
        eq(sellermateThreadsTable.agentId, input.agentId),
        eq(sellermateThreadsTable.workspaceId, input.workspaceId),
        eq(sellermateThreadsTable.userId, input.userId),
        eq(sellermateThreadsTable.isDeleted, 0),
      ))
      .limit(1);
    if (!thread) throw new Error("Chat not found.");
    return thread;
  }

  const [thread] = await db
    .insert(sellermateThreadsTable)
    .values({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      title: "New chat",
    })
    .returning();

  if (!thread) throw new Error("Failed to start chat.");
  return thread;
}

export async function listSellermateThreads(input: {
  agentId: number;
  workspaceId: number;
  userId: string;
}) {
  return db
    .select()
    .from(sellermateThreadsTable)
    .where(and(
      eq(sellermateThreadsTable.agentId, input.agentId),
      eq(sellermateThreadsTable.workspaceId, input.workspaceId),
      eq(sellermateThreadsTable.userId, input.userId),
      eq(sellermateThreadsTable.isDeleted, 0),
    ))
    .orderBy(desc(sellermateThreadsTable.lastMessageAt), desc(sellermateThreadsTable.createdAt));
}

export async function listSellermateMessages(threadId: number) {
  return db
    .select()
    .from(sellermateMessagesTable)
    .where(and(
      eq(sellermateMessagesTable.threadId, threadId),
      eq(sellermateMessagesTable.isDeleted, 0),
    ))
    .orderBy(asc(sellermateMessagesTable.createdAt));
}

async function sendNativeSellermateMessage(input: {
  agent: SellermateAgent;
  workspaceId: number;
  thread: typeof sellermateThreadsTable.$inferSelect;
  message: string;
  mode?: "basic" | "agent";
  history: Awaited<ReturnType<typeof listSellermateMessages>>;
  memoryContext: string;
}): Promise<string> {
  const systemParts = [input.agent.systemPrompt.trim()];
  if (input.memoryContext) {
    systemParts.push(`\n\n## Memory files for this agent\n${input.memoryContext}`);
  }
  if (input.mode === "agent") {
    systemParts.push("\n\nYou may plan multi-step analysis, ask follow-up questions, and suggest automations when helpful.");
  }

  const transcript = input.history
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => `${row.role === "user" ? "User" : "Assistant"}: ${row.content}`)
    .join("\n\n");

  const userPrompt = transcript
    ? `Conversation so far:\n${transcript}\n\nUser: ${input.message}`
    : input.message;

  const chatMessages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemParts.join("") },
    { role: "user", content: userPrompt },
  ];

  const { content: assistantContent } = await generateChatCompletion(chatMessages, {
    maxTokens: input.mode === "agent" ? 2048 : 1024,
    temperature: 0.4,
  });

  return assistantContent.trim() || "I could not generate a response. Please try again.";
}

export async function sendSellermateMessage(input: {
  agent: SellermateAgent;
  workspaceId: number;
  userId: string;
  threadId?: number;
  content: string;
  mode?: "basic" | "agent";
}) {
  const message = input.content.trim();
  if (!message) throw new Error("Message is required.");

  const thread = await getOrCreateActiveThread({
    agentId: input.agent.id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    threadId: input.threadId,
  });

  const history = await listSellermateMessages(thread.id);
  const memoryContext = await loadAgentMemoryContext(input.agent.id, input.workspaceId);

  const [userRow] = await db
    .insert(sellermateMessagesTable)
    .values({ threadId: thread.id, role: "user", content: message })
    .returning();

  let assistantText: string;
  let externalConversationId: string | null = null;

  if (shouldUseMakeForAgent(input.agent.executionProvider)) {
    try {
      const makeResult = await invokeMakeAgentWebhook({
        workspaceId: input.workspaceId,
        agentId: input.agent.id,
        threadId: thread.id,
        conversationId: thread.externalConversationId,
        userId: input.userId,
        message,
        mode: input.mode === "basic" ? "basic" : "agent",
      });
      assistantText = makeResult.response || "I could not generate a response. Please try again.";
      externalConversationId = makeResult.externalConversationId ?? thread.externalConversationId;
    } catch (err) {
      reqLogFallback(err);
      assistantText = await sendNativeSellermateMessage({
        agent: input.agent,
        workspaceId: input.workspaceId,
        thread,
        message,
        mode: input.mode,
        history,
        memoryContext,
      });
    }
  } else {
    assistantText = await sendNativeSellermateMessage({
      agent: input.agent,
      workspaceId: input.workspaceId,
      thread,
      message,
      mode: input.mode,
      history,
      memoryContext,
    });
  }

  const [assistantRow] = await db
    .insert(sellermateMessagesTable)
    .values({
      threadId: thread.id,
      role: "assistant",
      content: assistantText,
    })
    .returning();

  const title = thread.title === "New chat"
    ? message.slice(0, 60) + (message.length > 60 ? "…" : "")
    : thread.title;

  await db
    .update(sellermateThreadsTable)
    .set({
      title,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      ...(externalConversationId ? { externalConversationId } : {}),
    })
    .where(eq(sellermateThreadsTable.id, thread.id));

  return {
    thread: { ...thread, title, externalConversationId: externalConversationId ?? thread.externalConversationId },
    userMessage: userRow!,
    assistantMessage: assistantRow!,
  };
}

function reqLogFallback(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.warn("[sellermate] Make execution failed, falling back to native:", message);
}

export async function listSellermateMemory(agentId: number, workspaceId: number) {
  return db
    .select()
    .from(sellermateMemoryTable)
    .where(and(
      eq(sellermateMemoryTable.agentId, agentId),
      eq(sellermateMemoryTable.workspaceId, workspaceId),
      eq(sellermateMemoryTable.isDeleted, 0),
    ))
    .orderBy(desc(sellermateMemoryTable.createdAt));
}

export async function addSellermateMemory(input: {
  agentId: number;
  workspaceId: number;
  userId: string;
  name: string;
  description?: string;
  content: string;
  memoryKey?: string;
  memoryType?: string;
}) {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const content = input.content.trim();
  if (!name) throw new Error("Memory name is required.");
  if (!content) throw new Error("Memory content is required.");

  const [row] = await db
    .insert(sellermateMemoryTable)
    .values({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      name,
      description,
      content,
      memoryKey: input.memoryKey?.trim() || null,
      memoryType: input.memoryType?.trim() || "file",
    })
    .returning();

  if (!row) throw new Error("Failed to save memory.");
  return row;
}

export async function addSellermateMemoryFromFile(input: {
  agentId: number;
  workspaceId: number;
  userId: string;
  name: string;
  description?: string;
  filename: string;
  buffer: Buffer;
}) {
  const { extractMemoryFileText } = await import("./sellermate-memory-file.js");
  const content = await extractMemoryFileText({
    filename: input.filename,
    buffer: input.buffer,
  });

  return addSellermateMemory({
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    name: input.name,
    description: input.description,
    content,
    memoryType: "file",
  });
}

export async function deleteSellermateMemory(memoryId: number, workspaceId: number): Promise<void> {
  await db
    .update(sellermateMemoryTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(and(
      eq(sellermateMemoryTable.id, memoryId),
      eq(sellermateMemoryTable.workspaceId, workspaceId),
    ));
}

export async function getAgentConfigForMake(agentId: number, workspaceId: number) {
  const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
  if (!agent) return null;
  const tools = await listAgentTools(agentId, workspaceId);
  return { agent, tools };
}
