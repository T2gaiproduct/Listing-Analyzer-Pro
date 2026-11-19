import fs from "node:fs";
import sharp from "sharp";

/** Graphics types that composite the seller's photo instead of redrawing the product with AI. */
export const PRODUCT_PRESERVE_GRAPHICS_TYPE_SLUGS = new Set(["hero"]);

export function isProductPreserveGraphicsType(imageType: string | undefined): boolean {
  if (!imageType) return false;
  return PRODUCT_PRESERVE_GRAPHICS_TYPE_SLUGS.has(imageType.trim().toLowerCase());
}

export type ImageCanvasSize = "1024x1024" | "1792x1024" | "1024x1792";

function parseCanvasSize(size: ImageCanvasSize): { width: number; height: number } {
  const [w, h] = size.split("x").map((n) => Number.parseInt(n, 10));
  return {
    width: Number.isFinite(w) && w > 0 ? w : 1024,
    height: Number.isFinite(h) && h > 0 ? h : 1024,
  };
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
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error("Product reference file not found");
  }
  const { width, height } = parseCanvasSize(size);
  const maxSide = Math.round(Math.min(width, height) * fillRatio);

  const productPng = await sharp(sourceFilePath)
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

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