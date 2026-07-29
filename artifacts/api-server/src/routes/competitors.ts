import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, competitorsTable } from "@workspace/db";
import {
  AddCompetitorBody,
  AddCompetitorParams,
  ListCompetitorsParams,
  DeleteCompetitorParams,
} from "@workspace/api-zod";
import { analyzeCompetitorWithAI } from "../lib/analyzer";
import { deductCreditsTeamAware, hasCreditsTeamAware, getCreditCost, type TeamAwareContext } from "../lib/credits";
import { type TeamAuthedRequest } from "../middlewares/team-auth";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  requireWorkspaceAction,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
  workspaceOwnerFilter,
} from "../lib/workspace-route-helpers";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as AuthedRequest).userId = userId;
  next();
}

function getCreditCtx(req: Request): TeamAwareContext {
  const team = (req as TeamAuthedRequest).team;
  const userId = (req as AuthedRequest).userId;
  return {
    userId,
    memberId: team?.memberId,
    ownerUserId: team?.ownerUserId,
    isTeamMember: team?.isTeamMember ?? false,
  };
}

async function auditScopeWhere(req: Request, auditId: number) {
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "competitors", worked, "audit", auditsTable);
  return and(
    eq(auditsTable.id, auditId),
    workspaceOwnerFilter(auditsTable, auditsTable, ownerId, workspaceId),
    eq(auditsTable.isDeleted, 0),
    ownFilter,
  );
}

router.get("/audits/:id/competitors", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const params = ListCompetitorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(await auditScopeWhere(req, params.data.id));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(and(eq(competitorsTable.auditId, params.data.id), eq(competitorsTable.isDeleted, 0)));

  res.json(competitors.map(c => ({ ...c, weaknesses: c.weaknesses ?? [] })));
});

router.post("/audits/:id/competitors", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("competitors", "create"), async (req, res): Promise<void> => {
  const params = AddCompetitorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCompetitorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = await getCreditCost("competitors");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(await auditScopeWhere(req, params.data.id));

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const { productName, asin, title, bulletPoints, imageCount, targetKeywords } = parsed.data;

  await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "competitors", { auditId: params.data.id });

  const analysis = await analyzeCompetitorWithAI({
    productName,
    title,
    bulletPoints,
    imageCount,
    targetKeywords,
    ourTitle: audit.title,
    ourBullets: audit.bulletPoints,
  });

  const [competitor] = await db
    .insert(competitorsTable)
    .values({
      auditId: params.data.id,
      productName,
      asin: asin ?? null,
      title,
      bulletPoints,
      imageCount,
      targetKeywords,
      overallScore: analysis.overallScore,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
    })
    .returning();

  res.status(201).json({ ...competitor, weaknesses: competitor.weaknesses ?? [] });
});

router.delete("/competitors/:id", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("competitors", "delete"), async (req, res): Promise<void> => {
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const params = DeleteCompetitorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [owned] = await db
    .select({ id: competitorsTable.id })
    .from(competitorsTable)
    .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
    .where(and(
      eq(competitorsTable.id, params.data.id),
      eq(auditsTable.userId, ownerId),
      eq(auditsTable.workspaceId, workspaceId),
      eq(competitorsTable.isDeleted, 0),
      eq(auditsTable.isDeleted, 0),
    ))
    .limit(1);

  if (!owned) {
    res.status(404).json({ error: "Competitor not found" });
    return;
  }

  await db
    .update(competitorsTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(eq(competitorsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
