import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, sellermateMemoryTable } from "@workspace/db";
import { fetchListing } from "../lib/listing-fetcher.js";
import { analyzeListingWithAI } from "../lib/analyzer.js";
import {
  getSellermateAgentForWorkspace,
  listSellermateMemory,
} from "../lib/sellermate-agents.js";
import { listAgentTools } from "../lib/workspace-agents.js";
import { AGENT_TOOL_CATALOG } from "../lib/agent-registry.js";

const router: IRouter = Router();

function requireMakeToolSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.MAKE_TOOL_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "Make tool APIs are not configured." });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = String(req.headers["x-make-tool-secret"] ?? "").trim();
  const provided = bearer || headerSecret;

  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

router.use(requireMakeToolSecret);

router.get("/agent-tools/catalog", (_req, res) => {
  res.json({ tools: AGENT_TOOL_CATALOG });
});

router.get("/agent-tools/agent-config", async (req, res): Promise<void> => {
  const workspaceId = Number(req.query.workspaceId);
  const agentId = Number(req.query.agentId);
  if (!Number.isFinite(workspaceId) || !Number.isFinite(agentId)) {
    res.status(400).json({ error: "workspaceId and agentId are required." });
    return;
  }

  const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }

  const tools = await listAgentTools(agentId, workspaceId);
  res.json({
    agent: {
      id: agent.id,
      workspaceId: agent.workspaceId,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      executionProvider: agent.executionProvider,
      makeAgentId: agent.makeAgentId,
      isDefault: agent.isDefault === 1,
    },
    tools: tools.map((tool) => ({
      name: tool.toolName,
      enabled: tool.enabled === 1,
      requiresApproval: tool.requiresApproval === 1,
    })),
  });
});

router.post("/agent-tools/get-seller-memory", async (req, res): Promise<void> => {
  const body = req.body as {
    workspaceId?: number;
    agentId?: number;
    memoryKey?: string;
  };

  const workspaceId = Number(body.workspaceId);
  const agentId = Number(body.agentId);
  if (!Number.isFinite(workspaceId) || !Number.isFinite(agentId)) {
    res.status(400).json({ error: "workspaceId and agentId are required." });
    return;
  }

  const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }

  const rows = await listSellermateMemory(agentId, workspaceId);
  const memoryKey = body.memoryKey?.trim();
  const filtered = memoryKey
    ? rows.filter((row) => row.memoryKey === memoryKey || row.name === memoryKey)
    : rows;

  res.json({
    memory: filtered.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      memoryKey: row.memoryKey,
      memoryType: row.memoryType,
      content: row.content,
      createdAt: row.createdAt,
    })),
  });
});

router.post("/agent-tools/get-amazon-listing", async (req, res): Promise<void> => {
  const body = req.body as { asin?: string; url?: string };
  if (!body.asin && !body.url) {
    res.status(400).json({ error: "asin or url is required." });
    return;
  }

  try {
    const listing = await fetchListing({ asin: body.asin, url: body.url });
    res.json({ listing });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to fetch listing." });
  }
});

router.post("/agent-tools/audit-listing", async (req, res): Promise<void> => {
  const body = req.body as {
    title?: string;
    bulletPoints?: string[];
    imageUrls?: string[];
    targetKeywords?: string[];
    category?: string;
  };

  const title = body.title?.trim();
  if (!title) {
    res.status(400).json({ error: "title is required." });
    return;
  }

  try {
    const result = await analyzeListingWithAI({
      title,
      bulletPoints: body.bulletPoints ?? [],
      imageUrls: body.imageUrls ?? [],
      targetKeywords: body.targetKeywords ?? [],
      category: body.category,
    });
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Audit failed." });
  }
});

router.post("/agent-tools/save-agent-memory", async (req, res): Promise<void> => {
  const body = req.body as {
    workspaceId?: number;
    agentId?: number;
    userId?: string;
    name?: string;
    description?: string;
    content?: string;
    memoryKey?: string;
    memoryType?: string;
  };

  const workspaceId = Number(body.workspaceId);
  const agentId = Number(body.agentId);
  const userId = String(body.userId ?? "make-agent");
  const name = String(body.name ?? "").trim();
  const content = String(body.content ?? "").trim();

  if (!Number.isFinite(workspaceId) || !Number.isFinite(agentId)) {
    res.status(400).json({ error: "workspaceId and agentId are required." });
    return;
  }
  if (!name || !content) {
    res.status(400).json({ error: "name and content are required." });
    return;
  }

  const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }

  const memoryKey = body.memoryKey?.trim() || null;
  const memoryType = body.memoryType?.trim() || "preference";

  if (memoryKey) {
    const [existing] = await db
      .select({ id: sellermateMemoryTable.id })
      .from(sellermateMemoryTable)
      .where(and(
        eq(sellermateMemoryTable.agentId, agentId),
        eq(sellermateMemoryTable.workspaceId, workspaceId),
        eq(sellermateMemoryTable.memoryKey, memoryKey),
        eq(sellermateMemoryTable.isDeleted, 0),
      ))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(sellermateMemoryTable)
        .set({
          name,
          description: String(body.description ?? "").trim(),
          content,
          memoryType,
        })
        .where(eq(sellermateMemoryTable.id, existing.id))
        .returning();

      res.json({ memory: updated });
      return;
    }
  }

  const [created] = await db
    .insert(sellermateMemoryTable)
    .values({
      agentId,
      workspaceId,
      userId,
      name,
      description: String(body.description ?? "").trim(),
      content,
      memoryKey,
      memoryType,
    })
    .returning();

  res.status(201).json({ memory: created });
});

export default router;
