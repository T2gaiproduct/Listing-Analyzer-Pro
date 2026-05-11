import { Router, type IRouter } from "express";
import { eq, avg, count, sql } from "drizzle-orm";
import { db, auditsTable, competitorsTable } from "@workspace/db";
import {
  CreateAuditBody,
  GetAuditParams,
  DeleteAuditParams,
} from "@workspace/api-zod";
import type { ImageStyle, AspectRatio, ImageRecord } from "@workspace/db";
import { analyzeListingWithAI } from "../lib/analyzer";
import { generateListingContent } from "../lib/content-generator";
import {
  generateProductImages,
  regenerateSingleImage,
  editSingleImage,
} from "../lib/image-generator";

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
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, auditId: audit.id }, "AI analysis failed");
    await db
      .update(auditsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(auditsTable.id, audit.id));

    res.status(201).json({
      ...audit,
      result: null,
      competitors: [],
      status: "failed",
      failureReason: errMsg,
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

router.post("/audits/:id/generate-content", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  try {
    const generatedContent = await generateListingContent({
      productName: audit.productName,
      asin: audit.asin,
      category: audit.category,
      currentTitle: audit.title,
      currentBullets: audit.bulletPoints as string[],
      currentKeywords: audit.targetKeywords as string[],
      auditSummary: audit.result?.summary,
    });

    await db.update(auditsTable)
      .set({ generatedContent, updatedAt: new Date() })
      .where(eq(auditsTable.id, id));

    res.json(generatedContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Content generation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/generate-images", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const body = req.body as { style?: ImageStyle; aspectRatio?: AspectRatio } | undefined;

  try {
    const imageRecords = await generateProductImages({
      auditId: id,
      productName: audit.productName,
      category: audit.category,
      title: audit.title,
      bulletPoints: audit.bulletPoints as string[],
      style: body?.style,
      aspectRatio: body?.aspectRatio,
    });

    const legacyImages = {
      main: imageRecords.filter(r => r.type === "main").map(r => r.currentUrl),
      infographic: imageRecords.filter(r => r.type === "infographic").map(r => r.currentUrl),
      lifestyle: imageRecords.filter(r => r.type === "lifestyle").map(r => r.currentUrl),
    };

    await db.update(auditsTable)
      .set({ generatedImages: legacyImages, imageRecords, updatedAt: new Date() })
      .where(eq(auditsTable.id, id));

    res.json(imageRecords);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/images/:type/:index/regenerate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  const index = parseInt(req.params.index ?? "");
  const type = req.params.type as "main" | "infographic" | "lifestyle";

  if (isNaN(id) || isNaN(index) || !["main", "infographic", "lifestyle"].includes(type)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const records = (audit.imageRecords as ImageRecord[] | null) ?? [];
  const recordId = `${type}_${index}`;
  let existingRecord = records.find(r => r.id === recordId);

  if (!existingRecord) {
    res.status(404).json({ error: `Image ${recordId} not found. Generate all images first.` });
    return;
  }

  const body = req.body as { style?: ImageStyle; aspectRatio?: AspectRatio } | undefined;

  try {
    const updatedRecord = await regenerateSingleImage({
      auditId: id,
      productName: audit.productName,
      category: audit.category,
      existingRecord,
      style: body?.style,
      aspectRatio: body?.aspectRatio,
    });

    const newRecords = records.map(r => r.id === recordId ? updatedRecord : r);
    await db.update(auditsTable)
      .set({ imageRecords: newRecords, updatedAt: new Date() })
      .where(eq(auditsTable.id, id));

    res.json(updatedRecord);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image regeneration failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/images/:type/:index/edit", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  const index = parseInt(req.params.index ?? "");
  const type = req.params.type as "main" | "infographic" | "lifestyle";

  if (isNaN(id) || isNaN(index) || !["main", "infographic", "lifestyle"].includes(type)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const records = (audit.imageRecords as ImageRecord[] | null) ?? [];
  const recordId = `${type}_${index}`;
  const existingRecord = records.find(r => r.id === recordId);

  if (!existingRecord) {
    res.status(404).json({ error: `Image ${recordId} not found. Generate all images first.` });
    return;
  }

  const body = req.body as { prompt: string; style?: ImageStyle; aspectRatio?: AspectRatio };
  if (!body?.prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const updatedRecord = await editSingleImage({
      auditId: id,
      productName: audit.productName,
      category: audit.category,
      existingRecord,
      editPrompt: body.prompt,
      style: body.style,
      aspectRatio: body.aspectRatio,
    });

    const newRecords = records.map(r => r.id === recordId ? updatedRecord : r);
    await db.update(auditsTable)
      .set({ imageRecords: newRecords, updatedAt: new Date() })
      .where(eq(auditsTable.id, id));

    res.json(updatedRecord);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image edit failed";
    res.status(500).json({ error: message });
  }
});

export default router;
