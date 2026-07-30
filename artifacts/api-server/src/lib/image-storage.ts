import fs from "node:fs";
import path from "node:path";

const MIN_FILE_SIZE = 1024;

/** Stable api-server package root (dist/ → parent when bundled). */
const API_ROOT = path.resolve(
  typeof globalThis.__dirname === "string" ? globalThis.__dirname : process.cwd(),
  typeof globalThis.__dirname === "string" ? ".." : ".",
);

export const IMAGES_DIR = path.join(API_ROOT, "public", "images");
export const GRAPHICS_IMAGES_DIR = path.join(IMAGES_DIR, "graphics");

/** Older runs wrote to monorepo /public/images when cwd was the workspace root. */
const LEGACY_IMAGES_DIR = path.resolve(API_ROOT, "../../public/images");

export function auditImageDir(auditId: number): string {
  return path.join(IMAGES_DIR, String(auditId));
}

export function ensureAuditImageDir(auditId: number): string {
  const dir = auditImageDir(auditId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function imageUrlPath(auditId: number, filename: string): string {
  return `/api/images/${auditId}/${filename}`;
}

function isValidImageFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= MIN_FILE_SIZE;
}

function migrateToCanonical(sourcePath: string, auditId: number, filename: string): string {
  const canonical = path.join(IMAGES_DIR, String(auditId), filename);
  if (sourcePath === canonical) return canonical;
  ensureAuditImageDir(auditId);
  if (!fs.existsSync(canonical)) {
    fs.copyFileSync(sourcePath, canonical);
  }
  return canonical;
}

/** Resolve an audit image URL to an on-disk path; copies legacy files into canonical storage. */
export function resolveAuditImagePath(auditId: number, imageUrl: string): string | null {
  const filename = path.basename((imageUrl.split("?")[0] ?? imageUrl));
  const candidates = [
    path.join(IMAGES_DIR, String(auditId), filename),
    path.join(LEGACY_IMAGES_DIR, String(auditId), filename),
    path.join(process.cwd(), "public", "images", String(auditId), filename),
  ];

  for (const candidate of candidates) {
    if (!isValidImageFile(candidate)) continue;
    return migrateToCanonical(candidate, auditId, filename);
  }

  return null;
}

function saveBase64ImageData(base64Data: string, dir: string, filename: string): string | null {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < MIN_FILE_SIZE) return null;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Save data-URL reference images to disk for AI edit/generate calls. */
export function saveReferenceImageUrls(parentDir: string, urls: string[] | undefined, subdir = "edit_refs"): string[] {
  if (!urls?.length) return [];
  const dir = path.join(parentDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const saved: string[] = [];
  urls.forEach((img, idx) => {
    const ext = img.startsWith("data:image/png") ? "png" : "jpg";
    const filePath = saveBase64ImageData(img, dir, `ref_${Date.now()}_${idx}.${ext}`);
    if (filePath) saved.push(filePath);
  });
  return saved;
}
