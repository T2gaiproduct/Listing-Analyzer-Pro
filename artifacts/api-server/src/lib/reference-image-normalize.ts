import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const MAX_SIDE = 1536;

/** OpenAI image edit accepts PNG/JPEG; normalize WebP/odd formats and flatten alpha. */
export async function prepareImageForOpenAiEdit(sourcePath: string): Promise<string> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Reference image not found: ${sourcePath}`);
  }
  const stat = fs.statSync(sourcePath);
  if (stat.size < 1024) {
    throw new Error("Reference image file is too small");
  }

  const tmpDir = path.join(os.tmpdir(), "la-graphics-ref");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `ref_${Date.now()}_${path.basename(sourcePath, path.extname(sourcePath))}.png`);

  await sharp(sourcePath)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile(outPath);

  return outPath;
}

export function isOpenAiInvalidImageDataError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /invalid image data|image file is not valid|unsupported image/i.test(msg);
}