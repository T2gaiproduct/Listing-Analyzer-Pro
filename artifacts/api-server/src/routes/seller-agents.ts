import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  sellerAgentChatsTable,
  sellerAgentMemoryFilesTable,
  sellerAgentMessagesTable,
  sellerAgentsTable,
} from "@workspace/db";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny,
  buildTeamAwareCreditCtx,
} from "../lib/workspace-route-helpers.js";
import { deductCreditsTeamAware, getCreditCost, hasCreditsTeamAware } from "../lib/credits.js";
import { ensureDefaultSellerAgentsForWorkspace } from "../lib/seller-agent-seed.js";
import {
  DEFAULT_SELLER_AGENT_TEMPLATES,
  SELLER_AGENT_SKILL_LABELS,
} from "../lib/seller-agent-defaults.js";
import {
  indexWorkspaceListingsForAgent,
  ingestMemoryText,
  loadAgentForWorkspace,
  runSellerAgentChat,
} from "../lib/seller-agent-orchestrator.js";

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

function serializeAgent(agent: typeof sellerAgentsTable.$inferSelect) {
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    icon: agent.icon,
    isDefault: Boolean(agent.isDefault),
    isPlatformTemplate: Boolean(agent.isPlatformTemplate),
    mode: agent.mode,
    enabledSkills: agent.enabledSkills ?? [],
    learnFromWorkspace: Boolean(agent.learnFromWorkspace),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

router.get(
  "/seller-agents/meta",
  requireAuth,
  resolveTeamAndWorkspace,
  (_req, res) => {
    res.json({
      defaultTemplates: DEFAULT_SELLER_AGENT_TEMPLATES,
      skillLabels: SELLER_AGENT_SKILL_LABELS,
    });
  },
);

router.get(
  "/seller-agents",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    if (!workspaceId) {
      res.status(400).json({ error: "Active workspace required." });
      return;
    }

    await ensureDefaultSellerAgentsForWorkspace(workspaceId, userId);

    const agents = await db
      .select()
      .from(sellerAgentsTable)
      .where(and(
        eq(sellerAgentsTable.workspaceId, workspaceId),
        eq(sellerAgentsTable.isDeleted, 0),
      ))
      .orderBy(desc(sellerAgentsTable.isDefault), desc(sellerAgentsTable.updatedAt));

    res.json({ agents: agents.map(serializeAgent) });
  },
);

router.post(
  "/seller-agents",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    if (!workspaceId) {
      res.status(400).json({ error: "Active workspace required." });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string;
      instructions?: string;
      icon?: string;
      mode?: string;
      enabledSkills?: string[];
    };

    const name = body.name?.trim();
    const instructions = body.instructions?.trim();
    if (!name || !instructions) {
      res.status(400).json({ error: "Agent name and instructions are required." });
      return;
    }

    const [agent] = await db
      .insert(sellerAgentsTable)
      .values({
        workspaceId,
        userId,
        name,
        description: body.description?.trim() || null,
        instructions,
        icon: body.icon?.trim() || "bot",
        mode: body.mode === "agent" ? "agent" : "basic",
        enabledSkills: Array.isArray(body.enabledSkills) ? body.enabledSkills : [],
        isDefault: 0,
        isPlatformTemplate: 0,
      })
      .returning();

    res.status(201).json({ agent: serializeAgent(agent!) });
  },
);

router.patch(
  "/seller-agents/:id",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "edit"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string;
      instructions?: string;
      icon?: string;
      mode?: string;
      enabledSkills?: string[];
      learnFromWorkspace?: boolean;
    };

    const [updated] = await db
      .update(sellerAgentsTable)
      .set({
        name: body.name?.trim() || agent.name,
        description: body.description !== undefined ? (body.description.trim() || null) : agent.description,
        instructions: body.instructions?.trim() || agent.instructions,
        icon: body.icon?.trim() || agent.icon,
        mode: body.mode === "agent" ? "agent" : body.mode === "basic" ? "basic" : agent.mode,
        enabledSkills: Array.isArray(body.enabledSkills) ? body.enabledSkills : agent.enabledSkills,
        learnFromWorkspace: body.learnFromWorkspace === undefined
          ? agent.learnFromWorkspace
          : body.learnFromWorkspace ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(sellerAgentsTable.id, agentId))
      .returning();

    res.json({ agent: serializeAgent(updated!) });
  },
);

router.delete(
  "/seller-agents/:id",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "delete"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    if (agent.isPlatformTemplate) {
      res.status(400).json({ error: "Default platform agents cannot be deleted. Clone it to customize instead." });
      return;
    }

    await db
      .update(sellerAgentsTable)
      .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellerAgentsTable.id, agentId));

    res.json({ ok: true });
  },
);

router.post(
  "/seller-agents/:id/clone",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const [clone] = await db
      .insert(sellerAgentsTable)
      .values({
        workspaceId,
        userId,
        name: `${agent.name} (Copy)`,
        description: agent.description,
        instructions: agent.instructions,
        icon: agent.icon,
        mode: agent.mode,
        enabledSkills: agent.enabledSkills ?? [],
        learnFromWorkspace: agent.learnFromWorkspace,
        isDefault: 0,
        isPlatformTemplate: 0,
      })
      .returning();

    res.status(201).json({ agent: serializeAgent(clone!) });
  },
);

router.get(
  "/seller-agents/:id/chats",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const chats = await db
      .select()
      .from(sellerAgentChatsTable)
      .where(and(
        eq(sellerAgentChatsTable.agentId, agentId),
        eq(sellerAgentChatsTable.workspaceId, workspaceId),
        eq(sellerAgentChatsTable.isDeleted, 0),
      ))
      .orderBy(desc(sellerAgentChatsTable.updatedAt));

    res.json({ chats });
  },
);

router.post(
  "/seller-agents/:id/chats",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const userId = (req as AuthedRequest).userId;
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const title = typeof (req.body as { title?: string }).title === "string"
      ? (req.body as { title?: string }).title!.trim() || "New chat"
      : "New chat";

    const [chat] = await db
      .insert(sellerAgentChatsTable)
      .values({
        agentId,
        workspaceId,
        userId,
        title,
      })
      .returning();

    res.status(201).json({ chat });
  },
);

router.get(
  "/seller-agents/:id/chats/:chatId/messages",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    const chatId = Number(req.params.chatId);
    if (!workspaceId || !Number.isFinite(agentId) || !Number.isFinite(chatId)) {
      res.status(400).json({ error: "Invalid chat." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const [chat] = await db
      .select()
      .from(sellerAgentChatsTable)
      .where(and(
        eq(sellerAgentChatsTable.id, chatId),
        eq(sellerAgentChatsTable.agentId, agentId),
        eq(sellerAgentChatsTable.workspaceId, workspaceId),
        eq(sellerAgentChatsTable.isDeleted, 0),
      ))
      .limit(1);

    if (!chat) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    const messages = await db
      .select()
      .from(sellerAgentMessagesTable)
      .where(eq(sellerAgentMessagesTable.chatId, chatId))
      .orderBy(sellerAgentMessagesTable.id);

    res.json({ messages });
  },
);

router.post(
  "/seller-agents/:id/chats/:chatId/messages",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    const chatId = Number(req.params.chatId);
    const userId = (req as AuthedRequest).userId;

    if (!workspaceId || !Number.isFinite(agentId) || !Number.isFinite(chatId)) {
      res.status(400).json({ error: "Invalid chat." });
      return;
    }

    const content = typeof (req.body as { content?: string }).content === "string"
      ? (req.body as { content?: string }).content!.trim()
      : "";
    if (!content) {
      res.status(400).json({ error: "Message content is required." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const [chat] = await db
      .select()
      .from(sellerAgentChatsTable)
      .where(and(
        eq(sellerAgentChatsTable.id, chatId),
        eq(sellerAgentChatsTable.agentId, agentId),
        eq(sellerAgentChatsTable.workspaceId, workspaceId),
        eq(sellerAgentChatsTable.isDeleted, 0),
      ))
      .limit(1);

    if (!chat) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    const creditCtx = buildTeamAwareCreditCtx(req);
    const cost = await getCreditCost("agents");
    const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
    if (!creditCheck.hasCredits) {
      res.status(402).json({
        error: "Insufficient credits for agent chat.",
        needed: creditCheck.needed,
        currentBalance: creditCheck.currentBalance,
      });
      return;
    }

    const [userMessage] = await db
      .insert(sellerAgentMessagesTable)
      .values({
        chatId,
        agentId,
        role: "user",
        content,
      })
      .returning();

    try {
      const { assistantMessage } = await runSellerAgentChat({
        agent,
        chatId,
        userMessage: content,
      });

      const [assistantRow] = await db
        .insert(sellerAgentMessagesTable)
        .values({
          chatId,
          agentId,
          role: "assistant",
          content: assistantMessage,
        })
        .returning();

      await db
        .update(sellerAgentChatsTable)
        .set({
          updatedAt: new Date(),
          title: chat.title === "New chat" ? content.slice(0, 60) : chat.title,
        })
        .where(eq(sellerAgentChatsTable.id, chatId));

      await deductCreditsTeamAware(creditCtx, {
        creditType: cost.creditType,
        amount: cost.creditsRequired,
        description: `Seller agent: ${agent.name}`,
        metadata: { agentId, chatId, featureType: "agents" },
      });

      res.status(201).json({
        userMessage,
        assistantMessage: assistantRow,
      });
    } catch (err) {
      req.log?.error?.({ err, agentId, chatId }, "seller agent chat failed");
      res.status(500).json({
        error: err instanceof Error ? err.message : "Agent chat failed.",
        userMessage,
      });
    }
  },
);

router.get(
  "/seller-agents/:id/memory-files",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const files = await db
      .select()
      .from(sellerAgentMemoryFilesTable)
      .where(and(
        eq(sellerAgentMemoryFilesTable.agentId, agentId),
        eq(sellerAgentMemoryFilesTable.workspaceId, workspaceId),
        eq(sellerAgentMemoryFilesTable.isDeleted, 0),
      ))
      .orderBy(desc(sellerAgentMemoryFilesTable.createdAt));

    res.json({ files });
  },
);

router.post(
  "/seller-agents/:id/memory-files",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    const body = req.body as { fileName?: string; content?: string; mimeType?: string };
    const fileName = body.fileName?.trim();
    const content = body.content?.trim();
    if (!fileName || !content) {
      res.status(400).json({ error: "fileName and content are required." });
      return;
    }

    try {
      const result = await ingestMemoryText({
        agentId,
        workspaceId,
        fileName,
        content,
        mimeType: body.mimeType,
        source: "upload",
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not save memory file." });
    }
  },
);

router.post(
  "/seller-agents/:id/memory-files/index-workspace",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "create"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    if (!workspaceId || !Number.isFinite(agentId)) {
      res.status(400).json({ error: "Invalid agent." });
      return;
    }

    const agent = await loadAgentForWorkspace(agentId, workspaceId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found." });
      return;
    }

    try {
      const result = await indexWorkspaceListingsForAgent({ agentId, workspaceId });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not index workspace listings." });
    }
  },
);

router.delete(
  "/seller-agents/:id/memory-files/:fileId",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["audits", "build_brand"], "delete"),
  async (req, res): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const agentId = Number(req.params.id);
    const fileId = Number(req.params.fileId);
    if (!workspaceId || !Number.isFinite(agentId) || !Number.isFinite(fileId)) {
      res.status(400).json({ error: "Invalid memory file." });
      return;
    }

    await db
      .update(sellerAgentMemoryFilesTable)
      .set({ isDeleted: 1, deletedAt: new Date() })
      .where(and(
        eq(sellerAgentMemoryFilesTable.id, fileId),
        eq(sellerAgentMemoryFilesTable.agentId, agentId),
        eq(sellerAgentMemoryFilesTable.workspaceId, workspaceId),
      ));

    res.json({ ok: true });
  },
);

export default router;
