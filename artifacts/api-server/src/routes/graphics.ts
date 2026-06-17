import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, graphicsProjectsTable, adminUsersTable } from "@workspace/db";
import type { GraphicsImageRecord } from "@workspace/db";
import { generateImageBuffer, generateImageWithReferenceProxy } from "../lib/openai-image";
import { getCreditCost, deductCreditsTeamAware, hasCreditsTeamAware, type TeamAwareContext } from "../lib/credits";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";

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

async function isAdminUser(userId: string): Promise<boolean> {
  const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ADMIN_USER_IDS.includes(userId)) return true;
  const [row] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.userId, userId));
  return !!row;
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
  custom: "",
};

const REFERENCE_IMAGE_INSTRUCTION = "This image is a visual reference of the exact product you MUST feature. The product's appearance, shape, colors, branding, and design must be faithfully reproduced — not changed or substituted. Use this reference image as the visual basis for the product in the scene.";

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
  lifestyleCount: number,
  featureCount: number,
  lifestyleIndexOffset: number = 0,
  featureIndexOffset: number = 0,
  customLifestylePrompt?: string,
  customFeaturePrompt?: string,
): GraphicsSpec[] {
  const productDesc = `${productName}${category ? `, a ${category} product` : ""}`;
  const specs: GraphicsSpec[] = [];

  for (let i = 0; i < lifestyleCount; i++) {
    const idx = lifestyleIndexOffset + i;
    const prompt = customLifestylePrompt?.trim()
      ? customLifestylePrompt.trim()
      : `Lifestyle product scene for ${productDesc}. Product placed prominently in a beautifully styled modern environment. No people. Product is the focal point. Professional commercial photography.`;
    specs.push({ id: `lifestyle_${idx}`, type: "lifestyle", index: idx, prompt });
  }

  for (let i = 0; i < featureCount; i++) {
    const idx = featureIndexOffset + i;
    const prompt = customFeaturePrompt?.trim()
      ? customFeaturePrompt.trim()
      : `Feature highlight graphic for ${productDesc}. Product prominently displayed with clean callout arrows pointing to key features. Clean modern e-commerce design on white background.`;
    specs.push({ id: `feature_${idx}`, type: "feature", index: idx, prompt });
  }

  return specs;
}

// AI prompt instructions for each image type (from the Listing Image Instructions)
const IMAGE_TYPE_PROMPTS: Record<string, (productDesc: string) => string> = {
  hero: (productDesc) => `Amazon main product image for ${productDesc}. Pure white background, product centered, product taking 80-85% of the canvas. No lifestyle props, no heavy text, no decorative background. Product sharp, clean, and premium. Studio lighting with soft shadows. No text, no logos, no watermarks. High-resolution commercial product photo.`,
  lifestyle: (productDesc) => `Lifestyle product scene for ${productDesc}. Product being used by a target customer in a realistic environment. Emotional buying appeal, product clearly visible, natural lighting, clean composition. No text, no logos, no watermarks. Professional commercial photography.`,
  callouts: (productDesc) => `Infographic image for ${productDesc}. Product in center with numbered feature callouts. Arrows, labels, or pointers. Short benefit-driven text. Clean Amazon-style layout. No text, no logos, no watermarks. Professional commercial product photography.`,
  size: (productDesc) => `Size reference image for ${productDesc}. Product scale clearly shown with dimensions. Human hand, table, ruler, or common object for comparison. Easy-to-understand layout. No text, no logos, no watermarks. Professional commercial product photography.`,
  beforeafter: (productDesc) => `Before/after transformation image for ${productDesc}. Clear left-right comparison with "Before" and "After" labels. Product benefit or transformation shown. Clean and credible design. No text, no logos, no watermarks. Professional commercial product photography.`,
  bundle: (productDesc) => `Bundle shot image for ${productDesc}. Main product with accessories or included items. Labels if needed. Clean product arrangement. Premium e-commerce look. No text, no logos, no watermarks. Professional commercial product photography.`,
  social: (productDesc) => `Social proof image for ${productDesc}. Star rating style, short review-style highlight, product visible. Clean and trustworthy layout. No text, no logos, no watermarks. Professional commercial product photography.`,
  custom: () => "",
};

function buildNewImageSpecs(
  productName: string,
  category: string | null,
  imageTypes: string[],
  customPrompt?: string,
  existingRecords?: GraphicsImageRecord[],
): GraphicsSpec[] {
  const productDesc = `${productName}${category ? `, a ${category} product` : ""}`;
  const existing = existingRecords ?? [];
  const existingLifestyle = existing.filter(r => r.type === "lifestyle").length;
  const existingFeature = existing.filter(r => r.type === "feature").length;
  const specs: GraphicsSpec[] = [];
  let lifestyleIndex = existingLifestyle;
  let featureIndex = existingFeature;

  for (const type of imageTypes) {
    if (type === "custom") {
      if (!customPrompt?.trim()) continue;
      const idx = lifestyleIndex;
      const prompt = `${customPrompt.trim()} Product: ${productDesc}. Professional commercial product photography. High-resolution. No text, no logos, no watermarks.`;
      specs.push({ id: `lifestyle_${idx}`, type: "lifestyle", index: idx, prompt });
      lifestyleIndex++;
      continue;
    }
    const promptBuilder = IMAGE_TYPE_PROMPTS[type];
    if (!promptBuilder) continue;
    const prompt = `${promptBuilder(productDesc)} Professional commercial product photography. High-resolution. No text, no logos, no watermarks.`;
    const isFeature = type === "callouts" || type === "social" || type === "size" || type === "beforeafter";
    if (isFeature) {
      const idx = featureIndex;
      specs.push({ id: `feature_${idx}`, type: "feature", index: idx, prompt });
      featureIndex++;
    } else {
      const idx = lifestyleIndex;
      specs.push({ id: `lifestyle_${idx}`, type: "lifestyle", index: idx, prompt });
      lifestyleIndex++;
    }
  }

  return specs;
}

const MAX_CONCURRENT_IMAGES = 3;
const IMAGE_GENERATION_MS = 30000;

async function generateGraphicsImages(
  projectId: number,
  productName: string,
  category: string | null,
  lifestyleCount: number,
  featureCount: number,
  sourceImagePaths?: string[] | null,
  aspectRatio?: string,
  existingRecords?: GraphicsImageRecord[],
  startIndex?: number,
  customLifestylePrompt?: string,
  customFeaturePrompt?: string,
): Promise<GraphicsImageRecord[]> {
  const dir = path.join(IMAGES_DIR, String(projectId));
  ensureDir(dir);

  const existing = existingRecords ?? [];
  const existingLifestyle = existing.filter(r => r.type === "lifestyle");
  const existingFeature = existing.filter(r => r.type === "feature");
  const lifestyleIndexOffset = existingLifestyle.length;
  const featureIndexOffset = existingFeature.length;

  const specs = buildGraphicsSpecs(productName, category, lifestyleCount, featureCount, lifestyleIndexOffset, featureIndexOffset, customLifestylePrompt, customFeaturePrompt);
  const records: GraphicsImageRecord[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  const limit = pLimit(MAX_CONCURRENT_IMAGES);

  let generatedCount = startIndex ?? 0;
  const totalCount = generatedCount + specs.length;

  // Resolve source image path: download remote URLs to local file
  let sourcePath: string | null = null;
  const rawPath = sourceImagePaths?.[0] ?? null;
  if (rawPath) {
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      const destPath = path.join(dir, "source_remote.jpg");
      const downloaded = await downloadImage(rawPath, destPath);
      if (downloaded) {
        sourcePath = downloaded;
        console.log(`[generateGraphicsImages] Downloaded source image from ${rawPath} to ${downloaded}`);
      } else {
        console.log(`[generateGraphicsImages] Failed to download source image from ${rawPath}`);
      }
    } else if (fs.existsSync(rawPath) && fs.statSync(rawPath).size >= MIN_FILE_SIZE) {
      sourcePath = rawPath;
    }
  }

  async function generateOne(spec: GraphicsSpec): Promise<void> {
    const filename = versionedFilename(spec.type, spec.index);
    const filePath = path.join(dir, filename);
    const imgUrl = urlPath(projectId, filename);

    try {
      const arKey = aspectRatio ?? "1:1";
      const size = ASPECT_SIZES[arKey as keyof typeof ASPECT_SIZES] ?? ASPECT_SIZES["1:1"];
      let buffer: Buffer;
      const sourceFileIsValid = sourcePath !== null && fs.existsSync(sourcePath) && fs.statSync(sourcePath).size >= MIN_FILE_SIZE;
      if (sourceFileIsValid) {
        const referencePrompt = `${REFERENCE_IMAGE_INSTRUCTION} ${spec.prompt}`;
        console.log(`[generateGraphicsImages] Using reference image for ${spec.id}: ${sourcePath}`);
        buffer = await generateImageWithReferenceProxy(referencePrompt, sourcePath!, size);
      } else {
        console.log(`[generateGraphicsImages] No valid source image, generating without reference for ${spec.id}`);
        buffer = await generateImageBuffer(spec.prompt, size);
      }
      if (!buffer || buffer.length === 0) throw new Error("No image data returned");
      fs.writeFileSync(filePath, buffer);

      const version = {
        url: imgUrl,
        style: "custom",
        aspectRatio: arKey,
        isEdit: false,
        generatedAt: new Date().toISOString(),
      };

      records.push({
        id: spec.id,
        type: spec.type,
        index: spec.index,
        style: "custom",
        aspectRatio: arKey,
        currentUrl: imgUrl,
        versions: [version],
      });

      generatedCount++;
      await db.update(graphicsProjectsTable)
        .set({ generatedCount, updatedAt: new Date() })
        .where(eq(graphicsProjectsTable.id, projectId));
    } catch (err) {
      errors.push({ id: spec.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await Promise.all(specs.map((spec) => limit(() => generateOne(spec))));

  if (records.length === 0) {
    const summary = errors.map((e) => `${e.id}: ${e.error}`).join("; ");
    throw new Error(`All image generations failed: ${summary}`);
  }

  return records;
}

async function generateNewImageTypes(
  projectId: number,
  productName: string,
  category: string | null,
  imageTypes: string[],
  customPrompt: string | undefined,
  sourceImagePaths?: string[] | null,
  aspectRatio?: string,
  existingRecords?: GraphicsImageRecord[],
  startIndex?: number,
): Promise<GraphicsImageRecord[]> {
  const dir = path.join(IMAGES_DIR, String(projectId));
  ensureDir(dir);

  const existing = existingRecords ?? [];
  const specs = buildNewImageSpecs(productName, category, imageTypes, customPrompt, existing);
  const records: GraphicsImageRecord[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  const limit = pLimit(MAX_CONCURRENT_IMAGES);

  let generatedCount = startIndex ?? 0;

  // Resolve source image path: download remote URLs to local file
  let sourcePath: string | null = null;
  const rawPath = sourceImagePaths?.[0] ?? null;
  if (rawPath) {
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      const destPath = path.join(dir, "source_remote.jpg");
      const downloaded = await downloadImage(rawPath, destPath);
      if (downloaded) {
        sourcePath = downloaded;
        console.log(`[generateNewImageTypes] Downloaded source image from ${rawPath} to ${downloaded}`);
      } else {
        console.log(`[generateNewImageTypes] Failed to download source image from ${rawPath}`);
      }
    } else if (fs.existsSync(rawPath) && fs.statSync(rawPath).size >= MIN_FILE_SIZE) {
      sourcePath = rawPath;
    }
  }

  async function generateOne(spec: GraphicsSpec): Promise<void> {
    const filename = versionedFilename(spec.type, spec.index);
    const filePath = path.join(dir, filename);
    const imgUrl = urlPath(projectId, filename);

    try {
      const arKey = aspectRatio ?? "1:1";
      const size = ASPECT_SIZES[arKey as keyof typeof ASPECT_SIZES] ?? ASPECT_SIZES["1:1"];
      let buffer: Buffer;
      const sourceFileIsValid = sourcePath !== null && fs.existsSync(sourcePath) && fs.statSync(sourcePath).size >= MIN_FILE_SIZE;
      if (sourceFileIsValid) {
        const referencePrompt = `${REFERENCE_IMAGE_INSTRUCTION} ${spec.prompt}`;
        console.log(`[generateNewImageTypes] Using reference image for ${spec.id}: ${sourcePath}`);
        buffer = await generateImageWithReferenceProxy(referencePrompt, sourcePath!, size);
      } else {
        console.log(`[generateNewImageTypes] No valid source image, generating without reference for ${spec.id}`);
        buffer = await generateImageBuffer(spec.prompt, size);
      }
      if (!buffer || buffer.length === 0) throw new Error("No image data returned");
      fs.writeFileSync(filePath, buffer);

      const version = {
        url: imgUrl,
        style: "custom",
        aspectRatio: arKey,
        isEdit: false,
        generatedAt: new Date().toISOString(),
      };

      records.push({
        id: spec.id,
        type: spec.type,
        index: spec.index,
        style: "custom",
        aspectRatio: arKey,
        currentUrl: imgUrl,
        versions: [version],
      });

      generatedCount++;
      await db.update(graphicsProjectsTable)
        .set({ generatedCount, updatedAt: new Date() })
        .where(eq(graphicsProjectsTable.id, projectId));
    } catch (err) {
      errors.push({ id: spec.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await Promise.all(specs.map((spec) => limit(() => generateOne(spec))));

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

  const { editImagesProxy } = await import("../lib/openai-image");
  const filename = versionedFilename(existingRecord.type, existingRecord.index);
  const destFilePath = path.join(dir, filename);
  const imgUrl = urlPath(projectId, filename);

  const styleSuffix = DESIGN_STYLE_PROMPTS[existingRecord.style] ?? "";
  const fullPrompt = `${editPrompt} ${styleSuffix}`;
  const buffer = await editImagesProxy([sourceFilePath], fullPrompt);
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

const MIN_FILE_SIZE = 1024; // 1 KB

function saveBase64Image(base64Data: string, dir: string, filename: string): string | null {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < MIN_FILE_SIZE) {
    return null; // reject tiny/corrupted files
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function downloadImage(url: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, { timeout: 15000 } as any);
    if (!res.ok) {
      console.error(`[downloadImage] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_FILE_SIZE) {
      console.error(`[downloadImage] Image too small from ${url}: ${buffer.length} bytes`);
      return null;
    }
    fs.writeFileSync(destPath, buffer);
    return destPath;
  } catch (err) {
    console.error(`[downloadImage] Error downloading ${url}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Create project ───────────────────────────────────────────────────────────
router.post("/graphics/projects", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const body = req.body as { name: string; productName: string; category?: string; sourceImageUrls?: string[]; lifestyleCount?: number; featureCount?: number; imageTypes?: string[]; customPrompt?: string; auditId?: number };

  // Derive lifestyleCount and featureCount from imageTypes if provided
  let lifestyleCount = body.lifestyleCount ?? 0;
  let featureCount = body.featureCount ?? 0;
  if (body.imageTypes && body.imageTypes.length > 0) {
    lifestyleCount = body.imageTypes.filter((t) => !["callouts", "social", "size", "beforeafter"].includes(t)).length;
    featureCount = body.imageTypes.filter((t) => ["callouts", "social", "size", "beforeafter"].includes(t)).length;
  }

  const [project] = await db.insert(graphicsProjectsTable).values({
    userId,
    auditId: body.auditId ?? null,
    name: body.name ?? "Untitled Project",
    productName: body.productName,
    category: body.category ?? null,
    sourceImageUrls: body.sourceImageUrls ?? null,
    lifestyleCount: lifestyleCount,
    featureCount: featureCount,
    status: "draft",
  }).returning();

  // Save uploaded base64 images as files for later use
  if (body.sourceImageUrls && body.sourceImageUrls.length > 0) {
    const projectDir = path.join(IMAGES_DIR, String(project.id), "source");
    ensureDir(projectDir);
    const savedPaths: string[] = [];
    body.sourceImageUrls.forEach((img, idx) => {
      const ext = img.startsWith("data:image/png") ? "png" : "jpg";
      const filePath = saveBase64Image(img, projectDir, `source_${idx}.${ext}`);
      if (filePath) {
        savedPaths.push(filePath);
      }
    });
    // Update with saved paths
    if (savedPaths.length > 0) {
      await db.update(graphicsProjectsTable)
        .set({ sourceImageUrls: savedPaths, updatedAt: new Date() })
        .where(eq(graphicsProjectsTable.id, project.id));
    }
  }

  res.status(201).json(project);
});

// ─── List projects ────────────────────────────────────────────────────────────
router.get("/graphics/projects", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const auditIdQuery = req.query.auditId ? parseInt(String(req.query.auditId)) : null;

  let projects;
  if (auditIdQuery && !isNaN(auditIdQuery)) {
    projects = await db
      .select()
      .from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.auditId, auditIdQuery), eq(graphicsProjectsTable.isDeleted, 0)))
      .orderBy(desc(graphicsProjectsTable.updatedAt))
      .limit(100);
  } else {
    projects = await db
      .select()
      .from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)))
      .orderBy(desc(graphicsProjectsTable.updatedAt))
      .limit(100);
  }
  res.json({ projects });
});

// ─── Get project ──────────────────────────────────────────────────────────────
router.get("/graphics/projects/:id", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const admin = await isAdminUser(userId);

  const [project] = admin
    ? await db.select().from(graphicsProjectsTable).where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.isDeleted, 0)))
    : await db.select().from(graphicsProjectsTable).where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)));

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
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)));

  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  const body = req.body as { name?: string; productName?: string; category?: string; sourceImageUrls?: string[]; lifestyleCount?: number; featureCount?: number };
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
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)));

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const body = req.body as { style?: string; aspectRatio?: string; imageTypes?: string[]; customPrompt?: string; additionalLifestyleCount?: number; additionalFeatureCount?: number; customLifestylePrompt?: string; customFeaturePrompt?: string };

  // Support both old payload (additionalLifestyleCount/additionalFeatureCount) and new payload (imageTypes)
  const isNewFlow = Array.isArray(body.imageTypes) && body.imageTypes.length > 0;
  const isAdditional = (body.additionalLifestyleCount ?? 0) > 0 || (body.additionalFeatureCount ?? 0) > 0;

  let totalImages: number;
  if (isNewFlow) {
    totalImages = body.imageTypes!.length;
  } else {
    const lifestyleCount = isAdditional ? (body.additionalLifestyleCount ?? 0) : project.lifestyleCount;
    const featureCount = isAdditional ? (body.additionalFeatureCount ?? 0) : project.featureCount;
    totalImages = lifestyleCount + featureCount;
  }

  if (totalImages === 0) { res.status(400).json({ error: "No image types selected" }); return; }

  const cost = await getCreditCost("images");
  const creditsNeeded = totalImages;
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, creditsNeeded);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (${creditsNeeded} needed).` });
    return;
  }

  // Mark as generating and update counts so progress polling is correct
  const existingRecords = (project.imageRecords ?? []) as GraphicsImageRecord[];
  const existingLifestyle = existingRecords.filter(r => r.type === "lifestyle");
  const existingFeature = existingRecords.filter(r => r.type === "feature");

  // For new flow, estimate future counts by mapping image types to lifestyle/feature
  let newLifestyleCount = 0;
  let newFeatureCount = 0;
  if (isNewFlow && body.imageTypes) {
    for (const t of body.imageTypes) {
      const isFeature = t === "callouts" || t === "social" || t === "size" || t === "beforeafter";
      if (isFeature) newFeatureCount++;
      else newLifestyleCount++;
    }
  } else {
    newLifestyleCount = isAdditional ? (body.additionalLifestyleCount ?? 0) : project.lifestyleCount;
    newFeatureCount = isAdditional ? (body.additionalFeatureCount ?? 0) : project.featureCount;
  }

  await db.update(graphicsProjectsTable)
    .set({
      status: "generating",
      lifestyleCount: existingLifestyle.length + newLifestyleCount,
      featureCount: existingFeature.length + newFeatureCount,
      updatedAt: new Date(),
    })
    .where(eq(graphicsProjectsTable.id, id));

  res.status(202).json({ message: "Generation started", status: "generating" });

  // Run generation in background
  (async () => {
    try {
      const generateStyle = body.style ?? "custom";
      const generateAspectRatio = body.aspectRatio ?? "1:1";
      const existingRecords = (project.imageRecords ?? []) as GraphicsImageRecord[];
      const existingCount = existingRecords.length;
      let newRecords: GraphicsImageRecord[];
      if (isNewFlow && body.imageTypes) {
        newRecords = await generateNewImageTypes(
          id,
          project.productName,
          project.category,
          body.imageTypes,
          body.customPrompt,
          project.sourceImageUrls,
          generateAspectRatio,
          existingRecords,
          existingCount,
        );
      } else {
        const lifestyleCount = isAdditional ? (body.additionalLifestyleCount ?? 0) : project.lifestyleCount;
        const featureCount = isAdditional ? (body.additionalFeatureCount ?? 0) : project.featureCount;
        newRecords = await generateGraphicsImages(
          id,
          project.productName,
          project.category,
          lifestyleCount,
          featureCount,
          project.sourceImageUrls,
          generateAspectRatio,
          existingRecords,
          existingCount,
          body.customLifestylePrompt,
          body.customFeaturePrompt,
        );
      }

      const mergedRecords = [...existingRecords, ...newRecords];
      const newLifestyleCount = existingRecords.filter(r => r.type === "lifestyle").length + newRecords.filter(r => r.type === "lifestyle").length;
      const newFeatureCount = existingRecords.filter(r => r.type === "feature").length + newRecords.filter(r => r.type === "feature").length;
      const generatedCount = mergedRecords.length;

      await deductCreditsTeamAware(creditCtx, cost.creditType, creditsNeeded, `Graphics for ${project.name}`, "graphics", { projectId: id });

      await db.update(graphicsProjectsTable)
        .set({
          status: "completed",
          imageRecords: mergedRecords,
          lifestyleCount: newLifestyleCount,
          featureCount: newFeatureCount,
          generatedCount,
          updatedAt: new Date(),
        })
        .where(eq(graphicsProjectsTable.id, id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      const errorText = message.length > 500 ? message.slice(0, 500) + "..." : message;
      await db.update(graphicsProjectsTable)
        .set({ status: "failed", errorMessage: errorText, updatedAt: new Date() })
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
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)));

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

// ─── Regenerate single image ──────────────────────────────────────────────────
router.post("/graphics/projects/:id/images/:imageId/regenerate", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  const imageId = String(req.params.imageId ?? "");
  if (isNaN(id) || !imageId) { res.status(400).json({ error: "Invalid parameters" }); return; }

  const [project] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)));

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const records = (project.imageRecords ?? []) as GraphicsImageRecord[];
  const existingRecord = records.find(r => r.id === imageId);
  if (!existingRecord) { res.status(404).json({ error: "Image not found" }); return; }

  const body = req.body as { style?: string; aspectRatio?: string };
  const regenStyle = body.style ?? existingRecord.style;
  const regenAspectRatio = body.aspectRatio ?? existingRecord.aspectRatio;

  const cost = await getCreditCost("images");
  const creditCtx = getCreditCtx(req);
  const creditCheck = await hasCreditsTeamAware(creditCtx, cost.creditType, 1);
  if (!creditCheck) {
    res.status(402).json({ error: `Insufficient ${cost.creditType} credits (1 needed).` });
    return;
  }

  try {
    const dir = path.join(IMAGES_DIR, String(id));
    const styleSuffix = DESIGN_STYLE_PROMPTS[regenStyle] ?? DESIGN_STYLE_PROMPTS.modern;
    const productDesc = `${project.productName}${project.category ? `, a ${project.category} product` : ""}`;
    const prompt = existingRecord.type === "lifestyle"
      ? `Lifestyle product scene for ${productDesc}. Product placed prominently in a beautifully styled modern environment. No people. Product is the focal point. Professional commercial photography. ${styleSuffix}`
      : `Feature highlight graphic for ${productDesc}. Product prominently displayed with clean callout arrows pointing to key features. Clean modern e-commerce design on white background. ${styleSuffix}`;

    const size = ASPECT_SIZES[regenAspectRatio as keyof typeof ASPECT_SIZES] ?? ASPECT_SIZES["1:1"];
    const buffer = await generateImageBuffer(prompt, size);
    if (!buffer || buffer.length === 0) throw new Error("No image data returned");

    const filename = versionedFilename(existingRecord.type, existingRecord.index);
    const filePath = path.join(dir, filename);
    const imgUrl = urlPath(id, filename);
    fs.writeFileSync(filePath, buffer);

    const newVersion = {
      url: imgUrl,
      style: regenStyle,
      aspectRatio: regenAspectRatio,
      isEdit: false,
      generatedAt: new Date().toISOString(),
    };

    const updatedRecord: GraphicsImageRecord = {
      ...existingRecord,
      style: regenStyle,
      aspectRatio: regenAspectRatio,
      currentUrl: imgUrl,
      versions: [...existingRecord.versions, newVersion],
    };

    const updatedRecords = records.map(r => r.id === imageId ? updatedRecord : r);
    await db.update(graphicsProjectsTable)
      .set({ imageRecords: updatedRecords, updatedAt: new Date() })
      .where(eq(graphicsProjectsTable.id, id));

    await deductCreditsTeamAware(creditCtx, cost.creditType, 1, `Regenerate ${imageId}`, "graphics", { projectId: id, imageId });

    res.json(updatedRecord);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    res.status(500).json({ error: message });
  }
});

// ─── Delete project ───────────────────────────────────────────────────────────
router.delete("/graphics/projects/:id", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db
    .update(graphicsProjectsTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.userId, userId)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(204).send();
});

export default router;
