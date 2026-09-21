import { and, eq } from "drizzle-orm";
import { db, sellermateAgentsTable, sellermateMemoryTable } from "@workspace/db";
import type { AgentToolName } from "./agent-registry.js";
import { fetchListing } from "./listing-fetcher.js";
import { analyzeListingWithAI } from "./analyzer.js";
import { listSellermateMemory } from "./sellermate-agents.js";
import { isAgentToolEnabled } from "./workspace-agents.js";
import type { TeamAwareContext } from "./credits.js";
import { generateSellermateImageVariants } from "./sellermate-image-variants.js";

export type AgentToolContext = {
  workspaceId: number;
  agentId: number;
  userId: string;
  creditCtx: TeamAwareContext;
};

export async function executeSellermateAgentTool(
  toolName: AgentToolName,
  args: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<string> {
  const enabled = await isAgentToolEnabled(ctx.agentId, ctx.workspaceId, toolName);
  if (!enabled) {
    return JSON.stringify({ error: `Tool "${toolName}" is disabled for this agent.` });
  }

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

    case "generate_image_variants": {
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      const countRaw = typeof args.count === "number" ? args.count : Number(args.count);
      const count = Number.isFinite(countRaw) ? countRaw : undefined;
      if (!prompt) {
        return JSON.stringify({ error: "prompt is required (describe the product and desired listing image)." });
      }
      try {
        const { variants, creditsUsed } = await generateSellermateImageVariants({
          workspaceId: ctx.workspaceId,
          creditCtx: ctx.creditCtx,
          prompt,
          count,
        });
        return JSON.stringify({
          variants,
          creditsUsed,
          instruction:
            "Set phase to presenting_options with ids ex1–ex3 matching variants. Ask the user to pick the image that looks best.",
        });
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "Image generation failed.",
        });
      }
    }

    case "save_agent_memory": {
      const [agent] = await db
        .select()
        .from(sellermateAgentsTable)
        .where(and(
          eq(sellermateAgentsTable.id, ctx.agentId),
          eq(sellermateAgentsTable.workspaceId, ctx.workspaceId),
          eq(sellermateAgentsTable.isDeleted, 0),
        ))
        .limit(1);

      if (!agent) {
        return JSON.stringify({ error: "Agent not found." });
      }
      if (agent.isDefault) {
        return JSON.stringify({ error: "Default agent memory is read-only." });
      }

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
