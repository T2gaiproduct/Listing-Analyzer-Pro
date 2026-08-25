import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  AGENT_TOOL_CATALOG,
  SUPPORTED_AGENT_MODELS,
  addSellermateMemory,
  addSellermateMemoryFromFile,
  createSellermateAgent,
  deleteSellermateAgent,
  deleteSellermateMemory,
  duplicateSellermateAgent,
  getSellermateAgentForWorkspace,
  getSellermateAgentTools,
  listSellermateAgents,
  listSellermateMemory,
  listSellermateMessages,
  listSellermateThreads,
  sendSellermateMessage,
  updateSellermateAgent,
} from "../lib/sellermate-agents.js";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceAction,
} from "../lib/workspace-route-helpers.js";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

async function mapAgent(
  agent: Awaited<ReturnType<typeof listSellermateAgents>>[number],
  workspaceId: number,
) {
  const tools = await getSellermateAgentTools(agent.id, workspaceId);
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.isDefault ? undefined : agent.systemPrompt,
    icon: agent.icon,
    model: agent.model,
    executionProvider: agent.executionProvider,
    isDefault: agent.isDefault === 1,
    slug: agent.slug,
    createdAt: agent.createdAt,
    tools: tools.map((tool) => ({
      toolName: tool.toolName,
      enabled: tool.enabled === 1,
      requiresApproval: tool.requiresApproval === 1,
    })),
  };
}

router.get(
  "/sellermate/tools-catalog",
  requireAuth,
  (_req, res) => {
    res.json({
      tools: AGENT_TOOL_CATALOG,
      models: SUPPORTED_AGENT_MODELS,
    });
  },
);

router.get(
  "/sellermate/agents",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    if (!workspaceId) {
      res.status(400).json({ error: "Workspace is required." });
      return;
    }

    try {
      const agents = await listSellermateAgents(workspaceId);
      const mapped = await Promise.all(agents.map((agent) => mapAgent(agent, workspaceId)));
      res.json({ agents: mapped });
    } catch (err) {
      req.log?.error?.({ err }, "List SellerLens AI agents failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load agents." });
    }
  },
);

router.post(
  "/sellermate/agents",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    if (!workspaceId) {
      res.status(400).json({ error: "Workspace is required." });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
      model?: string;
      tools?: Array<{ toolName: string; enabled?: boolean; requiresApproval?: boolean }>;
    };
    try {
      const agent = await createSellermateAgent({
        workspaceId,
        userId,
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        systemPrompt: String(body.systemPrompt ?? ""),
        model: body.model,
        tools: body.tools,
      });
      res.status(201).json({ agent: await mapAgent(agent, workspaceId) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create agent.";
      res.status(400).json({ error: message });
    }
  },
);

router.post(
  "/sellermate/agents/:id/duplicate",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const body = req.body as { name?: string };
    try {
      const agent = await duplicateSellermateAgent({
        sourceAgentId: agentId,
        workspaceId,
        userId,
        name: body.name,
      });
      res.status(201).json({ agent: await mapAgent(agent, workspaceId) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to duplicate agent." });
    }
  },
);

router.patch(
  "/sellermate/agents/:id",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "edit"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
      model?: string;
      tools?: Array<{ toolName: string; enabled?: boolean; requiresApproval?: boolean }>;
    };
    try {
      const agent = await updateSellermateAgent({
        agentId,
        workspaceId,
        name: body.name !== undefined ? String(body.name) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        systemPrompt: body.systemPrompt !== undefined ? String(body.systemPrompt) : undefined,
        model: body.model,
        tools: body.tools,
      });
      res.json({ agent: await mapAgent(agent, workspaceId) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update agent.";
      res.status(400).json({ error: message });
    }
  },
);

router.delete(
  "/sellermate/agents/:id",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "delete"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    try {
      await deleteSellermateAgent(agentId, workspaceId);
      res.status(204).end();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete agent." });
    }
  },
);

router.get(
  "/sellermate/agents/:id/threads",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const threads = await listSellermateThreads({ agentId, workspaceId, userId });
    res.json({ threads });
  },
);

router.get(
  "/sellermate/threads/:threadId/messages",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const threadId = Number(req.params.threadId);
    if (!Number.isFinite(threadId)) {
      res.status(400).json({ error: "Invalid thread." });
      return;
    }

    const messages = await listSellermateMessages(threadId);
    res.json({ messages });
  },
);

router.post(
  "/sellermate/agents/:id/chat",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const body = req.body as {
      message?: string;
      threadId?: number;
      mode?: "basic" | "agent";
      selectedOptionId?: string;
      replyToMessageId?: number;
    };

    const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    try {
      const result = await sendSellermateMessage({
        agent,
        workspaceId,
        userId,
        threadId: typeof body.threadId === "number" ? body.threadId : undefined,
        content: String(body.message ?? ""),
        mode: body.mode === "basic" ? "basic" : "agent",
        selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : undefined,
        replyToMessageId: typeof body.replyToMessageId === "number" ? body.replyToMessageId : undefined,
      });
      res.json(result);
    } catch (err) {
      req.log?.error?.({ err }, "SellerLens AI chat failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Chat failed." });
    }
  },
);

router.get(
  "/sellermate/agents/:id/memory",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const memory = await listSellermateMemory(agentId, workspaceId);
    res.json({ memory });
  },
);

router.post(
  "/sellermate/agents/:id/memory",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const body = req.body as { name?: string; description?: string; content?: string };
    try {
      const row = await addSellermateMemory({
        agentId,
        workspaceId,
        userId,
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        content: String(body.content ?? ""),
      });
      res.status(201).json({ memory: row });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save memory." });
    }
  },
);

router.post(
  "/sellermate/agents/:id/memory/upload",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    const agent = await getSellermateAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string;
      filename?: string;
      fileBase64?: string;
    };

    try {
      const filename = String(body.filename ?? "").trim();
      const fileBase64 = String(body.fileBase64 ?? "").trim();
      if (!filename) {
        res.status(400).json({ error: "Filename is required." });
        return;
      }
      if (!fileBase64) {
        res.status(400).json({ error: "File data is required." });
        return;
      }

      const buffer = Buffer.from(fileBase64, "base64");
      const row = await addSellermateMemoryFromFile({
        agentId,
        workspaceId,
        userId,
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        filename,
        buffer,
      });
      res.status(201).json({ memory: row });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to upload memory file." });
    }
  },
);

router.delete(
  "/sellermate/agents/:agentId/memory/:memoryId",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "delete"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const memoryId = Number(req.params.memoryId);
    if (!workspaceId || !Number.isFinite(memoryId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }

    try {
      await deleteSellermateMemory(memoryId, workspaceId);
      res.status(204).end();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete memory." });
    }
  },
);

export default router;
