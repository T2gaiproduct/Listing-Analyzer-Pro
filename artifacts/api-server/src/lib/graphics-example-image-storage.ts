import fs from "node:fs";
import path from "node:path";
import { IMAGES_DIR } from "./image-storage.js";
import { parseDataUrl } from "./branding-storage.js";

export const GRAPHICS_EXAMPLE_IMAGES_DIR = path.join(IMAGES_DIR, "graphics-examples");

export function ensureGraphicsExampleImagesDir(): void {
  if (!fs.existsSync(GRAPHICS_EXAMPLE_IMAGES_DIR)) {
    fs.mkdirSync(GRAPHICS_EXAMPLE_IMAGES_DIR, { recursive: true });
  }
}

function extFromBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "webp";
  return "png";
}

export function saveGraphicsExampleImage(buffer: Buffer, preferredName?: string): string {
  if (buffer.length === 0) throw new Error("No image data provided");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Image too large. Max 5MB.");

  ensureGraphicsExampleImagesDir();
  const ext = preferredName?.includes(".")
    ? path.extname(preferredName).replace(".", "") || extFromBuffer(buffer)
    : extFromBuffer(buffer);
  const filename = `example-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(GRAPHICS_EXAMPLE_IMAGES_DIR, filename), buffer);
  return `/api/images/graphics-examples/${filename}`;
}

export function saveGraphicsExampleImageFromDataUrl(dataUrl: string, preferredName?: string): string {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Invalid image data");
  return saveGraphicsExampleImage(parsed.buffer, preferredName);
}

const MIN_EXAMPLE_FILE_BYTES = 1024;

/** Resolve `/api/images/graphics-examples/...` to a local file for AI reference input. */
export function resolveGraphicsExampleImagePath(imageUrl: string): string | null {
  const basename = path.basename((imageUrl.split("?")[0] ?? imageUrl).trim());
  if (!basename || basename === "." || basename.includes("..")) return null;
  const filePath = path.join(GRAPHICS_EXAMPLE_IMAGES_DIR, basename);
  if (!fs.existsSync(filePath)) return null;
  if (fs.statSync(filePath).size < MIN_EXAMPLE_FILE_BYTES) return null;
  return filePath;
}
