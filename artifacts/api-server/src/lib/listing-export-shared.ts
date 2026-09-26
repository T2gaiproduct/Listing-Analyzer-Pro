import fs from "node:fs";
import path from "node:path";
import type { Audit, GeneratedContent, ImageRecord } from "@workspace/db";
import type { AplusModule, AplusStoredState } from "./aplus-generator.js";
import {
  extractEmbeddedDataImageUrl,
  repairCorruptedImageUrl,
  resolveAuditImagePath,
  resolveGraphicsImagePath,
} from "./image-storage.js";

export interface ExportImageAsset {
  id: string;
  sourceUrl: string;
  absoluteUrl: string;
  zipPath: string;
  kind: "main" | "other" | "aplus";
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Listing description for Amazon flat-file / export preview — always HTML when the source is HTML.
 * Never downgrade to plain text (image columns stay URLs separately).
 * When over a visible-character cap, return truncated HTML (wrapped paragraph), not stripped text.
 */
export function htmlForListingExport(html: string, maxVisibleChars?: number): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  if (!looksLikeHtml) {
    const escaped = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const paragraphs = escaped.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const wrapped = paragraphs.length > 0
      ? paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("\n")
      : `<p>${escaped}</p>`;
    return htmlForListingExport(wrapped, maxVisibleChars);
  }
  if (maxVisibleChars == null) return trimmed;
  const visible = stripHtml(trimmed);
  if (visible.length <= maxVisibleChars) return trimmed;
  const cut = truncate(visible, maxVisibleChars);
  const escaped = cut
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "listing";
}

export function readGeneratedContent(audit: Audit): GeneratedContent | null {
  if (!audit.generatedContent) return null;
  const gc = audit.generatedContent as GeneratedContent;
  if (!gc.title?.trim()) return null;
  return gc;
}

function readLegacyImages(audit: Audit) {
  return (audit.generatedImages ?? { main: [], infographic: [], lifestyle: [] }) as {
    main?: string[];
    infographic?: string[];
    lifestyle?: string[];
    aplus?: AplusStoredState;
  };
}

function isAppGeneratedImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.includes("/api/images/")) return true;
  if (trimmed.includes("/api/marketplace-publish/images/")) return true;
  return !/^https?:\/\//i.test(trimmed);
}

function generatedImageFilename(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  return withoutQuery.split("/").pop() ?? "";
}

/** SellerLens-generated listing graphics (excludes scrape uploads, sources, A+). */
export function isGeneratedExportImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("/api/images/graphics/")) return true;
  if (!isAppGeneratedImageUrl(trimmed)) return false;

  const name = generatedImageFilename(trimmed).toLowerCase();
  if (!name) return false;
  if (name.startsWith("source_") || name.includes("aplus_source") || name.startsWith("edit_ref")) {
    return false;
  }
  if (/^publish_\d+_\d+\.[a-z0-9]+$/i.test(name)) return false;
  if (/^(lifestyle|feature|main|infographic)_/i.test(name)) return true;
  if (name.startsWith("aplus_")) return false;
  return false;
}

function isGeneratedExportImageRecord(record: ImageRecord): boolean {
  const url = record.currentUrl?.trim() ?? "";
  if (!url) return false;
  const type = record.type?.toLowerCase() ?? "";
  if (type === "source" || type === "upload") return false;
  if (["lifestyle", "feature", "infographic", "main"].includes(type)) {
    return isGeneratedExportImageUrl(url);
  }
  return isGeneratedExportImageUrl(url);
}

export function collectProductImages(audit: Audit, graphicsImageRecords?: ImageRecord[]): { url: string; type: string }[] {
  const seen = new Set<string>();
  const out: { url: string; type: string }[] = [];

  const push = (url: string | undefined | null, type: string) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ url: trimmed, type });
  };

  const auditRecords = (audit.imageRecords as ImageRecord[] | null) ?? [];
  const sortedRecords = [...auditRecords].sort((a, b) => {
    const order = { main: 0, lifestyle: 1, infographic: 2 };
    return (order[a.type as keyof typeof order] ?? 3) - (order[b.type as keyof typeof order] ?? 3) || a.index - b.index;
  });
  for (const record of sortedRecords) push(record.currentUrl, record.type);

  if (graphicsImageRecords?.length) {
    for (const record of graphicsImageRecords) push(record.currentUrl, record.type);
  }

  const legacy = readLegacyImages(audit);
  for (const url of legacy.main ?? []) push(url, "main");
  for (const url of legacy.lifestyle ?? []) push(url, "lifestyle");
  for (const url of legacy.infographic ?? []) push(url, "infographic");
  for (const url of audit.imageUrls ?? []) push(url, "source");

  return out;
}

/** Amazon/Excel export: generated graphics only (no scraped listing / upload URLs). */
export function collectGeneratedProductImages(
  audit: Audit,
  graphicsImageRecords?: ImageRecord[],
): { url: string; type: string }[] {
  const seen = new Set<string>();
  const out: { url: string; type: string }[] = [];

  const push = (url: string | undefined | null, type: string) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed) || !isGeneratedExportImageUrl(trimmed)) return;
    seen.add(trimmed);
    out.push({ url: trimmed, type });
  };

  const auditRecords = (audit.imageRecords as ImageRecord[] | null) ?? [];
  const sortedRecords = [...auditRecords].sort((a, b) => {
    const order = { main: 0, lifestyle: 1, feature: 2, infographic: 2 };
    return (order[a.type as keyof typeof order] ?? 3) - (order[b.type as keyof typeof order] ?? 3) || a.index - b.index;
  });
  for (const record of sortedRecords) {
    if (isGeneratedExportImageRecord(record)) {
      push(record.currentUrl, record.type);
    }
  }

  if (graphicsImageRecords?.length) {
    for (const record of graphicsImageRecords) {
      if (isGeneratedExportImageRecord(record)) {
        push(record.currentUrl, record.type);
      }
    }
  }

  const legacy = readLegacyImages(audit);
  for (const url of legacy.main ?? []) push(url, "main");
  for (const url of legacy.lifestyle ?? []) push(url, "lifestyle");
  for (const url of legacy.infographic ?? []) push(url, "infographic");

  return out;
}

export function collectAplusImages(audit: Audit): { url: string; moduleId: string }[] {
  const aplus = readLegacyImages(audit).aplus;
  const modules = aplus?.modules ?? [];
  return modules
    .filter((m): m is AplusModule => Boolean(m.imageUrl?.trim()))
    .map((m) => ({ url: m.imageUrl.trim(), moduleId: m.id }));
}

export function toAbsoluteAssetUrl(url: string, publicBaseUrl?: string): string {
  const trimmed = repairCorruptedImageUrl(url.trim());
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (!publicBaseUrl) return trimmed;
  const base = publicBaseUrl.replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

export function buildProductImageAssets(
  productImages: { url: string; type: string }[],
  publicBaseUrl?: string,
): ExportImageAsset[] {
  return productImages.map((img, index) => {
    const ext = path.extname(img.url.split("?")[0] ?? "") || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const zipName = index === 0 ? `main${safeExt}` : `other-${String(index).padStart(2, "0")}${safeExt}`;
    const zipPath = `images/${zipName}`;
    return {
      id: `product-${index}`,
      sourceUrl: img.url,
      absoluteUrl: toAbsoluteAssetUrl(img.url, publicBaseUrl),
      zipPath,
      kind: index === 0 ? "main" : "other",
    };
  });
}

export function buildAplusImageAssets(
  aplusImages: { url: string; moduleId: string }[],
  publicBaseUrl?: string,
): ExportImageAsset[] {
  return aplusImages.map((img) => {
    const ext = path.extname(img.url.split("?")[0] ?? "") || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const zipPath = `aplus/${img.moduleId}${safeExt}`;
    return {
      id: `aplus-${img.moduleId}`,
      sourceUrl: img.url,
      absoluteUrl: toAbsoluteAssetUrl(img.url, publicBaseUrl),
      zipPath,
      kind: "aplus",
    };
  });
}

export async function loadImageBuffer(opts: {
  auditId: number;
  sourceUrl: string;
  graphicsProjectId?: number | null;
}): Promise<Buffer | null> {
  let url = extractEmbeddedDataImageUrl(opts.sourceUrl) ?? opts.sourceUrl.trim();
  if (!url) return null;

  if (url.startsWith("data:image/")) {
    const base64 = url.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    return buf.length >= 1024 ? buf : null;
  }

  const graphicsMatch = url.match(/\/api\/images\/graphics\/(\d+)\/([^/?]+)/);
  if (graphicsMatch) {
    const projectId = Number.parseInt(graphicsMatch[1]!, 10);
    const local = resolveGraphicsImagePath(projectId, url);
    if (local) return fs.readFileSync(local);
  }

  const auditMatch = url.match(/\/api\/images\/(\d+)\/([^/?]+)/);
  if (auditMatch) {
    const auditId = Number.parseInt(auditMatch[1]!, 10);
    const local = resolveAuditImagePath(auditId, url);
    if (local) return fs.readFileSync(local);
  }

  const localFromAudit = resolveAuditImagePath(opts.auditId, url);
  if (localFromAudit) return fs.readFileSync(localFromAudit);

  if (opts.graphicsProjectId) {
    const local = resolveGraphicsImagePath(opts.graphicsProjectId, url);
    if (local) return fs.readFileSync(local);
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const arr = await resp.arrayBuffer();
      const buf = Buffer.from(arr);
      return buf.length >= 1024 ? buf : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function appendImagesToZip(opts: {
  archive: { append: (source: Buffer, opts: { name: string }) => void };
  images: ExportImageAsset[];
  auditId: number;
  graphicsProjectId?: number | null;
}): Promise<void> {
  for (const asset of opts.images) {
    const buffer = await loadImageBuffer({
      auditId: opts.auditId,
      sourceUrl: asset.sourceUrl,
      graphicsProjectId: opts.graphicsProjectId,
    });
    if (buffer) opts.archive.append(buffer, { name: asset.zipPath });
  }
}
