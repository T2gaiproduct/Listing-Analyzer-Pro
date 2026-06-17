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
import { deductCredits, hasCredits, getCreditCost, deductCreditsTeamAware, hasCreditsTeamAware, type TeamAwareContext } from "../lib/credits";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import { createNotification } from "../lib/notifications";

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

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const team = (req as TeamAuthedRequest).team;
  if (!team) { res.status(401).json({ error: "Team context not resolved" }); return; }
  if (team.role === "viewer") { res.status(403).json({ error: "Forbidden: viewers cannot modify data" }); return; }
  next();
}

function getEffectiveUserId(req: Request): string {
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
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

router.get("/audits/:id/competitors", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const params = ListCompetitorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
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

router.post("/audits/:id/competitors", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
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
    .where(and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, ownerId)));

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

  await createNotification({
    userId: ownerId,
    type: "competitor_complete",
    title: "Competitor Analysis Complete",
    message: `Competitor analysis for "${productName}" is ready. Overall score: ${analysis.overallScore}.`,
    link: `/audits/${params.data.id}`,
  });

  res.status(201).json({ ...competitor, weaknesses: competitor.weaknesses ?? [] });
});

router.delete("/competitors/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const params = DeleteCompetitorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [competitor] = await db
    .update(competitorsTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(eq(competitorsTable.id, params.data.id))
    .returning();

  if (!competitor) {
    res.status(404).json({ error: "Competitor not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
