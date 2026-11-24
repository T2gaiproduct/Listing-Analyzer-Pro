import fs from "node:fs";
import sharp from "sharp";
import { isSubstantialAdminImagePrompt } from "./image-prompt-skill-sync.js";

export type ImageCanvasSize = "1024x1024" | "1792x1024" | "1024x1792";

export type ProductPreserveLayout = "studio" | "lifestyle_scene" | "feature_center" | "banner_west";

/** All graphics / A+ types use upload-preserving pipeline when a product file is available. */
export function isProductPreserveGraphicsType(_imageType: string | undefined): boolean {
  return true;
}

export function resolveProductPreserveLayout(
  imageType: string | undefined,
  canvas: ImageCanvasSize = "1024x1024",
): ProductPreserveLayout {
  const slug = (imageType ?? "").trim().toLowerCase();
  const isWide = canvas === "1792x1024";
  if (isWide) {
    if (slug === "comparison" || slug === "features") return "feature_center";
    return "banner_west";
  }
  if (slug === "hero" || slug === "main") return "studio";
  if (["callouts", "size", "beforeafter", "social"].includes(slug)) return "feature_center";
  return "lifestyle_scene";
}

const SCENE_NO_PRODUCT_BASE =
  "CRITICAL: Do not draw, photograph, or depict any product, bottle, jar, tube, packaging, label, logo, or branded container. ";

const LIFESTYLE_SAFETY_SUFFIX =
  "Family-friendly PG-rated commercial e-commerce photography, SFW. Fully clothed adult only, modest casual attire, neutral professional pose, empty hands. "
  + "No nudity, no lingerie, no sensual or romantic tone, no bare chest or suggestive body focus. Waist-up or wider framing.";

const FALLBACK_LIFESTYLE_SCENE_PROMPT =
  "Bright clean modern bathroom or vanity interior, soft natural daylight, neutral beige tiles, folded towel, small plant. "
  + "Empty countertop with uncluttered space in the lower-right. No people. Professional stock interior, SFW, PG. "
  + `${SCENE_NO_PRODUCT_BASE}`;

export function isOpenAiSafetyRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /safety system|safety_violations|content.?policy|rejected by the safety/i.test(msg);
}

function productLabelFromPrompt(basePrompt: string): string {
  const sceneFor = basePrompt.match(/\bfor\s+(.+?)\./i);
  if (sceneFor?.[1]?.trim()) return sceneFor[1].trim();
  const sceneForRest = basePrompt.match(/\bfor\s+(.+?)(?:\.|$)/i);
  return sceneForRest?.[1]?.trim() || "consumer product";
}

/** Lifestyle scenes are rewritten for safety — base templates mention "product in use" and trigger OpenAI sexual filters. */
export function scenePromptWithoutProduct(
  basePrompt: string,
  layout: ProductPreserveLayout,
  productLabel?: string,
): string {
  if (layout === "studio") return basePrompt;
  if (layout === "banner_west") {
    return `${basePrompt} ${SCENE_NO_PRODUCT_BASE}Leave the left third of the frame visually clear and uncluttered for product placement. No packaging on the left side.`;
  }
  if (layout === "feature_center") {
    return `${basePrompt} ${SCENE_NO_PRODUCT_BASE}Leave a large empty pale neutral area in the center (no product). Callouts, arrows, and background only.`;
  }
  const label = productLabel?.trim() || productLabelFromPrompt(basePrompt);
  return [
    `Professional lifestyle background scene for ${label}.`,
    "Realistic home or bathroom setting, warm natural lighting, clean composition.",
    "Single adult standing near counter, fully dressed, modest pose, smiling naturally, hands relaxed at sides.",
    SCENE_NO_PRODUCT_BASE,
    LIFESTYLE_SAFETY_SUFFIX,
    "No text, no logos, no watermarks.",
  ].join(" ");
}

function parseCanvasSize(size: ImageCanvasSize): { width: number; height: number } {
  const [w, h] = size.split("x").map((n) => Number.parseInt(n, 10));
  return {
    width: Number.isFinite(w) && w > 0 ? w : 1024,
    height: Number.isFinite(h) && h > 0 ? h : 1024,
  };
}

async function prepareProductPng(sourceFilePath: string, maxSide: number): Promise<Buffer> {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error("Product reference file not found");
  }
  return sharp(sourceFilePath)
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
}

/**
 * Amazon-style hero: pure white canvas, product scaled inside (default ~82% of the shorter side).
 * Uses the uploaded file pixels as-is — no generative redraw.
 */
export async function compositeProductPreserveHero(
  sourceFilePath: string,
  size: ImageCanvasSize = "1024x1024",
  fillRatio = 0.82,
): Promise<Buffer> {
  const { width, height } = parseCanvasSize(size);
  const maxSide = Math.round(Math.min(width, height) * fillRatio);
  const productPng = await prepareProductPng(sourceFilePath, maxSide);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: productPng, gravity: "centre" }])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

export async function compositeProductOnScene(
  sourceFilePath: string,
  size: ImageCanvasSize,
  layout: ProductPreserveLayout,
  sceneJpeg: Buffer,
): Promise<Buffer> {
  const { width, height } = parseCanvasSize(size);
  const normalizedScene = await sharp(sceneJpeg)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg()
    .toBuffer();

  if (layout === "feature_center") {
    const maxSide = Math.round(Math.min(width, height) * 0.48);
    const productPng = await prepareProductPng(sourceFilePath, maxSide);
    return sharp(normalizedScene)
      .composite([{ input: productPng, gravity: "centre" }])
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer();
  }

  if (layout === "banner_west") {
    const maxH = Math.round(height * 0.72);
    const productPng = await prepareProductPng(sourceFilePath, maxH);
    const left = Math.round(width * 0.04);
    return sharp(normalizedScene)
      .composite([{ input: productPng, gravity: "west", left }])
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer();
  }

  const maxSide = Math.round(Math.min(width, height) * 0.42);
  const productPng = await prepareProductPng(sourceFilePath, maxSide);
  const insetLeft = Math.round(width * 0.06);
  const insetTop = Math.round(height * 0.06);
  return sharp(normalizedScene)
    .composite([
      {
        input: productPng,
        gravity: "southeast",
        left: -insetLeft,
        top: -insetTop,
      },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

export async function generatePreservedProductImage(options: {
  imageType?: string;
  sourceFilePath: string;
  size: ImageCanvasSize;
  prompt: string;
  productLabel?: string;
  generateScene: (scenePrompt: string, size: ImageCanvasSize) => Promise<Buffer>;
}): Promise<Buffer> {
  const layout = resolveProductPreserveLayout(options.imageType, options.size);
  if (layout === "studio") {
    return compositeProductPreserveHero(options.sourceFilePath, options.size);
  }
  const scenePrompt = isSubstantialAdminImagePrompt(options.prompt)
    ? `${options.prompt} ${SCENE_NO_PRODUCT_BASE} Leave clear space to place the exact uploaded product photo; bright professional Amazon listing lighting.`
    : scenePromptWithoutProduct(options.prompt, layout, options.productLabel);
  let scene: Buffer;
  try {
    scene = await options.generateScene(scenePrompt, options.size);
  } catch (err) {
    if (layout === "lifestyle_scene" && isOpenAiSafetyRejection(err)) {
      scene = await options.generateScene(FALLBACK_LIFESTYLE_SCENE_PROMPT, options.size);
    } else {
      throw err;
    }
  }
  if (!scene?.length) {
    throw new Error("Scene generation returned empty image");
  }
  return compositeProductOnScene(
    options.sourceFilePath,
    options.size,
    layout,
    scene,
  );
}