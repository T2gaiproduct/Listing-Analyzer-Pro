import { eq } from "drizzle-orm";
import path from "node:path";
import { auditsTable, db, type ReferenceResearchData } from "@workspace/db";
import { persistProductReferenceImagesToDir } from "./graphics-source-images.js";
import { ensureAuditImageDir, imageUrlPath, resolveAuditImagePath } from "./image-storage.js";
import { fetchListing } from "./listing-fetcher.js";

function normalizeListingImageUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.slice(0, 10);
}

function hasRemoteListingUrls(urls: string[]): boolean {
  return urls.some((u) => {
    const t = u.trim();
    return /^https?:\/\//i.test(t) && !t.includes("/api/images/");
  });
}

function isAmazonAsin(value: string | null | undefined): boolean {
  return /^[A-Z0-9]{10}$/i.test(value?.trim() ?? "");
}

export function resolveAuditImportSourceUrl(audit: {
  asin?: string | null;
  referenceResearch?: ReferenceResearchData | null;
}): { asin?: string; url?: string } | null {
  const slotUrl = audit.referenceResearch?.slots?.[0]?.url?.trim();
  if (slotUrl && /^https?:\/\//i.test(slotUrl)) {
    return { url: slotUrl };
  }
  const asin = audit.asin?.trim();
  if (asin && isAmazonAsin(asin)) {
    return { asin };
  }
  return null;
}

/**
 * Download import / Amazon gallery URLs into public/images/{auditId}/ and store app URLs on the audit.
 */
export async function materializeAndPersistAuditListingImages(
  auditId: number,
  imageUrls: string[] | null | undefined,
): Promise<string[]> {
  const limited = normalizeListingImageUrls(imageUrls ?? []);
  if (limited.length === 0) return [];

  const dir = ensureAuditImageDir(auditId);
  const kept: string[] = [];
  const toDownload: string[] = [];

  for (const raw of limited) {
    const trimmed = raw.trim();
    if (trimmed.includes("/api/images/") && resolveAuditImagePath(auditId, trimmed)) {
      kept.push(trimmed.split("?")[0]!);
      continue;
    }
    if (/^https?:\/\//i.test(trimmed) && !trimmed.includes("/api/images/")) {
      toDownload.push(trimmed);
      continue;
    }
    if (trimmed.startsWith("data:image/")) {
      toDownload.push(trimmed);
    }
  }

  const saved = toDownload.length
    ? await persistProductReferenceImagesToDir(toDownload, dir, { auditId })
    : [];
  const downloadedApi = saved.map((filePath) => imageUrlPath(auditId, path.basename(filePath)));

  const merged = normalizeListingImageUrls([...kept, ...downloadedApi]);
  if (merged.length === 0) return limited;

  const shouldWriteDb = merged.length > 0 && (toDownload.length > 0 || hasRemoteListingUrls(limited));
  if (shouldWriteDb) {
    await db
      .update(auditsTable)
      .set({ imageUrls: merged, updatedAt: new Date() })
      .where(eq(auditsTable.id, auditId));
  }

  return merged;
}

/** Re-scrape Amazon / import URL gallery and persist images locally when the listing source is known. */
export async function refreshAuditListingImagesFromImportSource(auditId: number): Promise<string[] | null> {
  const [audit] = await db
    .select({
      asin: auditsTable.asin,
      imageUrls: auditsTable.imageUrls,
      referenceResearch: auditsTable.referenceResearch,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);
  if (!audit) return null;

  const source = resolveAuditImportSourceUrl(audit);
  if (!source) return null;

  try {
    const listing = await fetchListing({
      asin: source.asin,
      url: source.url,
    });
    const fetched = normalizeListingImageUrls(listing.imageUrls ?? []);
    if (fetched.length === 0) return null;
    return materializeAndPersistAuditListingImages(auditId, fetched);
  } catch (err) {
    console.warn(
      `[refreshAuditListingImagesFromImportSource] audit ${auditId}:`,
      err instanceof Error ? err.message : err,
    );
    const existing = normalizeListingImageUrls((audit.imageUrls as string[] | null) ?? []);
    if (existing.length === 0) return null;
    return materializeAndPersistAuditListingImages(auditId, existing);
  }
}