import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, graphicsProjectsTable } from "@workspace/db";
import type { GraphicsImageRecord } from "@workspace/db";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { getCreditCost, deductCreditsTeamAware, hasCreditsTeamAware, type TeamAwareContext } from "../lib/credits";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import * as fs from "fs";
import * as path from "path";

const router: IRouter = Router();

const IMAGES_DIR = path.join(process.cwd(), "public", "images", "graphics");

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

function getCreditCtx(req: Request): TeamAwareContext {
  const team = (req as TeamAuthedRequest).team;
  const userId = (req as AuthedRequest).userId;
  return {
    userId,
    ownerUserId: team.ownerUserId,
    isTeamMember: team.isTeamMember,
    memberId: team.memberId,
  };
}

function getEffectiveUserId(req: Request): string {
  return (req as TeamAuthedRequest).team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const team = (req as TeamAuthedRequest).team;
  if (!team) { res.status(401).json({ error: "Team context not resolved" }); return; }
  if (team.role === "viewer") { res.status(403).json({ error: "Forbidden: viewers cannot modify data" }); return; }
  next();
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function versionedFilename(type: string, index: number): string {
  return `${type}_${index}_${Date.now()}.png`;
}

function urlPath(projectId: number, filename: string): string {
  return `/api/images/graphics/${projectId}/${filename}`;
}

const DESIGN_STYLE_PROMPTS: Record<string, string> = {
  modern: "Contemporary bold composition, clean modern aesthetic, vibrant neutral accents, professional commercial photography.",
  luxury: "Dramatic directional lighting, rich moody atmosphere, opulent premium brand aesthetic, dark complementary tones, editorial high-fashion feel.",
  outdoor: "Natural outdoor setting, scenic environment, adventure and exploration atmosphere, product as the hero, dramatic landscape lighting.",
  minimalist: "Minimalist Scandinavian-inspired product photography, generous white space, clean simple composition, barely-there drop shadow, elegant restraint.",
};

const ASPECT_SIZES: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
  "1:1": "1024x1024",
  "3:2": "1792x1024",
  "2:3": "1024x1792",
};

interface GraphicsSpec {
  id: string;
  type: "lifestyle" | "feature";
  index: number;
  prompt: string;
}

function buildGraphicsSpecs(
  productName: string,
  category: string | null,
  designStyle: string,
  lifestyleCount: number,
  featureCount: number,
): GraphicsSpec[] {
  const productDesc = `${productName}${category ? `, a ${category} product` : ""}`;
  const styleSuffix = DESIGN_STYLE_PROMPTS[designStyle] ?? DESIGN_STYLE_PROMPTS.modern;
  const specs: GraphicsSpec[] = [];

  for (let i = 0; i < lifestyleCount; i++) {
    const prompts = [
      `Lifestyle product scene for ${productDesc}. Product placed prominently in a beautifully styled modern environment. No people. Product is the focal point. Professional commercial photography.`,
      `Product scene for ${productDesc} styled in an upscale, contemporary setting. Product displayed prominently with tasteful props. No people. Editorial-quality product styling.`,
      `Amazon lifestyle product photography for ${productDesc}. Product shown in a natural home setting with warm lighting. Beautifully decorated interior. No people.`,
      `Creative lifestyle product image for ${productDesc}. Product in a stylish environment with natural window light. Professional styling. No people.`,
      `Inspirational product scene for ${productDesc}. Product showcased in an aspirational lifestyle setting. Beautifully arranged. No people.`,
    ];
    specs.push({ id: `lifestyle_${i}`, type: "lifestyle", index: i, prompt: `${prompts[i % prompts.length]} ${styleSuffix}` });
  }

  for (let i = 0; i < featureCount; i++) {
    const prompts = [
      `Feature highlight graphic for ${productDesc}. Product prominently displayed with clean callout arrows pointing to key features. Clean modern e-commerce design on white background.`,
      `Product infographic image for ${productDesc}. Product centered with geometric icon callouts and benefit highlights. Clean structured layout.`,
      `Feature graphic for ${productDesc}. Product image with clean benefit text callouts and feature icons. Modern e-commerce design.`,
    ];
    specs.push({ id: `feature_${i}`, type: "feature", index: i, prompt: `${prompts[i % prompts.length]} ${styleSuffix}` });
  }

  return specs;
}

async function generateGraphicsImages(projectId: number, productName: string, category: string | null, designStyle: string, lifestyleCount: number, featureCount: number): Promise<GraphicsImageRecord[]> {
  const dir = path.join(IMAGES_DIR, String(projectId));
  ensureDir(dir);

  const specs = buildGraphicsSpecs(productName, category, designStyle, lifestyleCount, featureCount);
  const records: GraphicsImageRecord[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const spec of specs) {
    const filename = versionedFilename(spec.type, spec.index);
    const filePath = path.join(dir, filename);
    const imgUrl = urlPath(projectId, filename);

    try {
      const size = ASPECT_SIZES["1:1"];
      const buffer = await generateImageBuffer(spec.prompt, size);
      if (!buffer || buffer.length === 0) throw new Error("No image data returned");
      fs.writeFileSync(filePath, buffer);

      const version = {
        url: imgUrl,
        style: designStyle,
        aspectRatio: "1:1",
        isEdit: false,
        generatedAt: new Date().toISOString(),
      };

      records.push({
        id: spec.id,
        type: spec.type,
        index: spec.index,
        style: designStyle,
        aspectRatio: "1:1",
        currentUrl: imgUrl,
        versions: [version],
      });
    } catch (err) {
      errors.push({ id: spec.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (records.length === 0) {
    const summary = errors.map((e) => `${e.id}: ${e.error}`).join("; ");
    throw new Error(`All image generations failed: ${summary}`);
  }

  return records;
}

async function editGraphicsImage(projectId: number, existingRecord: GraphicsImageRecord, editPrompt: string): Promise<GraphicsImageRecord> {
  const dir = path.join(IMAGES_DIR, String(projectId));
  const currentFilename = path.basename(existingRecord.currentUrl);
  const sourceFilePath = path.join(dir, currentFilename);

  if (!fs.existsSync(sourceFilePath)) {
    throw new Error("Source image file not found.");
  }

  const { editImages } = await import("@workspace/integrations-openai-ai-server/image");
  const filename = versionedFilename(existingRecord.type, existingRecord.index);
  const destFilePath = path.join(dir, filename);
  const imgUrl = urlPath(projectId, filename);

  const styleSuffix = DESIGN_STYLE_PROMPTS[existingRecord.style] ?? "";
  const fullPrompt = `${editPrompt} ${styleSuffix}`;
  const buffer = await editImages([sourceFilePath], fullPrompt);
  if (!buffer || buffer.length === 0) throw new Error("No image data returned from AI edit");
  fs.writeFileSync(destFilePath, buffer);

  const newVersion = {
    url: imgUrl,
    style: existingRecord.style,
    aspectRatio: existingRecord.aspectRatio,
    prompt: editPrompt,
    isEdit: true,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...existingRecord,
    currentUrl: imgUrl,
    versions: [...existingRecord.versions, newVersion],
  };
}

// ─── Create project ───────────────────────────────────────────────────────────
router.post("/graphics/projects", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const body = req.body as { name: string; productName: string; category?: string; sourceImageUrls?: string[]; designStyle?: string; lifestyleCount?: number; featureCount?: number };

  const [project] = await db.insert(graphicsProjectsTable).values({
    userId,
    name: body.name ?? "Untitled Project",
    productName: body.productName,
    category: body.category ?? null,
    sourceImageUrls: body.sourceImageUrls ?? null,
    designStyle: body.designStyle ?? "modern",
    lifestyleCount: body.lifestyleCount ?? 0,
    featureCount: body.featureCount ?? 0,
    status: "draft",
  }).returning();

  res.status(201).json(project);
});

// ─── List projects ────────────────────────────────────────────────────────────
router.get("/graphics/projects", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const projects = await db
    .select()
    .from(graphicsProjectsTable)
    .where(eq(graphicsProjectsTable.userId, userId))
    .orderBy(desc(graphicsProjectsTable.updatedAt))
    .limit(100);
  res.json({ projects });
});

// ─── Get project ──────────────────────────────────────────────────────────────
router.get("/graphics/projects/:id", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)));

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(project);
});

// ─── Update project ───────────────────────────────────────────────────────────
router.patch("/graphics/projects/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)));

  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  const body = req.body as { name?: string; productName?: string; category?: string; sourceImageUrls?: string[]; designStyle?: string; lifestyleCount?: number; featureCount?: number };
  const [updated] = await db
    .update(graphicsProjectsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(graphicsProjectsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── Generate images ──────────────────────────────────────────────────────────
router.post("/graphics/projects/:id/generate", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)));

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const totalImages = project.lifestyleCount + project.featureCount;
  if (totalImages === 0) { res.status(400).json({ error: "No image types selected" }); return; }

  const cost = await getCreditCost("images");
  const creditsNeeded = totalImages; // 1 image credit per image
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, creditsNeeded);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${creditsNeeded} needed).` });
    return;
  }

  // Mark as generating
  await db.update(graphicsProjectsTable)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(graphicsProjectsTable.id, id));

  res.status(202).json({ message: "Generation started", status: "generating" });

  // Run generation in background
  (async () => {
    try {
      const imageRecords = await generateGraphicsImages(
        id,
        project.productName,
        project.category,
        project.designStyle,
        project.lifestyleCount,
        project.featureCount,
      );

      await deductCreditsTeamAware(creditCtx, cost.creditType, creditsNeeded, `Graphics for ${project.name}`, "graphics", { projectId: id });

      await db.update(graphicsProjectsTable)
        .set({ status: "completed", imageRecords, updatedAt: new Date() })
        .where(eq(graphicsProjectsTable.id, id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      await db.update(graphicsProjectsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(graphicsProjectsTable.id, id));
      console.error(`Graphics generation failed for project ${id}:`, message);
    }
  })();
});

// ─── Edit single image ────────────────────────────────────────────────────────
router.post("/graphics/projects/:id/images/:imageId/edit", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const imageId = String(req.params.imageId ?? "");
  if (isNaN(id) || !imageId) { res.status(400).json({ error: "Invalid parameters" }); return; }

  const [project] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)));

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const records = (project.imageRecords ?? []) as GraphicsImageRecord[];
  const existingRecord = records.find(r => r.id === imageId);
  if (!existingRecord) { res.status(404).json({ error: "Image not found" }); return; }

  const body = req.body as { editPrompt: string };
  if (!body.editPrompt?.trim()) { res.status(400).json({ error: "Edit prompt is required" }); return; }

  const cost = await getCreditCost("image_edit");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${cost.creditsRequired} needed).` });
    return;
  }

  try {
    const updatedRecord = await editGraphicsImage(id, existingRecord, body.editPrompt);
    await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, `Edit ${imageId}`, "graphics_edit", { projectId: id, imageId });

    const updatedRecords = records.map(r => r.id === imageId ? updatedRecord : r);
    await db.update(graphicsProjectsTable)
      .set({ imageRecords: updatedRecords, updatedAt: new Date() })
      .where(eq(graphicsProjectsTable.id, id));

    res.json(updatedRecord);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Edit failed";
    res.status(500).json({ error: message });
  }
});

// ─── Delete project ───────────────────────────────────────────────────────────
router.delete("/graphics/projects/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)));

  // Clean up image directory
  const dir = path.join(IMAGES_DIR, String(id));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  res.status(204).send();
});

export default router;
