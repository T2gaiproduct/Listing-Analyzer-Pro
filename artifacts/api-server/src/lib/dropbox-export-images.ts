import fs from "node:fs";
import path from "node:path";
import { repairCorruptedImageUrl, resolveAuditImagePath, resolveGraphicsImagePath } from "./image-storage.js";

function isProtectedAppImageUrl(url: string): boolean {
  return /\/api\/images\/(?:\d+|graphics\/\d+)\//i.test(url);
}

function isPublicRemoteImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.includes("data:image/")) return false;
  if (isProtectedAppImageUrl(trimmed)) return false;
  if (trimmed.includes("/api/marketplace-publish/images/")) return false;
  return true;
}

const uploadCache = new Map<string, string>();

export function readDropboxAccessToken(): string | null {
  const token = process.env.DROPBOX_ACCESS_TOKEN?.trim();
  return token || null;
}

export function isDropboxExcelExportEnabled(): boolean {
  return readDropboxAccessToken() != null;
}

export function isDropboxUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return lower.includes("dropbox.com") || lower.includes("dropboxusercontent.com");
}

/** Prefer direct image fetch for Excel / Amazon image columns. */
export function toDirectDropboxImageUrl(shareUrl: string): string {
  const trimmed = shareUrl.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "www.dropbox.com") {
      u.hostname = "dl.dropboxusercontent.com";
      u.searchParams.delete("dl");
      if (!u.searchParams.has("raw")) u.searchParams.set("raw", "1");
      return u.toString();
    }
    if (u.hostname.endsWith("dropboxusercontent.com") && !u.searchParams.has("raw")) {
      u.searchParams.set("raw", "1");
      return u.toString();
    }
    return trimmed;
  } catch {
    return trimmed
      .replace(/^https?:\/\/www\.dropbox\.com/i, "https://dl.dropboxusercontent.com")
      .replace(/\?dl=0\b/i, "?raw=1");
  }
}

function dropboxExportPrefix(): string {
  const raw = process.env.DROPBOX_EXPORT_PREFIX?.trim() || "/ecommerce-guru/exports";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function cacheKey(filePath: string): string {
  const stat = fs.statSync(filePath);
  return `${filePath}:${stat.mtimeMs}:${stat.size}`;
}

function resolveLocalImagePath(
  sourceUrl: string,
  auditId: number,
  graphicsProjectId?: number | null,
): string | null {
  const source = repairCorruptedImageUrl(sourceUrl);
  const graphicsMatch = source.match(/\/api\/images\/graphics\/(\d+)\/([^/?]+)/i);
  if (graphicsMatch) {
    const projectId = Number.parseInt(graphicsMatch[1]!, 10);
    const pid = Number.isFinite(projectId) ? projectId : graphicsProjectId;
    if (pid != null) return resolveGraphicsImagePath(pid, source);
  }
  const auditMatch = source.match(/\/api\/images\/(\d+)\/([^/?]+)/i);
  if (auditMatch && !source.includes("/graphics/")) {
    const id = Number.parseInt(auditMatch[1]!, 10);
    if (Number.isFinite(id)) return resolveAuditImagePath(id, source);
  }
  if (isProtectedAppImageUrl(source) || source.startsWith("/api/images/")) {
    return resolveAuditImagePath(auditId, source.startsWith("/") ? source : `/api/images/${auditId}/${path.basename(source)}`);
  }
  return null;
}

async function dropboxApi<T>(token: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error_summary: text };
  }
  if (!res.ok) {
    const summary =
      typeof data === "object" && data && "error_summary" in data
        ? String((data as { error_summary?: string }).error_summary)
        : text.slice(0, 200);
    throw new Error(summary || `Dropbox API ${res.status}`);
  }
  return data as T;
}

async function uploadLocalFile(token: string, localPath: string, dropboxPath: string): Promise<void> {
  const body = fs.readFileSync(localPath);
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText.slice(0, 300) || `Dropbox upload HTTP ${res.status}`);
  }
}

async function getOrCreateSharedLink(token: string, dropboxPath: string): Promise<string> {
  try {
    const created = await dropboxApi<{ url: string }>(
      token,
      "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
      {
        path: dropboxPath,
        settings: {
          requested_visibility: "public",
          audience: "public",
          access: "viewer",
        },
      },
    );
    if (created.url) return toDirectDropboxImageUrl(created.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/shared_link_already_exists|already_has_a_shared_link/i.test(msg)) {
      throw err;
    }
  }

  const listed = await dropboxApi<{ links: Array<{ url: string }> }>(
    token,
    "https://api.dropboxapi.com/2/sharing/list_shared_links",
    { path: dropboxPath, direct_only: true },
  );
  const existing = listed.links?.[0]?.url;
  if (!existing) {
    throw new Error("Dropbox shared link missing after upload");
  }
  return toDirectDropboxImageUrl(existing);
}

async function uploadBufferToDropbox(
  token: string,
  buffer: Buffer,
  dropboxPath: string,
): Promise<string> {
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: buffer,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText.slice(0, 300) || `Dropbox upload HTTP ${res.status}`);
  }
  return getOrCreateSharedLink(token, dropboxPath);
}

export async function ensureDropboxExportUrlForSource(opts: {
  auditId: number;
  sourceUrl: string;
  graphicsProjectId?: number | null;
  index: number;
}): Promise<string | null> {
  const token = readDropboxAccessToken();
  if (!token) return null;

  let source = repairCorruptedImageUrl(opts.sourceUrl);
  if (!source) return null;

  if (isDropboxUrl(source)) {
    return toDirectDropboxImageUrl(source);
  }

  const localPath = resolveLocalImagePath(source, opts.auditId, opts.graphicsProjectId);
  if (localPath) {
    const key = cacheKey(localPath);
    const cached = uploadCache.get(key);
    if (cached) return cached;

    const filename = path.basename(localPath);
    const dropboxPath = `${dropboxExportPrefix()}/audit-${opts.auditId}/${opts.index}_${filename}`;
    await uploadLocalFile(token, localPath, dropboxPath);
    const url = await getOrCreateSharedLink(token, dropboxPath);
    uploadCache.set(key, url);
    return url;
  }

  if (isPublicRemoteImageUrl(source)) {
    const res = await fetch(source, { redirect: "follow" });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1024) return null;
    const ext = path.extname(new URL(source).pathname) || ".jpg";
    const dropboxPath = `${dropboxExportPrefix()}/audit-${opts.auditId}/${opts.index}_remote${ext}`;
    return uploadBufferToDropbox(token, buffer, dropboxPath);
  }

  return null;
}

/** Clear in-memory upload cache (tests). */
export function clearDropboxExportUploadCache(): void {
  uploadCache.clear();
}
