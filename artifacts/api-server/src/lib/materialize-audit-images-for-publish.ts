import { eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, auditsTable } from "@workspace/db";
import { collectProductImages } from "./listing-export-shared.js";
import { buildSignedPublishImageUrl } from "./marketplace-publish-image-token.js";
import { persistDataUrlAsAuditImage } from "./image-storage.js";

export function isDataImageUrl(url: string): boolean {
  return url.trim().startsWith("data:image/");
}

export function isProtectedAppImageUrl(url: string): boolean {
  return /\/api\/images\/(?:\d+|graphics\/\d+)\//i.test(url);
}

export function isPublicRemoteImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.includes("data:image/")) return false;
  if (isProtectedAppImageUrl(trimmed)) return false;
  return true;
}

export function resolvePublishImageCandidate(opts: {
  auditId: number;
  sourceUrl: string;
  publicBaseUrl?: string;
  graphicsProjectId?: number | null;
  index: number;
}): string | null {
  let source = opts.sourceUrl.trim();
  if (!source) return null;

  if (isDataImageUrl(source)) {
    const persisted = persistDataUrlAsAuditImage(opts.auditId, source, opts.index);
    if (!persisted) return null;
    source = persisted;
  }

  if (isPublicRemoteImageUrl(source)) return source;

  if ((isProtectedAppImageUrl(source) || source.startsWith("/api/images/")) && opts.publicBaseUrl?.trim()) {
    const signed = buildSignedPublishImageUrl({
      publicBaseUrl: opts.publicBaseUrl,
      auditId: opts.auditId,
      sourceUrl: source,
      graphicsProjectId: opts.graphicsProjectId,
    });
    if (signed) return signed;
  }

  return null;
}

export async function materializeAuditImagesForPublish(audit: Audit): Promise<Audit> {
  const imageUrls = [...((audit.imageUrls as string[] | null) ?? [])];
  const imageRecords = [...((audit.imageRecords as ImageRecord[] | null) ?? [])];
  let changed = false;

  const nextUrls = imageUrls.map((url, index) => {
    if (!isDataImageUrl(url)) return url;
    const persisted = persistDataUrlAsAuditImage(audit.id, url, index);
    if (!persisted) return url;
    changed = true;
    return persisted;
  });

  const nextRecords = imageRecords.map((record, index) => {
    const currentUrl = record.currentUrl?.trim();
    if (!currentUrl || !isDataImageUrl(currentUrl)) return record;
    const persisted = persistDataUrlAsAuditImage(audit.id, currentUrl, 100 + index);
    if (!persisted) return record;
    changed = true;
    return { ...record, currentUrl: persisted };
  });

  if (!changed) return audit;

  await db
    .update(auditsTable)
    .set({
      imageUrls: nextUrls,
      imageRecords: nextRecords,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, audit.id));

  return {
    ...audit,
    imageUrls: nextUrls,
    imageRecords: nextRecords,
  };
}

export function resolvePublishImageUrlsFromAudit(opts: {
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
  maxImages?: number;
}): string[] {
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const max = opts.maxImages ?? 9;
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const [index, img] of productImages.entries()) {
    if (resolved.length >= max) break;
    const url = resolvePublishImageCandidate({
      auditId: opts.audit.id,
      sourceUrl: img.url,
      publicBaseUrl: opts.publicBaseUrl,
      graphicsProjectId: opts.graphicsProjectId,
      index,
    });
    if (url && !seen.has(url)) {
      resolved.push(url);
      seen.add(url);
    }
  }

  return resolved;
}
