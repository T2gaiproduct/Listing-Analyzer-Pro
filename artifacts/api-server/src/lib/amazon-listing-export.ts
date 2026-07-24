import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import type { Audit, GeneratedContent, ImageRecord } from "@workspace/db";
import type { AplusModule, AplusStoredState } from "./aplus-generator.js";
import { resolveAmazonMarketplace, type AmazonMarketplaceId } from "./amazon-marketplaces.js";
import { GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./image-storage.js";

/** Amazon Inventory Loader–style columns (compatible across marketplaces). */
export const AMAZON_FLAT_FILE_HEADERS = [
  "marketplace",
  "item_sku",
  "external_product_id",
  "external_product_id_type",
  "item_name",
  "brand_name",
  "manufacturer",
  "product_description",
  "bullet_point1",
  "bullet_point2",
  "bullet_point3",
  "bullet_point4",
  "bullet_point5",
  "generic_keywords",
  "main_image_url",
  "other_image_url1",
  "other_image_url2",
  "other_image_url3",
  "other_image_url4",
  "other_image_url5",
  "other_image_url6",
  "other_image_url7",
  "other_image_url8",
  "feed_product_type",
  "item_type",
] as const;

export type AmazonFlatFileRow = Record<(typeof AMAZON_FLAT_FILE_HEADERS)[number], string>;

export interface ExportImageAsset {
  id: string;
  sourceUrl: string;
  zipPath: string;
  kind: "main" | "other" | "aplus";
}

export interface AuditExportBundle {
  marketplace: ReturnType<typeof resolveAmazonMarketplace>;
  row: AmazonFlatFileRow;
  images: ExportImageAsset[];
  filenameBase: string;
}

const TITLE_MAX = 200;
const BULLET_MAX = 500;
const KEYWORDS_MAX = 250;
const DESCRIPTION_MAX = 2000;

function stripHtml(html: string): string {
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

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "listing";
}

function readGeneratedContent(audit: Audit): GeneratedContent | null {
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

function collectProductImages(audit: Audit, graphicsImageRecords?: ImageRecord[]): { url: string; type: string }[] {
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

function collectAplusImages(audit: Audit): { url: string; moduleId: string }[] {
  const aplus = readLegacyImages(audit).aplus;
  const modules = aplus?.modules ?? [];
  return modules
    .filter((m): m is AplusModule => Boolean(m.imageUrl?.trim()))
    .map((m) => ({ url: m.imageUrl.trim(), moduleId: m.id }));
}

export function buildAuditExportBundle(opts: {
  audit: Audit;
  marketplaceId?: string | null;
  graphicsImageRecords?: ImageRecord[];
  imageUrlMode?: "absolute" | "relative";
  publicBaseUrl?: string;
}): AuditExportBundle {
  const content = readGeneratedContent(opts.audit);
  if (!content) {
    throw new Error("Listing content not generated yet. Complete the Listing step before exporting.");
  }

  const marketplace = resolveAmazonMarketplace(opts.marketplaceId);
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const aplusImages = collectAplusImages(opts.audit);

  const sku = `SL-${opts.audit.id}`;
  const brand = opts.audit.brandName?.trim() || opts.audit.productName?.trim() || "Brand";
  const bullets = [...content.bulletPoints].slice(0, 5);
  while (bullets.length < 5) bullets.push("");

  const keywords = truncate(content.keywords.join(" ").replace(/\s+/g, " "), KEYWORDS_MAX);
  const description = truncate(stripHtml(content.htmlDescription || ""), DESCRIPTION_MAX);

  const imageAssets: ExportImageAsset[] = [];
  const imageUrlColumns: string[] = ["", "", "", "", "", "", "", "", ""];

  productImages.forEach((img, index) => {
    const ext = path.extname(img.url.split("?")[0] ?? "") || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const zipName = index === 0 ? `main${safeExt}` : `other-${String(index).padStart(2, "0")}${safeExt}`;
    const zipPath = `images/${zipName}`;
    imageAssets.push({
      id: `product-${index}`,
      sourceUrl: img.url,
      zipPath,
      kind: index === 0 ? "main" : "other",
    });
    const columnValue = opts.imageUrlMode === "relative"
      ? zipPath
      : toAbsoluteAssetUrl(img.url, opts.publicBaseUrl);
    if (index === 0) imageUrlColumns[0] = columnValue;
    else if (index <= 8) imageUrlColumns[index] = columnValue;
  });

  aplusImages.forEach((img, index) => {
    const ext = path.extname(img.url.split("?")[0] ?? "") || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const zipPath = `aplus/${img.moduleId}${safeExt}`;
    imageAssets.push({
      id: `aplus-${img.moduleId}`,
      sourceUrl: img.url,
      zipPath,
      kind: "aplus",
    });
  });

  const row: AmazonFlatFileRow = {
    marketplace: marketplace.siteCode,
    item_sku: sku,
    external_product_id: opts.audit.asin?.trim() ?? "",
    external_product_id_type: opts.audit.asin?.trim() ? "ASIN" : "",
    item_name: truncate(content.title, TITLE_MAX),
    brand_name: truncate(brand, 100),
    manufacturer: truncate(brand, 100),
    product_description: description,
    bullet_point1: truncate(bullets[0] ?? "", BULLET_MAX),
    bullet_point2: truncate(bullets[1] ?? "", BULLET_MAX),
    bullet_point3: truncate(bullets[2] ?? "", BULLET_MAX),
    bullet_point4: truncate(bullets[3] ?? "", BULLET_MAX),
    bullet_point5: truncate(bullets[4] ?? "", BULLET_MAX),
    generic_keywords: keywords,
    main_image_url: imageUrlColumns[0],
    other_image_url1: imageUrlColumns[1],
    other_image_url2: imageUrlColumns[2],
    other_image_url3: imageUrlColumns[3],
    other_image_url4: imageUrlColumns[4],
    other_image_url5: imageUrlColumns[5],
    other_image_url6: imageUrlColumns[6],
    other_image_url7: imageUrlColumns[7],
    other_image_url8: imageUrlColumns[8],
    feed_product_type: "",
    item_type: opts.audit.category?.trim() ?? "",
  };

  const filenameBase = `${slugify(opts.audit.projectName || opts.audit.productName)}-amazon-${marketplace.id.toLowerCase()}`;

  return { marketplace, row, images: imageAssets, filenameBase };
}

function toAbsoluteAssetUrl(url: string, publicBaseUrl?: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!publicBaseUrl) return url;
  const base = publicBaseUrl.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
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

export async function buildExcelBuffer(bundle: AuditExportBundle): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SellerLens";
  const sheet = workbook.addWorksheet("Listing");

  sheet.addRow([...AMAZON_FLAT_FILE_HEADERS]);
  sheet.addRow(AMAZON_FLAT_FILE_HEADERS.map((header) => bundle.row[header]));

  sheet.getRow(1).font = { bold: true };
  sheet.columns = AMAZON_FLAT_FILE_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.min(40, Math.max(12, header.length + 4)),
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildZipBuffer(opts: {
  bundle: AuditExportBundle;
  excelBuffer: Buffer;
  auditId: number;
  graphicsProjectId?: number | null;
}): Promise<Buffer> {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(stream);
  archive.append(opts.excelBuffer, { name: "listing.xlsx" });

  for (const asset of opts.bundle.images) {
    const buffer = await loadImageBuffer({
      auditId: opts.auditId,
      sourceUrl: asset.sourceUrl,
      graphicsProjectId: opts.graphicsProjectId,
    });
    if (buffer) archive.append(buffer, { name: asset.zipPath });
  }

  await archive.finalize();
  return done;
}

export function exportFilename(base: string, ext: "xlsx" | "zip"): string {
  return `${base}.${ext}`;
}

export function isValidMarketplaceId(id: string): id is AmazonMarketplaceId {
  return resolveAmazonMarketplace(id).id === id.toUpperCase();
}
