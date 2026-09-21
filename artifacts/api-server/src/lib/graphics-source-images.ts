import fs from "node:fs";
import path from "node:path";
import { resolveAuditImagePath, graphicsImageDir, GRAPHICS_IMAGES_DIR } from "./image-storage.js";

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

function parseAuditImageApiPath(raw: string): { auditId: number; filename: string } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/api\/images\/(\d+)\/([^/?#]+)/);
  if (!match) return null;
  const auditId = parseInt(match[1], 10);
  const filename = path.basename(match[2]);
  if (Number.isNaN(auditId) || !filename) return null;
  return { auditId, filename };
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
export async function persistGraphicsProjectSourceImages(
  projectId: number,
  images: string[],
  options?: { auditId?: number | null },
): Promise<string[]> {
  const projectDir = path.join(GRAPHICS_IMAGES_DIR, String(projectId), "source");
  ensureDir(projectDir);
  const savedPaths: string[] = [];
  const limited = images.filter(Boolean).slice(0, 10);

  for (let idx = 0; idx < limited.length; idx++) {
    const raw = limited[idx].trim();
    if (!raw) continue;

    const destName = `source_${idx}.jpg`;

    if (raw.startsWith("data:image/")) {
      const ext = raw.startsWith("data:image/png") ? "png" : "jpg";
      const saved = saveBase64Image(raw, projectDir, `source_${idx}.${ext}`);
      if (saved) savedPaths.push(saved);
      continue;
    }

    const apiPath = parseAuditImageApiPath(raw);
    if (apiPath) {
      const auditId = options?.auditId ?? apiPath.auditId;
      const resolved = resolveAuditImagePath(auditId, raw);
      if (resolved) {
        const ext = path.extname(resolved) || ".jpg";
        const copied = copyFileIfValid(resolved, path.join(projectDir, `source_${idx}${ext}`));
        if (copied) savedPaths.push(copied);
      }
      continue;
    }

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const downloaded = await downloadImage(raw, path.join(projectDir, destName));
      if (downloaded) savedPaths.push(downloaded);
      continue;
    }

    if (fs.existsSync(raw) && fs.statSync(raw).size >= MIN_FILE_SIZE) {
      savedPaths.push(raw);
    }
  }

  return savedPaths;
}

export function graphicsProjectSourceDir(projectId: number): string {
  return path.join(graphicsImageDir(projectId), "source");
}
