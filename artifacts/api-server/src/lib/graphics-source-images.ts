import fs from "node:fs";
import path from "node:path";
import {
  resolveAuditImagePath,
  resolveGraphicsImagePath,
  graphicsImageDir,
  GRAPHICS_IMAGES_DIR,
} from "./image-storage.js";
import { eq } from "drizzle-orm";
import { auditsTable, db } from "@workspace/db";

const MIN_FILE_SIZE = 1024;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveBase64Image(base64Data: string, dir: string, filename: string): string | null {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < MIN_FILE_SIZE) return null;
  ensureDir(dir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function downloadImage(url: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_FILE_SIZE) return null;
    ensureDir(path.dirname(destPath));
    fs.writeFileSync(destPath, buffer);
    return destPath;
  } catch {
    return null;
  }
}

function parseGraphicsImageApiPath(raw: string): { projectId: number; filename: string } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/api\/images\/graphics\/(\d+)\/([^/?#]+)/i);
  if (!match) return null;
  const projectId = parseInt(match[1], 10);
  const filename = path.basename(decodeURIComponent(match[2] ?? ""));
  if (Number.isNaN(projectId) || !filename) return null;
  return { projectId, filename };
}

function parseAuditImageApiPath(raw: string): { auditId: number; filename: string } | null {
  const trimmed = raw.trim();
  if (trimmed.includes("/api/images/graphics/")) return null;
  const match = trimmed.match(/\/api\/images\/(\d+)\/([^/?#]+)/);
  if (!match) return null;
  const auditId = parseInt(match[1], 10);
  const filename = path.basename(match[2]);
  if (Number.isNaN(auditId) || !filename) return null;
  return { auditId, filename };
}

function isValidImageFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= MIN_FILE_SIZE;
}

function firstValidSourceInDir(sourceDir: string): string | null {
  if (!fs.existsSync(sourceDir)) return null;
  const names = fs.readdirSync(sourceDir).filter((n) => /^source_\d+\./i.test(n)).sort();
  for (const name of names) {
    const full = path.join(sourceDir, name);
    if (isValidImageFile(full)) return full;
  }
  for (const name of fs.readdirSync(sourceDir).sort()) {
    const full = path.join(sourceDir, name);
    if (isValidImageFile(full)) return full;
  }
  return null;
}

/** Resolve one stored URL/path to a local product file for graphics generation. */
export function resolveGraphicsProjectSourceFile(
  projectId: number,
  rawPath: string,
  auditId?: number | null,
  extraSourceDirs?: string[],
): string | null {
  const raw = rawPath?.trim();
  if (!raw) return null;

  if (raw.startsWith("data:image/")) {
    const projectDir = path.join(GRAPHICS_IMAGES_DIR, String(projectId), "source");
    const ext = raw.startsWith("data:image/png") ? "png" : "jpg";
    return saveBase64Image(raw, projectDir, `_resolve_tmp.${ext}`);
  }

  const graphicsApi = parseGraphicsImageApiPath(raw);
  if (graphicsApi) {
    const fromGraphics = resolveGraphicsImagePath(graphicsApi.projectId, raw);
    if (fromGraphics && isValidImageFile(fromGraphics)) return fromGraphics;
  }

  const auditApi = parseAuditImageApiPath(raw);
  if (auditApi) {
    const resolvedAuditId = auditId ?? auditApi.auditId;
    const fromAudit = resolveAuditImagePath(resolvedAuditId, raw);
    if (fromAudit && isValidImageFile(fromAudit)) return fromAudit;
  }

  const basename = path.basename(decodeURIComponent((raw.split("?")[0] ?? raw)));
  const sourceDirs: string[] = [];
  if (projectId > 0) sourceDirs.push(graphicsProjectSourceDir(projectId));
  if (extraSourceDirs?.length) sourceDirs.push(...extraSourceDirs);

  for (const sourceDir of sourceDirs) {
    for (const candidate of [
      path.join(sourceDir, basename),
      path.join(sourceDir, "source_0.jpg"),
      path.join(sourceDir, "source_0.png"),
    ]) {
      if (isValidImageFile(candidate)) return candidate;
    }
  }

  if (isValidImageFile(raw)) return raw;

  return null;
}

/** First resolvable product file from project sources, disk, or linked audit URLs. */
export async function resolvePrimaryGraphicsProductReference(
  projectId: number,
  sourceImagePaths: string[] | null | undefined,
  options?: { auditId?: number | null; extraPaths?: string[]; extraSourceDirs?: string[] },
): Promise<string | null> {
  const auditId = options?.auditId ?? null;
  const tryList = [
    ...(sourceImagePaths ?? []),
    ...(options?.extraPaths ?? []),
  ].filter(Boolean);

  for (const raw of tryList) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const downloadDir =
        projectId > 0
          ? path.join(GRAPHICS_IMAGES_DIR, String(projectId), "source")
          : options?.extraSourceDirs?.[0]
            ?? path.join(GRAPHICS_IMAGES_DIR, "_remote");
      ensureDir(downloadDir);
      const dest = path.join(downloadDir, `remote_${tryList.indexOf(raw)}.jpg`);
      const downloaded = await downloadImage(raw, dest);
      if (downloaded) return downloaded;
      continue;
    }
    const resolved = resolveGraphicsProjectSourceFile(
      projectId,
      raw,
      auditId,
      options?.extraSourceDirs,
    );
    if (resolved) return resolved;
  }

  if (projectId > 0) {
    const fromDisk = firstValidSourceInDir(graphicsProjectSourceDir(projectId));
    if (fromDisk) return fromDisk;
  }
  for (const dir of options?.extraSourceDirs ?? []) {
    const fromExtra = firstValidSourceInDir(dir);
    if (fromExtra) return fromExtra;
  }

  if (auditId) {
    const [audit] = await db
      .select({ imageUrls: auditsTable.imageUrls })
      .from(auditsTable)
      .where(eq(auditsTable.id, auditId))
      .limit(1);
    for (const url of audit?.imageUrls ?? []) {
      if (!url?.trim()) continue;
      const resolved = resolveGraphicsProjectSourceFile(
        projectId,
        url,
        auditId,
        options?.extraSourceDirs,
      );
      if (resolved) return resolved;
    }
  }

  return null;
}

/** Copy audit listing images into the project source folder when uploads were never persisted. */
export async function ensureGraphicsProjectSourcesFromAudit(
  projectId: number,
  auditId: number | null | undefined,
  currentSourceUrls: string[] | null | undefined,
): Promise<string[] | null> {
  const existing = await resolvePrimaryGraphicsProductReference(projectId, currentSourceUrls, { auditId });
  if (existing) return currentSourceUrls ?? null;
  if (!auditId) return currentSourceUrls ?? null;

  const [audit] = await db
    .select({ imageUrls: auditsTable.imageUrls })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);
  const urls = (audit?.imageUrls ?? []).filter((u) => u?.trim());
  if (urls.length === 0) return currentSourceUrls ?? null;

  const saved = await persistGraphicsProjectSourceImages(projectId, urls, { auditId });
  return saved.length > 0 ? saved : currentSourceUrls ?? null;
}

function copyFileIfValid(src: string, dest: string): string | null {
  if (!fs.existsSync(src) || fs.statSync(src).size < MIN_FILE_SIZE) return null;
  ensureDir(path.dirname(dest));
  if (src !== dest) fs.copyFileSync(src, dest);
  return dest;
}

/**
 * Persist upload-tab / audit reference images into a graphics project's source folder.
 * Returns filesystem paths stored on the graphics project row.
 */
export async function persistProductReferenceImagesToDir(
  images: string[],
  destinationDir: string,
  options?: { auditId?: number | null },
): Promise<string[]> {
  ensureDir(destinationDir);
  const savedPaths: string[] = [];
  const limited = images.filter(Boolean).slice(0, 10);

  for (let idx = 0; idx < limited.length; idx++) {
    const raw = limited[idx].trim();
    if (!raw) continue;

    const destName = `source_${idx}.jpg`;

    if (raw.startsWith("data:image/")) {
      const ext = raw.startsWith("data:image/png") ? "png" : "jpg";
      const saved = saveBase64Image(raw, destinationDir, `source_${idx}.${ext}`);
      if (saved) savedPaths.push(saved);
      continue;
    }

    const graphicsApi = parseGraphicsImageApiPath(raw);
    if (graphicsApi) {
      const resolved = resolveGraphicsImagePath(graphicsApi.projectId, raw);
      if (resolved) {
        const ext = path.extname(resolved) || ".jpg";
        const copied = copyFileIfValid(resolved, path.join(destinationDir, `source_${idx}${ext}`));
        if (copied) savedPaths.push(copied);
      }
      continue;
    }

    const apiPath = parseAuditImageApiPath(raw);
    if (apiPath) {
      const auditId = options?.auditId ?? apiPath.auditId;
      const resolved = resolveAuditImagePath(auditId, raw);
      if (resolved) {
        const ext = path.extname(resolved) || ".jpg";
        const copied = copyFileIfValid(resolved, path.join(destinationDir, `source_${idx}${ext}`));
        if (copied) savedPaths.push(copied);
      }
      continue;
    }

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const downloaded = await downloadImage(raw, path.join(destinationDir, destName));
      if (downloaded) savedPaths.push(downloaded);
      continue;
    }

    if (fs.existsSync(raw) && fs.statSync(raw).size >= MIN_FILE_SIZE) {
      savedPaths.push(raw);
    }
  }

  return savedPaths;
}

export async function persistGraphicsProjectSourceImages(
  projectId: number,
  images: string[],
  options?: { auditId?: number | null },
): Promise<string[]> {
  const projectDir = path.join(GRAPHICS_IMAGES_DIR, String(projectId), "source");
  return persistProductReferenceImagesToDir(images, projectDir, options);
}

export function graphicsProjectSourceDir(projectId: number): string {
  return path.join(graphicsImageDir(projectId), "source");
}
