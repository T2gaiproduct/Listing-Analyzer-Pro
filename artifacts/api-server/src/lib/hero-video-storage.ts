import fs from "node:fs";
import path from "node:path";
import { HERO_IMAGES_DIR, ensureHeroImagesDir } from "./hero-image-storage.js";

export const HERO_VIDEOS_DIR = path.join(HERO_IMAGES_DIR, "videos");

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function ensureHeroVideosDir(): void {
  ensureHeroImagesDir();
  if (!fs.existsSync(HERO_VIDEOS_DIR)) {
    fs.mkdirSync(HERO_VIDEOS_DIR, { recursive: true });
  }
}

function extFromFilename(filename?: string): string | null {
  if (!filename) return null;
  const ext = path.extname(filename).replace(".", "").toLowerCase();
  if (ext === "mp4" || ext === "webm" || ext === "mov") return ext;
  return null;
}

export function saveHeroVideo(buffer: Buffer, mimeType?: string, preferredName?: string): string {
  if (buffer.length === 0) throw new Error("No video data provided");
  if (buffer.length > MAX_VIDEO_BYTES) throw new Error("Video too large. Max 50MB.");

  const mime = (mimeType ?? "").toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    throw new Error("Unsupported video format. Use MP4, WebM, or MOV.");
  }

  ensureHeroVideosDir();
  const ext = extFromFilename(preferredName) ?? EXT_BY_MIME[mime] ?? "mp4";
  const filename = `hero-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(HERO_VIDEOS_DIR, filename), buffer);
  return `/api/images/heroes/videos/${filename}`;
}
