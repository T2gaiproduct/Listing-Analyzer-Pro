import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, avg, count, sql, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, competitorsTable, graphicsProjectsTable } from "@workspace/db";
import {
  CreateAuditBody,
  GetAuditParams,
  DeleteAuditParams,
  GenerateContentDirectBody,
} from "@workspace/api-zod";
import { generateChatCompletion } from "../lib/ai-provider";
import type { ImageStyle, AspectRatio, ImageRecord } from "@workspace/db";
import { analyzeListingWithAI } from "../lib/analyzer";
import { generateListingContent } from "../lib/content-generator";
import { generateEbcContent, type EbcContent } from "../lib/ebc-generator";
import {
  buildDefaultAplusPrompt,
  generateAplusModuleImages,
  parseAplusModuleIds,
  mergeAplusModules,
  regenerateAplusModule,
  editAplusModule,
  normalizeAplusModule,
  type AplusGenerationResult,
  type AplusStoredState,
  type AplusModule,
} from "../lib/aplus-generator";
import {
  generateProductImages,
  regenerateSingleImage,
  editSingleImage,
} from "../lib/image-generator";
import { deductCredits, hasCredits, getCreditCost, deductCreditsTeamAware, hasCreditsTeamAware, type TeamAwareContext } from "../lib/credits";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import { AMAZON_MARKETPLACES } from "../lib/amazon-marketplaces.js";
import {
  buildAuditExportBundle,
  buildExcelBuffer,
  buildZipBuffer,
  exportFilename,
} from "../lib/amazon-listing-export.js";

const router: IRouter = Router();

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

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

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const team = (req as TeamAuthedRequest).team;
  if (!team) {
    res.status(401).json({ error: "Team context not resolved" });
    return;
  }
  if (team.role === "viewer") {
    res.status(403).json({ error: "Forbidden: viewers cannot modify data" });
    return;
  }
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

function readLegacyGeneratedImages(audit: typeof auditsTable.$inferSelect) {
  return (audit.generatedImages ?? { main: [], infographic: [], lifestyle: [] }) as {
    main?: string[];
    infographic?: string[];
    lifestyle?: string[];
    aplus?: AplusStoredState;
  };
}

async function saveAplusState(
  auditId: number,
  audit: typeof auditsTable.$inferSelect,
  aplus: AplusStoredState,
): Promise<void> {
  const legacy = readLegacyGeneratedImages(audit);
  await db.update(auditsTable)
    .set({
      generatedImages: {
        main: legacy.main ?? [],
        infographic: legacy.infographic ?? [],
        lifestyle: legacy.lifestyle ?? [],
        aplus,
      } as unknown as typeof audit.generatedImages,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, auditId));
}

async function replaceAplusModule(
  auditId: number,
  moduleId: AplusModule["id"],
  updated: AplusModule,
): Promise<AplusModule | null> {
  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, auditId));
  if (!audit) return null;

  const aplus = readLegacyGeneratedImages(audit).aplus;
  if (!aplus?.modules?.some((m) => m.id === moduleId)) return null;

  const modules = aplus.modules.map((m) => (m.id === moduleId ? updated : m));
  await saveAplusState(auditId, audit, {
    ...aplus,
    status: aplus.status === "generating" ? "completed" : aplus.status,
    modules,
  });
  return updated;
}

router.get("/audits", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
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
    .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)))
    .orderBy(sql`${auditsTable.createdAt} DESC`);
  res.json(audits);
});

router.post("/audits", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { projectName, productName, asin, brandName, category, title, bulletPoints, imageUrls, targetKeywords } = parsed.data;

  const cost = await getCreditCost("audit");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: ownerId,
      projectName: projectName ?? productName,
      productName,
      asin: asin ?? null,
      brandName: brandName ?? null,
      category: category ?? null,
      title,
      bulletPoints,
      imageUrls,
      targetKeywords,
      overallScore: 0,
      status: "pending",
    })
    .returning();

  await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "audit", { auditId: audit.id });

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

router.post("/audits/draft", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { projectName, productName, asin, brandName, category, title, bulletPoints, imageUrls, targetKeywords } = parsed.data;

  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: ownerId,
      projectName: projectName ?? productName,
      productName,
      asin: asin ?? null,
      brandName: brandName ?? null,
      category: category ?? null,
      title,
      bulletPoints,
      imageUrls,
      targetKeywords,
      overallScore: 0,
      status: "draft",
      currentStep: 1,
    })
    .returning();

  res.status(201).json(audit);
});

router.get("/audits/stats", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const [stats] = await db
    .select({
      totalAudits: count(),
      averageScore: avg(auditsTable.overallScore),
    })
    .from(auditsTable)
    .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));

  const highScoreResult = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), sql`${auditsTable.overallScore} >= 70`));

  const lowScoreResult = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), sql`${auditsTable.overallScore} < 50`));

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
    .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)))
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

function resolvePublicBaseUrl(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" ? forwardedProto.split(",")[0]!.trim() : req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

async function loadAuditForExport(req: Request, auditId: number) {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const whereClause = isAdmin(userId)
    ? and(eq(auditsTable.id, auditId), eq(auditsTable.isDeleted, 0))
    : and(eq(auditsTable.id, auditId), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0));

  const [audit] = await db.select().from(auditsTable).where(whereClause).limit(1);
  if (!audit) return null;

  const [graphicsProject] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(
      eq(graphicsProjectsTable.auditId, auditId),
      eq(graphicsProjectsTable.isDeleted, 0),
    ))
    .limit(1);

  return { audit, graphicsProject: graphicsProject ?? null };
}

router.get("/audits/export/marketplaces", requireAuth, (_req, res): void => {
  res.json({ marketplaces: AMAZON_MARKETPLACES });
});

router.get("/audits/:id/export/excel", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const auditId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(auditId)) {
    res.status(400).json({ error: "Invalid audit id" });
    return;
  }

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  try {
    const marketplace = typeof req.query.marketplace === "string" ? req.query.marketplace : "US";
    const bundle = buildAuditExportBundle({
      audit: loaded.audit,
      marketplaceId: marketplace,
      graphicsImageRecords: (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined,
      imageUrlMode: "absolute",
      publicBaseUrl: resolvePublicBaseUrl(req),
    });
    const buffer = await buildExcelBuffer(bundle);
    const filename = exportFilename(bundle.filenameBase, "xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    res.status(400).json({ error: message });
  }
});

router.get("/audits/:id/export/zip", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const auditId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(auditId)) {
    res.status(400).json({ error: "Invalid audit id" });
    return;
  }

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  try {
    const marketplace = typeof req.query.marketplace === "string" ? req.query.marketplace : "US";
    const bundle = buildAuditExportBundle({
      audit: loaded.audit,
      marketplaceId: marketplace,
      graphicsImageRecords: (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined,
      imageUrlMode: "relative",
    });
    const excelBuffer = await buildExcelBuffer(bundle);
    const zipBuffer = await buildZipBuffer({
      bundle,
      excelBuffer,
      auditId,
      graphicsProjectId: loaded.graphicsProject?.id ?? null,
    });
    const filename = exportFilename(bundle.filenameBase, "zip");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    res.status(400).json({ error: message });
  }
});

router.get("/audits/:id", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const params = GetAuditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const whereClause = isAdmin(userId)
    ? and(eq(auditsTable.id, params.data.id), eq(auditsTable.isDeleted, 0))
    : and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0));

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(whereClause);

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(and(eq(competitorsTable.auditId, audit.id), eq(competitorsTable.isDeleted, 0)));

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

router.delete("/audits/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const params = DeleteAuditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [audit] = await db
    .update(auditsTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(and(eq(auditsTable.id, params.data.id), eq(auditsTable.userId, ownerId)))
    .returning();

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/audits/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));

  if (!existing) { res.status(404).json({ error: "Audit not found" }); return; }

  const body = req.body as Partial<{
    projectName: string;
    brandName: string;
    productName: string;
    category: string;
    imageUrls: string[];
    generatedContent: object;
    generatedImages: object;
    imageRecords: object;
    currentStep: number;
  }>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.projectName !== undefined) updates.projectName = body.projectName;
  if (body.brandName !== undefined) updates.brandName = body.brandName;
  if (body.productName !== undefined) updates.productName = body.productName;
  if (body.category !== undefined) updates.category = body.category;
  if (body.imageUrls !== undefined) updates.imageUrls = body.imageUrls;
  if (body.generatedContent !== undefined) updates.generatedContent = body.generatedContent;
  if (body.generatedImages !== undefined) updates.generatedImages = body.generatedImages;
  if (body.imageRecords !== undefined) updates.imageRecords = body.imageRecords;
  if (body.currentStep !== undefined) updates.currentStep = body.currentStep;

  const [updated] = await db
    .update(auditsTable)
    .set(updates)
    .where(eq(auditsTable.id, id))
    .returning();

  res.json(updated);
});

router.post("/audits/:id/generate-ebc", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }

  const cost = await getCreditCost("ebc");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "ebc", { auditId: id });

  try {
    const content = await generateEbcContent({
      prompt: prompt.trim(),
      productName: audit.productName,
      bulletPoints: audit.bulletPoints as string[],
      targetKeywords: audit.targetKeywords as string[],
      summary: (audit.result as { summary?: string } | null)?.summary ?? "",
    });
    res.json(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "EBC generation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/generate-aplus", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const {
    prompt: rawPrompt,
    moduleIds: rawModuleIds,
    imageCustomPrompt,
    promptReferenceImageUrls,
    quality,
    moduleConfigs,
  } = req.body as {
    prompt?: string;
    moduleIds?: string[];
    imageCustomPrompt?: string;
    promptReferenceImageUrls?: string[];
    quality?: "standard" | "hd";
    moduleConfigs?: Record<string, {
      imageCustomPrompt?: string;
      promptReferenceImageUrls?: string[];
      quality?: "standard" | "hd";
    }>;
  };

  let moduleIds: AplusModule["id"][];
  try {
    moduleIds = parseAplusModuleIds(rawModuleIds);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid module selection" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const existingAplus = readLegacyGeneratedImages(audit).aplus;
  if (existingAplus?.status === "generating") {
    res.status(409).json({ error: "A+ generation is already in progress" });
    return;
  }

  const preservedModules = (existingAplus?.modules ?? []).filter((m) => !moduleIds.includes(m.id));
  const existingContent = existingAplus?.content;
  const needsCopy = !existingContent;

  const imageCost = await getCreditCost("graphics");
  const imageCreditsNeeded = imageCost.creditsRequired * moduleIds.length;
  const creditCtx = getCreditCtx(req);

  const hasImages = await hasCreditsTeamAware(creditCtx, imageCost.creditType, imageCreditsNeeded);
  if (!hasImages) {
    res.status(402).json({ error: `Insufficient ${imageCost.creditType} credits (${imageCreditsNeeded} needed for ${moduleIds.length} A+ module image${moduleIds.length > 1 ? "s" : ""}).` });
    return;
  }

  const prompt = rawPrompt?.trim() || buildDefaultAplusPrompt({
    productName: audit.productName,
    brandName: audit.brandName,
    category: audit.category,
    bulletPoints: audit.bulletPoints as string[],
    targetKeywords: audit.targetKeywords as string[],
    summary: (audit.result as { summary?: string } | null)?.summary ?? "",
  });

  await saveAplusState(id, audit, {
    status: "generating",
    progress: { done: 0, total: moduleIds.length },
    content: existingContent,
    modules: preservedModules,
  });

  res.status(202).json({ message: "A+ generation started", status: "generating", moduleIds });

  (async () => {
    try {
      let content = existingContent;
      if (needsCopy) {
        content = await generateEbcContent({
          prompt,
          productName: audit.productName,
          bulletPoints: audit.bulletPoints as string[],
          targetKeywords: audit.targetKeywords as string[],
          summary: (audit.result as { summary?: string } | null)?.summary ?? "",
        });

        const [auditAfterCopy] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
        if (!auditAfterCopy) return;

        await saveAplusState(id, auditAfterCopy, {
          status: "generating",
          progress: { done: 0, total: moduleIds.length },
          content,
          modules: preservedModules,
        });
      }

      if (!content) {
        throw new Error("A+ copy is required before generating module images");
      }

      await deductCreditsTeamAware(
        creditCtx,
        imageCost.creditType,
        imageCreditsNeeded,
        `A+ modules (${moduleIds.length})`,
        "graphics",
        { auditId: id, feature: "aplus", moduleIds },
      );

      const newlyGenerated: AplusGenerationResult["modules"] = [];
      await generateAplusModuleImages({
        auditId: id,
        productName: audit.productName,
        category: audit.category,
        content,
        imageUrls: audit.imageUrls as string[],
        moduleIds,
        imageCustomPrompt: imageCustomPrompt?.trim() || undefined,
        promptReferenceImageUrls,
        quality,
        moduleConfigs,
        onModuleComplete: async (module, done, total) => {
          newlyGenerated.push(module);
          const merged = mergeAplusModules(preservedModules, newlyGenerated);
          const [current] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
          if (!current) return;
          await saveAplusState(id, current, {
            status: "generating",
            progress: { done, total },
            content,
            modules: merged,
          });
        },
      });

      const finalModules = mergeAplusModules(preservedModules, newlyGenerated);
      const [auditFinal] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
      if (!auditFinal) return;

      await saveAplusState(id, auditFinal, {
        status: "completed",
        progress: { done: newlyGenerated.length, total: moduleIds.length },
        content,
        modules: finalModules,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "A+ generation failed";
      const [auditFailed] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
      if (!auditFailed) return;
      const prev = readLegacyGeneratedImages(auditFailed).aplus;
      await saveAplusState(id, auditFailed, {
        status: "failed",
        progress: prev?.progress,
        content: prev?.content,
        modules: prev?.modules ?? preservedModules,
        errorMessage: message,
      });
    }
  })();
});

router.post("/generate-content", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);

  const parsed = GenerateContentDirectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = await getCreditCost("content");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "content", { userId: ownerId });

  try {
    const imageUrls = [
      ...(parsed.data.promptReferenceImageUrls ?? []),
      ...(parsed.data.imageUrls ?? []),
    ];
    const generatedContent = await generateListingContent({
      productName: parsed.data.productName,
      brandName: parsed.data.brandName,
      category: parsed.data.category,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      currentTitle: parsed.data.title,
      currentBullets: parsed.data.bulletPoints,
      currentKeywords: parsed.data.targetKeywords,
      customPrompt: parsed.data.customPrompt,
    });
    res.json(generatedContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Content generation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/generate-content", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const cost = await getCreditCost("content");
  const creditCtx2 = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx2, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const body = req.body as {
    customPrompt?: string;
    promptReferenceImageUrls?: string[];
  };

  await deductCreditsTeamAware(creditCtx2, cost.creditType, cost.creditsRequired, cost.activityName, "content", { auditId: id });

  try {
    const imageUrls = [
      ...(body.promptReferenceImageUrls ?? []),
      ...((audit.imageUrls as string[]) ?? []),
    ];
    const generatedContent = await generateListingContent({
      productName: audit.productName,
      asin: audit.asin,
      brandName: audit.brandName,
      category: audit.category,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      currentTitle: audit.title,
      currentBullets: audit.bulletPoints as string[],
      currentKeywords: audit.targetKeywords as string[],
      auditSummary: audit.result?.summary,
      customPrompt: body.customPrompt,
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

router.post("/audits/:id/generate-images", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const cost = await getCreditCost("images");
  const creditCtx3 = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx3, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const body = req.body as { style?: ImageStyle; aspectRatio?: AspectRatio } | undefined;

  await deductCreditsTeamAware(creditCtx3, cost.creditType, cost.creditsRequired, cost.activityName, "images", { auditId: id });

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

function buildAllRecordsFromAudit(audit: typeof auditsTable.$inferSelect): ImageRecord[] {
  if (audit.imageRecords && (audit.imageRecords as ImageRecord[]).length > 0) {
    return audit.imageRecords as ImageRecord[];
  }
  const legacy = audit.generatedImages as { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
  if (!legacy) return [];
  const records: ImageRecord[] = [];
  (["main", "infographic", "lifestyle"] as const).forEach((t) => {
    (legacy[t] ?? []).forEach((url, i) => {
      records.push({
        id: `${t}_${i}`,
        type: t,
        index: i,
        style: "premium",
        aspectRatio: "1:1",
        currentUrl: url,
        versions: [],
      });
    });
  });
  return records;
}

router.post("/audits/:id/images/:type/:index/regenerate", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const index = parseInt(String(req.params.index ?? ""));
  const type = String(req.params.type) as "main" | "infographic" | "lifestyle";

  if (isNaN(id) || isNaN(index) || !["main", "infographic", "lifestyle"].includes(type)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const cost = await getCreditCost("image_regenerate");
  const creditCtx4 = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx4, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const records = buildAllRecordsFromAudit(audit);
  const recordId = `${type}_${index}`;
  const existingRecord = records.find(r => r.id === recordId);

  if (!existingRecord) {
    res.status(404).json({ error: `Image ${recordId} not found. Generate all images first.` });
    return;
  }

  const body = req.body as { style?: ImageStyle; aspectRatio?: AspectRatio } | undefined;

  await deductCreditsTeamAware(creditCtx4, cost.creditType, cost.creditsRequired, cost.activityName, "image_regenerate", { auditId: id, imageType: type, index });

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

router.post("/audits/:id/images/:type/:index/edit", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const index = parseInt(String(req.params.index ?? ""));
  const type = String(req.params.type) as "main" | "infographic" | "lifestyle";

  if (isNaN(id) || isNaN(index) || !["main", "infographic", "lifestyle"].includes(type)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const cost = await getCreditCost("image_edit");
  const creditCtx5 = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx5, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed). Please purchase more credits.` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const records = buildAllRecordsFromAudit(audit);
  const recordId = `${type}_${index}`;
  const existingRecord = records.find(r => r.id === recordId);

  if (!existingRecord) {
    res.status(404).json({ error: `Image ${recordId} not found. Generate all images first.` });
    return;
  }

  const body = req.body as { prompt: string; referenceImageUrls?: string[]; style?: ImageStyle; aspectRatio?: AspectRatio };
  if (!body?.prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  await deductCreditsTeamAware(creditCtx5, cost.creditType, cost.creditsRequired, cost.activityName, "image_edit", { auditId: id, imageType: type, index });

  try {
    const updatedRecord = await editSingleImage({
      auditId: id,
      productName: audit.productName,
      category: audit.category,
      existingRecord,
      editPrompt: body.prompt,
      referenceImageUrls: body.referenceImageUrls,
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

router.post("/audits/:id/aplus/:moduleId/regenerate", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const moduleId = String(req.params.moduleId ?? "") as AplusModule["id"];

  if (isNaN(id) || !["hero", "features", "comparison", "brand_story"].includes(moduleId)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const cost = await getCreditCost("graphics");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed).` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const aplus = readLegacyGeneratedImages(audit).aplus;
  const existing = aplus?.modules?.find((m) => m.id === moduleId);
  const content = aplus?.content;
  if (!existing || !content) {
    res.status(404).json({ error: "A+ module not found. Generate A+ content first." });
    return;
  }

  if (aplus?.status === "generating") {
    res.status(409).json({ error: "A+ generation is already in progress" });
    return;
  }

  try {
    const updated = await regenerateAplusModule({
      auditId: id,
      moduleId,
      productName: audit.productName,
      category: audit.category,
      content,
      imageUrls: audit.imageUrls as string[],
      existing,
    });

    const saved = await replaceAplusModule(id, moduleId, updated);
    if (!saved) {
      res.status(404).json({ error: "Failed to save regenerated module" });
      return;
    }

    await deductCreditsTeamAware(
      creditCtx,
      cost.creditType,
      cost.creditsRequired,
      `Regenerate A+ ${moduleId}`,
      "graphics",
      { auditId: id, feature: "aplus", moduleId },
    );

    res.json(normalizeAplusModule(saved));
  } catch (err) {
    const message = err instanceof Error ? err.message : "A+ regeneration failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/aplus/:moduleId/edit", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const moduleId = String(req.params.moduleId ?? "") as AplusModule["id"];
  const body = req.body as { prompt?: string; referenceImageUrls?: string[] };

  if (isNaN(id) || !["hero", "features", "comparison", "brand_story"].includes(moduleId)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  if (!body?.prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const cost = await getCreditCost("graphics_edit");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed).` });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(and(eq(auditsTable.id, id), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const aplus = readLegacyGeneratedImages(audit).aplus;
  const existing = aplus?.modules?.find((m) => m.id === moduleId);
  const content = aplus?.content;
  if (!existing || !content) {
    res.status(404).json({ error: "A+ module not found. Generate A+ content first." });
    return;
  }

  if (aplus?.status === "generating") {
    res.status(409).json({ error: "A+ generation is already in progress" });
    return;
  }

  try {
    const updated = await editAplusModule({
      auditId: id,
      moduleId,
      content,
      existing,
      editPrompt: body.prompt.trim(),
      referenceImageUrls: body.referenceImageUrls,
    });

    const saved = await replaceAplusModule(id, moduleId, updated);
    if (!saved) {
      res.status(404).json({ error: "Failed to save edited module" });
      return;
    }

    await deductCreditsTeamAware(
      creditCtx,
      cost.creditType,
      cost.creditsRequired,
      `Edit A+ ${moduleId}`,
      "graphics_edit",
      { auditId: id, feature: "aplus", moduleId },
    );

    res.json(normalizeAplusModule(saved));
  } catch (err) {
    const message = err instanceof Error ? err.message : "A+ edit failed";
    res.status(500).json({ error: message });
  }
});

export default router;
