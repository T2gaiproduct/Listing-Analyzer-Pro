import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, auditsTable, competitorsTable } from "@workspace/db";
import {
  AddCompetitorBody,
  AddCompetitorParams,
  ListCompetitorsParams,
  DeleteCompetitorParams,
} from "@workspace/api-zod";
import { analyzeCompetitorWithAI } from "../lib/analyzer";

const router: IRouter = Router();

router.get("/audits/:id/competitors", async (req, res): Promise<void> => {
  const params = ListCompetitorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(eq(competitorsTable.auditId, params.data.id));

  res.json(competitors.map(c => ({ ...c, weaknesses: c.weaknesses ?? [] })));
});

router.post("/audits/:id/competitors", async (req, res): Promise<void> => {
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

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(eq(auditsTable.id, params.data.id));

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const { productName, asin, title, bulletPoints, imageCount, targetKeywords } = parsed.data;

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

router.delete("/competitors/:id", async (req, res): Promise<void> => {
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
