import fs from "node:fs";
import path from "node:path";
import type { Audit, GeneratedContent, ImageRecord } from "@workspace/db";
import type { AplusModule, AplusStoredState } from "./aplus-generator.js";
import { GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./image-storage.js";

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
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
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

export function collectAplusImages(audit: Audit): { url: string; moduleId: string }[] {
  const aplus = readLegacyImages(audit).aplus;
  const modules = aplus?.modules ?? [];
  return modules
    .filter((m): m is AplusModule => Boolean(m.imageUrl?.trim()))
    .map((m) => ({ url: m.imageUrl.trim(), moduleId: m.id }));
}

export function toAbsoluteAssetUrl(url: string, publicBaseUrl?: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!publicBaseUrl) return url;
  const base = publicBaseUrl.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
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

function resolveGraphicsImagePath(projectId: number, imageUrl: string): string | null {
  const filename = path.basename((imageUrl.split("?")[0] ?? imageUrl));
  const candidate = path.join(GRAPHICS_IMAGES_DIR, String(projectId), filename);
  if (fs.existsSync(candidate) && fs.statSync(candidate).size >= 1024) return candidate;
  const sourceCandidate = path.join(GRAPHICS_IMAGES_DIR, String(projectId), "source", filename);
  if (fs.existsSync(sourceCandidate) && fs.statSync(sourceCandidate).size >= 1024) return sourceCandidate;
  return null;
}

export async function loadImageBuffer(opts: {
  auditId: number;
  sourceUrl: string;
  graphicsProjectId?: number | null;
}): Promise<Buffer | null> {
  const url = opts.sourceUrl.trim();
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
