import { and, desc, eq } from "drizzle-orm";
import {
  auditsTable,
  db,
  productProfilesTable,
  sellerAgentMemoryChunksTable,
  sellerAgentMemoryFilesTable,
  sellerAgentMessagesTable,
  sellerAgentsTable,
  type SellerAgent,
} from "@workspace/db";
import { generateChatCompletion } from "./ai-provider.js";
import { chunkText, selectTopChunks } from "./seller-agent-memory.js";

const MAX_HISTORY_MESSAGES = 12;
const MAX_MEMORY_FILE_BYTES = 120_000;

export async function loadAgentForWorkspace(agentId: number, workspaceId: number): Promise<SellerAgent | null> {
  const [agent] = await db
    .select()
    .from(sellerAgentsTable)
    .where(and(
      eq(sellerAgentsTable.id, agentId),
      eq(sellerAgentsTable.workspaceId, workspaceId),
      eq(sellerAgentsTable.isDeleted, 0),
    ))
    .limit(1);
  return agent ?? null;
}

export async function ingestMemoryText(input: {
  agentId: number;
  workspaceId: number;
  fileName: string;
  content: string;
  source?: string;
  mimeType?: string;
}): Promise<{ fileId: number; chunkCount: number }> {
  const content = input.content.trim();
  if (!content) throw new Error("Memory file content is empty.");
  if (Buffer.byteLength(content, "utf8") > MAX_MEMORY_FILE_BYTES) {
    throw new Error("Memory file is too large (max 120KB for now).");
  }

  const chunks = chunkText(content);
  if (chunks.length === 0) throw new Error("Could not extract text from memory file.");

  const [file] = await db
    .insert(sellerAgentMemoryFilesTable)
    .values({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      fileName: input.fileName,
      mimeType: input.mimeType ?? "text/plain",
      byteSize: Buffer.byteLength(content, "utf8"),
      source: input.source ?? "upload",
    })
    .returning();

  await db.insert(sellerAgentMemoryChunksTable).values(
    chunks.map((chunk) => ({
      agentId: input.agentId,
      memoryFileId: file!.id,
      workspaceId: input.workspaceId,
      content: chunk,
      metadata: { fileName: input.fileName },
    })),
  );

  return { fileId: file!.id, chunkCount: chunks.length };
}

export async function indexWorkspaceListingsForAgent(input: {
  agentId: number;
  workspaceId: number;
}): Promise<{ chunkCount: number }> {
  const rows = await db
    .select({
      id: auditsTable.id,
      title: auditsTable.title,
      asin: auditsTable.asin,
      result: auditsTable.result,
      sku: productProfilesTable.sku,
    })
    .from(auditsTable)
    .leftJoin(productProfilesTable, eq(productProfilesTable.auditId, auditsTable.id))
    .where(and(
      eq(auditsTable.workspaceId, input.workspaceId),
      eq(auditsTable.isDeleted, 0),
    ))
    .orderBy(desc(auditsTable.updatedAt))
    .limit(80);

  if (rows.length === 0) {
    throw new Error("No workspace listings found to index. Import products or create audits first.");
  }

  const lines = rows.map((row) => {
    const score = typeof row.result === "object" && row.result && "overallScore" in row.result
      ? String((row.result as { overallScore?: number }).overallScore ?? "")
      : "";
    return [
      `SKU: ${row.sku ?? "n/a"}`,
      `ASIN: ${row.asin ?? "n/a"}`,
      `Title: ${row.title ?? "Untitled"}`,
      score ? `Audit score: ${score}` : null,
    ].filter(Boolean).join(" | ");
  });

  const content = lines.join("\n");
  const result = await ingestMemoryText({
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    fileName: `workspace-catalog-${new Date().toISOString().slice(0, 10)}.txt`,
    content,
    source: "workspace",
    mimeType: "text/plain",
  });

  return { chunkCount: result.chunkCount };
}

async function retrieveAgentContext(agent: SellerAgent, query: string): Promise<string> {
  const chunks = await db
    .select({ id: sellerAgentMemoryChunksTable.id, content: sellerAgentMemoryChunksTable.content })
    .from(sellerAgentMemoryChunksTable)
    .where(and(
      eq(sellerAgentMemoryChunksTable.agentId, agent.id),
      eq(sellerAgentMemoryChunksTable.workspaceId, agent.workspaceId),
    ));

  const selected = selectTopChunks(query, chunks, 6);
  if (selected.length === 0) return "";

  return selected
    .map((chunk, index) => `[Memory ${index + 1}]\n${chunk.content}`)
    .join("\n\n");
}

export async function runSellerAgentChat(input: {
  agent: SellerAgent;
  chatId: number;
  userMessage: string;
}): Promise<{ assistantMessage: string }> {
  const history = await db
    .select()
    .from(sellerAgentMessagesTable)
    .where(eq(sellerAgentMessagesTable.chatId, input.chatId))
    .orderBy(desc(sellerAgentMessagesTable.id))
    .limit(MAX_HISTORY_MESSAGES);

  const memoryContext = await retrieveAgentContext(input.agent, input.userMessage);

  const systemParts = [
    input.agent.instructions.trim(),
    input.agent.mode === "agent"
      ? `Enabled skills: ${(input.agent.enabledSkills ?? []).join(", ") || "none"}.`
      : "You are in Basic mode. Answer directly without calling external tools.",
    memoryContext
      ? `Use the following agent memory when relevant:\n\n${memoryContext}`
      : "No relevant memory files matched this question yet.",
    "If memory is insufficient, say what data the seller should upload to Memory Files.",
  ];

  const transcript = [...history]
    .reverse()
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const userPrompt = transcript
    ? `${transcript}\n\nUSER: ${input.userMessage}`
    : input.userMessage;

  const completion = await generateChatCompletion(
    [
      { role: "system", content: systemParts.join("\n\n") },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 2048, temperature: 0.5 },
  );

  return { assistantMessage: completion.content.trim() || "I could not generate a response. Please try again." };
}
