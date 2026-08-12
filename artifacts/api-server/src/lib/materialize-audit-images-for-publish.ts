import { eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, auditsTable } from "@workspace/db";
import { collectProductImages } from "./listing-export-shared.js";
import { buildSignedPublishImageUrl } from "./marketplace-publish-image-token.js";
import { extractEmbeddedDataImageUrl, persistDataUrlAsAuditImage, repairCorruptedImageUrl } from "./image-storage.js";

export { extractEmbeddedDataImageUrl, repairCorruptedImageUrl } from "./image-storage.js";

export function isDataImageUrl(url: string): boolean {
  return extractEmbeddedDataImageUrl(url) !== null;
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

/** Reject malformed marketplace image URLs (e.g. base URL prefixed onto data:image). */
export function sanitizeMarketplacePublishImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.includes("data:image/")) return null;
  if (/;base64,/i.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function isSafeMarketplacePublishImageUrl(url: string | null | undefined): url is string {
  return sanitizeMarketplacePublishImageUrl(url) != null;
}

export function resolvePublishImageCandidate(opts: {
  auditId: number;
  sourceUrl: string;
  publicBaseUrl?: string;
  graphicsProjectId?: number | null;
  index: number;
}): string | null {
  let source = repairCorruptedImageUrl(opts.sourceUrl);
  if (!source) return null;

  const embeddedDataUrl = extractEmbeddedDataImageUrl(source);
  if (embeddedDataUrl) {
    const persisted = persistDataUrlAsAuditImage(opts.auditId, embeddedDataUrl, opts.index);
    if (!persisted) return null;
    source = persisted;
  }

  if (isPublicRemoteImageUrl(source)) {
    return sanitizeMarketplacePublishImageUrl(source);
  }

  if ((isProtectedAppImageUrl(source) || source.startsWith("/api/images/")) && opts.publicBaseUrl?.trim()) {
    const signed = buildSignedPublishImageUrl({
      publicBaseUrl: opts.publicBaseUrl,
      auditId: opts.auditId,
      sourceUrl: source,
      graphicsProjectId: opts.graphicsProjectId,
    });
    return sanitizeMarketplacePublishImageUrl(signed);
  }

  return null;
}

export async function materializeAuditImagesForPublish(audit: Audit): Promise<Audit> {
  const imageUrls = [...((audit.imageUrls as string[] | null) ?? [])];
  const imageRecords = [...((audit.imageRecords as ImageRecord[] | null) ?? [])];
  let changed = false;

  const persistInlineImage = (url: string, index: number): string => {
    const repaired = repairCorruptedImageUrl(url);
    const embedded = extractEmbeddedDataImageUrl(repaired);
    if (!embedded) return repaired;
    const persisted = persistDataUrlAsAuditImage(audit.id, embedded, index);
    if (!persisted) return url;
    changed = true;
    return persisted;
  };

  const nextUrls = imageUrls.map((url, index) => persistInlineImage(url, index));

  const nextRecords = imageRecords.map((record, index) => {
    const currentUrl = record.currentUrl?.trim();
    if (!currentUrl) return record;
    const persisted = persistInlineImage(currentUrl, 100 + index);
    if (persisted === currentUrl) return record;
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
    const safe = sanitizeMarketplacePublishImageUrl(url);
    if (safe && !seen.has(safe)) {
      resolved.push(safe);
      seen.add(safe);
    }
  }

  return resolved;
}
