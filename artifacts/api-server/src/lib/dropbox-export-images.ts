import fs from "node:fs";
import path from "node:path";
import {
  DropboxOAuthError,
  getDropboxBearerTokenForExport,
  hasDropboxRefreshTokenConfig,
  invalidateDropboxAccessTokenCache,
  isDropboxExcelExportEnabled,
  readDropboxAccessToken,
  resetDropboxOAuthStateForTests,
  sanitizeDropboxErrorMessage,
} from "./dropbox-oauth.js";
import { toDirectDropboxImageUrl } from "./dropbox-export-url.js";
import { repairCorruptedImageUrl, resolveAuditImagePath, resolveGraphicsImagePath } from "./image-storage.js";

export {
  getDropboxBearerTokenForExport,
  hasDropboxRefreshTokenConfig,
  isDropboxExcelExportEnabled,
  readDropboxAccessToken,
} from "./dropbox-oauth.js";
export { toDirectDropboxImageUrl } from "./dropbox-export-url.js";

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

function isDropboxExpiredAuthError(message: string): boolean {
  return /expired_access_token|invalid_access_token/i.test(message);
}

function mapDropboxApiError(status: number, summary: string): Error {
  const safe = sanitizeDropboxErrorMessage(summary);
  if (/insufficient_scope|missing_scope|not authorized/i.test(safe)) {
    return new Error(
      `${safe} — Dropbox app needs files.content.write and sharing.write. Update app permissions and re-run offline OAuth.`,
    );
  }
  if (status === 401 || isDropboxExpiredAuthError(safe)) {
    if (!hasDropboxRefreshTokenConfig()) {
      return new Error(
        `${safe} — Use DROPBOX_REFRESH_TOKEN with DROPBOX_APP_KEY and DROPBOX_APP_SECRET (see DEPLOY.md).`,
      );
    }
    return new DropboxOAuthError(safe || "Dropbox auth rejected", status);
  }
  if (/sharing|shared_link|public/i.test(safe) && status >= 400) {
    return new Error(`${safe} — Check Dropbox sharing.write scope and link visibility settings.`);
  }
  return new Error(safe || `Dropbox API error (${status})`);
}

async function dropboxApi<T>(
  token: string,
  url: string,
  body: unknown,
  allowRetry: boolean,
): Promise<T> {
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
        : text;
    if (allowRetry && hasDropboxRefreshTokenConfig() && isDropboxExpiredAuthError(summary)) {
      invalidateDropboxAccessTokenCache();
      const nextToken = await getDropboxBearerTokenForExport();
      return dropboxApi<T>(nextToken, url, body, false);
    }
    throw mapDropboxApiError(res.status, summary);
  }
  return data as T;
}

async function dropboxApiWithBearer<T>(url: string, body: unknown): Promise<T> {
  const token = await getDropboxBearerTokenForExport();
  return dropboxApi<T>(token, url, body, true);
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
    let summary = errText;
    try {
      const parsed = JSON.parse(errText) as { error_summary?: string };
      summary = parsed.error_summary ?? errText;
    } catch {
      /* keep raw */
    }
    throw mapDropboxApiError(res.status, summary);
  }
}

async function uploadLocalFileWithBearer(localPath: string, dropboxPath: string): Promise<void> {
  const token = await getDropboxBearerTokenForExport();
  try {
    await uploadLocalFile(token, localPath, dropboxPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (hasDropboxRefreshTokenConfig() && isDropboxExpiredAuthError(msg)) {
      invalidateDropboxAccessTokenCache();
      const next = await getDropboxBearerTokenForExport();
      await uploadLocalFile(next, localPath, dropboxPath);
      return;
    }
    throw err;
  }
}

async function getOrCreateSharedLink(dropboxPath: string): Promise<string> {
  try {
    const created = await dropboxApiWithBearer<{ url: string }>(
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

  const listed = await dropboxApiWithBearer<{ links: Array<{ url: string }> }>(
    "https://api.dropboxapi.com/2/sharing/list_shared_links",
    { path: dropboxPath, direct_only: true },
  );
  const existing = listed.links?.[0]?.url;
  if (!existing) {
    throw new Error("Dropbox shared link missing after upload");
  }
  return toDirectDropboxImageUrl(existing);
}

async function uploadBufferToDropbox(buffer: Buffer, dropboxPath: string): Promise<string> {
  const token = await getDropboxBearerTokenForExport();
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
    throw mapDropboxApiError(res.status, errText.slice(0, 300));
  }
  return getOrCreateSharedLink(dropboxPath);
}

export function isDropboxUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return lower.includes("dropbox.com") || lower.includes("dropboxusercontent.com");
}

export async function ensureDropboxExportUrlForSource(opts: {
  auditId: number;
  sourceUrl: string;
  graphicsProjectId?: number | null;
  index: number;
}): Promise<string | null> {
  if (!isDropboxExcelExportEnabled()) return null;

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
    await uploadLocalFileWithBearer(localPath, dropboxPath);
    const url = await getOrCreateSharedLink(dropboxPath);
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
    return uploadBufferToDropbox(buffer, dropboxPath);
  }

  return null;
}

/** Clear in-memory upload cache (tests). */
export function clearDropboxExportUploadCache(): void {
  uploadCache.clear();
  resetDropboxOAuthStateForTests();
}
