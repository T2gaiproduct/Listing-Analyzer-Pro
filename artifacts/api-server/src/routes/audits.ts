import { Router, type IRouter } from "express";
import { eq, avg, count, sql } from "drizzle-orm";
import { db, auditsTable, competitorsTable } from "@workspace/db";
import {
  CreateAuditBody,
  GetAuditParams,
  DeleteAuditParams,
} from "@workspace/api-zod";
import { analyzeListingWithAI } from "../lib/analyzer";

const router: IRouter = Router();

router.get("/audits", async (_req, res): Promise<void> => {
  const audits = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      asin: auditsTable.asin,
      category: auditsTable.category,
      overallScore: auditsTable.overallScore,
      status: auditsTable.status,
      createdAt: auditsTable.createdAt,
      updatedAt: auditsTable.updatedAt,
    })
    .from(auditsTable)
    .orderBy(sql`${auditsTable.createdAt} DESC`);
  res.json(audits);
});

router.post("/audits", async (req, res): Promise<void> => {
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productName, asin, category, title, bulletPoints, imageUrls, targetKeywords } = parsed.data;

  const [audit] = await db
    .insert(auditsTable)
    .values({
      productName,
      asin: asin ?? null,
      category: category ?? null,
      title,
      bulletPoints,
      imageUrls,
      targetKeywords,
      overallScore: 0,
      status: "pending",
    })
    .returning();

  try {
    const result = await analyzeListingWithAI({
      title,
      bulletPoints,
      imageUrls,
      targetKeywords,
      category: category ?? undefined,
    });

    const [updatedAudit] = await db
      .update(auditsTable)
      .set({
        result,
        overallScore: result.overallScore,
        status: "complete",
        updatedAt: new Date(),
      })
      .where(eq(auditsTable.id, audit.id))
      .returning();

    const competitors = await db
      .select()
      .from(competitorsTable)
      .where(eq(competitorsTable.auditId, updatedAudit.id));

    res.status(201).json({ ...updatedAudit, competitors });
  } catch (err) {
    await db
      .update(auditsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(auditsTable.id, audit.id));

    res.status(201).json({
      ...audit,
      result: null,
      competitors: [],
      status: "failed",
    });
  }
});

router.get("/audits/stats", async (_req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalAudits: count(),
      averageScore: avg(auditsTable.overallScore),
    })
    .from(auditsTable);

  const highScoreResult = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(sql`${auditsTable.overallScore} >= 70`);

  const lowScoreResult = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(sql`${auditsTable.overallScore} < 50`);

  const recentAudits = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      asin: auditsTable.asin,
      category: auditsTable.category,
      overallScore: auditsTable.overallScore,
      status: auditsTable.status,
      createdAt: auditsTable.createdAt,
      updatedAt: auditsTable.updatedAt,
    })
    .from(auditsTable)
    .orderBy(sql`${auditsTable.createdAt} DESC`)
    .limit(5);

  res.json({
    totalAudits: Number(stats?.totalAudits ?? 0),
    averageScore: Math.round(Number(stats?.averageScore ?? 0)),
    highScoreCount: Number(highScoreResult[0]?.c ?? 0),
    lowScoreCount: Number(lowScoreResult[0]?.c ?? 0),
    recentAudits,
  });
});

router.get("/audits/:id", async (req, res): Promise<void> => {
  const params = GetAuditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(eq(competitorsTable.auditId, audit.id));

  res.json({
    ...audit,
    result: audit.result ?? {
      titleScore: { score: 0, issues: [], suggestions: [] },
      bulletScore: { score: 0, issues: [], suggestions: [] },
      imageScore: { score: 0, issues: [], suggestions: [] },
      keywordScore: { score: 0, issues: [], suggestions: [] },
      overallScore: 0,
      summary: "Analysis pending or failed.",
    },
    competitors,
  });
});

router.delete("/audits/:id", async (req, res): Promise<void> => {
  const params = DeleteAuditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [audit] = await db
    .delete(auditsTable)
    .where(eq(auditsTable.id, params.data.id))
    .returning();

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
