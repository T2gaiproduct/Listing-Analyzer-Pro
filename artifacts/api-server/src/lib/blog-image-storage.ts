import fs from "node:fs";
import path from "node:path";
import { IMAGES_DIR } from "./image-storage";
import { parseDataUrl } from "./branding-storage";

export const BLOG_IMAGES_DIR = path.join(IMAGES_DIR, "blog");

export function ensureBlogImagesDir(): void {
  if (!fs.existsSync(BLOG_IMAGES_DIR)) {
    fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
  }
}

function extFromBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "webp";
  return "png";
}

export function saveBlogImage(buffer: Buffer, preferredName?: string): string {
  if (buffer.length === 0) throw new Error("No image data provided");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Image too large. Max 5MB.");

  ensureBlogImagesDir();
  const ext = preferredName?.includes(".")
    ? path.extname(preferredName).replace(".", "") || extFromBuffer(buffer)
    : extFromBuffer(buffer);
  const filename = `blog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(BLOG_IMAGES_DIR, filename), buffer);
  return `/api/images/blog/${filename}`;
}

export function saveBlogImageFromDataUrl(dataUrl: string, preferredName?: string): string {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Invalid image data");
  return saveBlogImage(parsed.buffer, preferredName);
}
