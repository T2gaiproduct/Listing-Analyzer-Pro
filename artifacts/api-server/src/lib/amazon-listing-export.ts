import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import type { Audit, ImageRecord } from "@workspace/db";
import { resolveAmazonMarketplace, type AmazonMarketplaceId } from "./amazon-marketplaces.js";
import {
  appendImagesToZip,
  buildAplusImageAssets,
  buildProductImageAssets,
  collectAplusImages,
  collectProductImages,
  readGeneratedContent,
  slugify,
  stripHtml,
  truncate,
  type ExportImageAsset,
} from "./listing-export-shared.js";

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

export interface AuditExportBundle {
  marketplace: ReturnType<typeof resolveAmazonMarketplace>;
  row: AmazonFlatFileRow;
  images: ExportImageAsset[];
  filenameBase: string;
}

const BULLET_MAX = 500;
const KEYWORDS_MAX = 250;
const DESCRIPTION_MAX = 2000;

export function buildAuditExportBundle(opts: {
  audit: Audit;
  marketplaceId?: string | null;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
}): AuditExportBundle {
  const content = readGeneratedContent(opts.audit);
  if (!content) {
    throw new Error("Listing content not generated yet. Complete the Listing step before exporting.");
  }

  const marketplace = resolveAmazonMarketplace(opts.marketplaceId);
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const aplusImages = collectAplusImages(opts.audit);
  const productAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const aplusAssets = buildAplusImageAssets(aplusImages, opts.publicBaseUrl);
  const images = [...productAssets, ...aplusAssets];

  const sku = `SL-${opts.audit.id}`;
  const brand = opts.audit.brandName?.trim() || opts.audit.productName?.trim() || "Brand";
  const bullets = [...content.bulletPoints].slice(0, 5);
  while (bullets.length < 5) bullets.push("");

  const keywords = truncate(content.keywords.join(" ").replace(/\s+/g, " "), KEYWORDS_MAX);
  const description = truncate(stripHtml(content.htmlDescription || ""), DESCRIPTION_MAX);

  const imageUrlColumns: string[] = ["", "", "", "", "", "", "", "", ""];
  productAssets.forEach((asset, index) => {
    if (index === 0) imageUrlColumns[0] = asset.absoluteUrl;
    else if (index <= 8) imageUrlColumns[index] = asset.absoluteUrl;
  });

  const row: AmazonFlatFileRow = {
    marketplace: marketplace.siteCode,
    item_sku: sku,
    external_product_id: opts.audit.asin?.trim() ?? "",
    external_product_id_type: opts.audit.asin?.trim() ? "ASIN" : "",
    item_name: truncate(content.title, 200),
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

  return { marketplace, row, images, filenameBase };
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
  await appendImagesToZip({
    archive,
    images: opts.bundle.images,
    auditId: opts.auditId,
    graphicsProjectId: opts.graphicsProjectId,
  });

  await archive.finalize();
  return done;
}

export function exportFilename(base: string, ext: "xlsx" | "zip"): string {
  return `${base}.${ext}`;
}

export function isValidMarketplaceId(id: string): id is AmazonMarketplaceId {
  return resolveAmazonMarketplace(id).id === id.toUpperCase();
}

// Re-export shared helpers used by routes/tests.
export { loadImageBuffer } from "./listing-export-shared.js";
