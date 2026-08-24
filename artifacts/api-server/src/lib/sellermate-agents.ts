import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import {
  db,
  sellermateAgentsTable,
  sellermateMemoryTable,
  sellermateMessagesTable,
  sellermateThreadsTable,
  type SellermateAgent,
} from "@workspace/db";
import { generateChatCompletion } from "./ai-provider.js";

export const DEFAULT_SELLERMATE_AGENTS = [
  {
    slug: "keyword-research",
    name: "Keyword Research",
    description: "Find keywords, search terms, and targeting ideas for your Amazon listings and ads.",
    icon: "search",
    systemPrompt: `You are SellerMate Keyword Research Agent for Amazon sellers.
Help users discover high-intent keywords, analyze search terms, suggest negatives, and explain match types.
Be concise, actionable, and ask clarifying questions when ASIN or campaign context is missing.`,
  },
  {
    slug: "campaign-optimizer",
    name: "Campaign Optimizer",
    description: "Review bids, budgets, ACOS, and campaign structure to improve ad performance.",
    icon: "target",
    systemPrompt: `You are SellerMate Campaign Optimizer for Amazon PPC.
Help users improve ACOS, bids, budgets, placements, and campaign structure.
Give specific recommendations and explain trade-offs. Ask for metrics when needed.`,
  },
  {
    slug: "ads-analyst",
    name: "Ads Analyst",
    description: "Summarize performance trends and explain what changed in your Amazon Ads account.",
    icon: "chart",
    systemPrompt: `You are SellerMate Ads Analyst for Amazon advertising.
Help users understand performance trends, anomalies, and reports in plain language.
Highlight what matters, suggest next steps, and request date ranges or campaign names when unclear.`,
  },
] as const;

export async function ensureDefaultSellermateAgents(): Promise<void> {
  for (const agent of DEFAULT_SELLERMATE_AGENTS) {
    const [existing] = await db
      .select({ id: sellermateAgentsTable.id })
      .from(sellermateAgentsTable)
      .where(and(
        eq(sellermateAgentsTable.slug, agent.slug),
        eq(sellermateAgentsTable.isDefault, 1),
        isNull(sellermateAgentsTable.workspaceId),
        eq(sellermateAgentsTable.isDeleted, 0),
      ))
      .limit(1);

    if (existing) continue;

    await db.insert(sellermateAgentsTable).values({
      workspaceId: null,
      userId: null,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      icon: agent.icon,
      isDefault: 1,
    });
  }
}

export async function listSellermateAgents(workspaceId: number): Promise<SellermateAgent[]> {
  await ensureDefaultSellermateAgents();

  return db
    .select()
    .from(sellermateAgentsTable)
    .where(and(
      eq(sellermateAgentsTable.isDeleted, 0),
      or(
        and(eq(sellermateAgentsTable.isDefault, 1), isNull(sellermateAgentsTable.workspaceId)),
        and(eq(sellermateAgentsTable.workspaceId, workspaceId), eq(sellermateAgentsTable.isDefault, 0)),
      ),
    ))
    .orderBy(desc(sellermateAgentsTable.isDefault), asc(sellermateAgentsTable.name));
}

export async function getSellermateAgentForWorkspace(
  agentId: number,
  workspaceId: number,
): Promise<SellermateAgent | null> {
  await ensureDefaultSellermateAgents();

  const [agent] = await db
    .select()
    .from(sellermateAgentsTable)
    .where(and(
      eq(sellermateAgentsTable.id, agentId),
      eq(sellermateAgentsTable.isDeleted, 0),
      or(
        and(eq(sellermateAgentsTable.isDefault, 1), isNull(sellermateAgentsTable.workspaceId)),
        and(eq(sellermateAgentsTable.workspaceId, workspaceId), eq(sellermateAgentsTable.isDefault, 0)),
      ),
    ))
    .limit(1);

  return agent ?? null;
}

export async function createSellermateAgent(input: {
  workspaceId: number;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
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
      isDefault: 0,
    })
    .returning();

  if (!agent) throw new Error("Failed to create agent.");
  return agent;
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
    .select({ name: sellermateMemoryTable.name, content: sellermateMemoryTable.content })
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
    .map((row) => `### ${row.name}\n${row.content}`)
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

  const systemParts = [input.agent.systemPrompt.trim()];
  if (memoryContext) {
    systemParts.push(`\n\n## Memory files for this agent\n${memoryContext}`);
  }
  if (input.mode === "agent") {
    systemParts.push("\n\nYou may plan multi-step analysis, ask follow-up questions, and suggest automations when helpful.");
  }

  const [userRow] = await db
    .insert(sellermateMessagesTable)
    .values({ threadId: thread.id, role: "user", content: message })
    .returning();

  const transcript = history
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => `${row.role === "user" ? "User" : "Assistant"}: ${row.content}`)
    .join("\n\n");

  const userPrompt = transcript
    ? `Conversation so far:\n${transcript}\n\nUser: ${message}`
    : message;

  const chatMessages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemParts.join("") },
    { role: "user", content: userPrompt },
  ];

  const { content: assistantContent } = await generateChatCompletion(chatMessages, {
    maxTokens: input.mode === "agent" ? 2048 : 1024,
    temperature: 0.4,
  });

  const [assistantRow] = await db
    .insert(sellermateMessagesTable)
    .values({
      threadId: thread.id,
      role: "assistant",
      content: assistantContent.trim() || "I could not generate a response. Please try again.",
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
    })
    .where(eq(sellermateThreadsTable.id, thread.id));

  return {
    thread: { ...thread, title },
    userMessage: userRow!,
    assistantMessage: assistantRow!,
  };
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
  content: string;
}) {
  const name = input.name.trim();
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
      content,
    })
    .returning();

  if (!row) throw new Error("Failed to save memory.");
  return row;
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
