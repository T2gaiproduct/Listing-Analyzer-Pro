import fs from "node:fs";
import sharp from "sharp";

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

export function isOpenAiSafetyRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /safety system|safety_violations|content.?policy|rejected by the safety/i.test(msg);
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
  compositeSceneSuffix?: string;
  compositeFallbackScene?: string;
  generateScene: (scenePrompt: string, size: ImageCanvasSize) => Promise<Buffer>;
}): Promise<Buffer> {
  const layout = resolveProductPreserveLayout(options.imageType, options.size);
  if (layout === "studio") {
    return compositeProductPreserveHero(options.sourceFilePath, options.size);
  }
  const suffix = options.compositeSceneSuffix?.trim();
  const scenePrompt = suffix ? `${options.prompt} ${suffix}`.trim() : options.prompt.trim();
  if (!scenePrompt) {
    throw new Error("Composite scene prompt is empty — configure prompt_template and composite_scene_suffix in admin.");
  }
  let scene: Buffer;
  try {
    scene = await options.generateScene(scenePrompt, options.size);
  } catch (err) {
    const fallback = options.compositeFallbackScene?.trim();
    if (fallback && (layout === "lifestyle_scene" || isOpenAiSafetyRejection(err))) {
      scene = await options.generateScene(fallback, options.size);
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