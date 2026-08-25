import { and, eq } from "drizzle-orm";
import { db, sellermateMemoryTable } from "@workspace/db";
import type { AgentToolName } from "./agent-registry.js";
import { fetchListing } from "./listing-fetcher.js";
import { analyzeListingWithAI } from "./analyzer.js";
import { listSellermateMemory } from "./sellermate-agents.js";

export type AgentToolContext = {
  workspaceId: number;
  agentId: number;
  userId: string;
};

export async function executeSellermateAgentTool(
  toolName: AgentToolName,
  args: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<string> {
  switch (toolName) {
    case "get_seller_memory": {
      const rows = await listSellermateMemory(ctx.agentId, ctx.workspaceId);
      if (rows.length === 0) {
        return JSON.stringify({ memory: [], note: "No memory files uploaded for this agent." });
      }

      const memoryKey = typeof args.memoryKey === "string" ? args.memoryKey.trim() : "";
      const filtered = memoryKey
        ? rows.filter((row) => row.memoryKey === memoryKey || row.name === memoryKey)
        : rows;

      return JSON.stringify({
        memory: filtered.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          memoryKey: row.memoryKey,
          memoryType: row.memoryType,
          content: row.content,
        })),
      });
    }

    case "get_amazon_listing": {
      const asin = typeof args.asin === "string" ? args.asin : undefined;
      const url = typeof args.url === "string" ? args.url : undefined;
      if (!asin && !url) {
        return JSON.stringify({ error: "asin or url is required." });
      }
      const listing = await fetchListing({ asin, url });
      return JSON.stringify({ listing });
    }

    case "audit_listing": {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) {
        return JSON.stringify({ error: "title is required." });
      }
      const result = await analyzeListingWithAI({
        title,
        bulletPoints: Array.isArray(args.bulletPoints) ? args.bulletPoints.map(String) : [],
        imageUrls: Array.isArray(args.imageUrls) ? args.imageUrls.map(String) : [],
        targetKeywords: Array.isArray(args.targetKeywords) ? args.targetKeywords.map(String) : [],
        category: typeof args.category === "string" ? args.category : undefined,
      });
      return JSON.stringify({ result });
    }

    case "save_agent_memory": {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      const content = typeof args.content === "string" ? args.content.trim() : "";
      if (!name || !content) {
        return JSON.stringify({ error: "name and content are required." });
      }

      const memoryKey = typeof args.memoryKey === "string" ? args.memoryKey.trim() || null : null;
      const memoryType = typeof args.memoryType === "string" ? args.memoryType.trim() || "preference" : "preference";
      const description = typeof args.description === "string" ? args.description.trim() : "";

      if (memoryKey) {
        const [existing] = await db
          .select({ id: sellermateMemoryTable.id })
          .from(sellermateMemoryTable)
          .where(and(
            eq(sellermateMemoryTable.agentId, ctx.agentId),
            eq(sellermateMemoryTable.workspaceId, ctx.workspaceId),
            eq(sellermateMemoryTable.memoryKey, memoryKey),
            eq(sellermateMemoryTable.isDeleted, 0),
          ))
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(sellermateMemoryTable)
            .set({ name, description, content, memoryType })
            .where(eq(sellermateMemoryTable.id, existing.id))
            .returning();
          return JSON.stringify({ memory: updated });
        }
      }

      const [created] = await db
        .insert(sellermateMemoryTable)
        .values({
          agentId: ctx.agentId,
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          name,
          description,
          content,
          memoryKey,
          memoryType,
        })
        .returning();

      return JSON.stringify({ memory: created });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
