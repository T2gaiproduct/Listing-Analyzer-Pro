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
import { deductCredits, hasCredits, getCreditCost } from "../lib/credits";

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

router.get("/audits/:id/competitors", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = ListCompetitorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, userId)));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(eq(competitorsTable.auditId, params.data.id));

  res.json(competitors.map(c => ({ ...c, weaknesses: c.weaknesses ?? [] })));
});

router.post("/audits/:id/competitors", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
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
  const creditCheck = await hasCredits(userId, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, userId)));

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const { productName, asin, title, bulletPoints, imageCount, targetKeywords } = parsed.data;

  await deductCredits(userId, cost.creditType, cost.creditsRequired, cost.activityName, "competitors", { auditId: params.data.id });

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

router.delete("/competitors/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCompetitorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [competitor] = await db
    .delete(competitorsTable)
    .where(eq(competitorsTable.id, params.data.id))
    .returning();

  if (!competitor) {
    res.status(404).json({ error: "Competitor not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
