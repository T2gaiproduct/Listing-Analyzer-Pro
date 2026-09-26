import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import type { Audit, ImageRecord } from "@workspace/db";
import { resolveAmazonMarketplace, type AmazonMarketplaceId } from "./amazon-marketplaces.js";
import {
  appendImagesToZip,
  collectAplusImages,
  slugify,
  htmlForListingExport,
  truncate,
  type ExportImageAsset,
} from "./listing-export-shared.js";
import {
  resolvePublishImageCandidate,
  resolvePublishImageUrlsFromAudit,
} from "./materialize-audit-images-for-publish.js";
import { bulletsToHtmlDescription, resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  AMAZON_PRODUCT_DESCRIPTION_MAX,
  buildListingContentReviewRows,
} from "./listing-description-sections.js";
import type { GeneratedContent } from "@workspace/db";

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
  listingContent: GeneratedContent;
}

const BULLET_MAX = 500;
const KEYWORDS_MAX = 250;
const DESCRIPTION_MAX = AMAZON_PRODUCT_DESCRIPTION_MAX;

export function buildAuditExportBundle(opts: {
  audit: Audit;
  marketplaceId?: string | null;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
  profileSku?: string | null;
}): AuditExportBundle {
  const content = resolveListingContentForExport(opts.audit);
  if (!content.title.trim()) {
    throw new Error("Listing title is required before exporting.");
  }

  const marketplace = resolveAmazonMarketplace(opts.marketplaceId);
  const publishUrls = resolvePublishImageUrlsFromAudit({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId ?? null,
    publicBaseUrl: opts.publicBaseUrl,
    exportListing: true,
  });

  const productAssets: ExportImageAsset[] = publishUrls.map((absoluteUrl, index) => {
    const ext = ".jpg";
    const zipName = index === 0 ? `main${ext}` : `other-${String(index).padStart(2, "0")}${ext}`;
    return {
      id: `product-${index}`,
      sourceUrl: absoluteUrl,
      absoluteUrl,
      zipPath: `images/${zipName}`,
      kind: index === 0 ? "main" : "other",
    };
  });

  const aplusImages = collectAplusImages(opts.audit);
  const aplusAssets: ExportImageAsset[] = [];
  for (const [index, img] of aplusImages.entries()) {
    const absoluteUrl = resolvePublishImageCandidate({
      auditId: opts.audit.id,
      sourceUrl: img.url,
      publicBaseUrl: opts.publicBaseUrl,
      graphicsProjectId: opts.graphicsProjectId ?? null,
      index: 200 + index,
      exportListing: true,
    });
    if (!absoluteUrl) continue;
    aplusAssets.push({
      id: `aplus-${img.moduleId}`,
      sourceUrl: img.url,
      absoluteUrl,
      zipPath: `aplus/${img.moduleId}.jpg`,
      kind: "aplus",
    });
  }

  const images = [...productAssets, ...aplusAssets];

  const sku = opts.profileSku?.trim() || `SL-${opts.audit.id}`;
  const brand = opts.audit.brandName?.trim() || opts.audit.productName?.trim() || "Brand";
  const bullets = [...content.bulletPoints].slice(0, 5);
  while (bullets.length < 5) bullets.push("");

  const keywords = truncate(content.keywords.join(" ").replace(/\s+/g, " "), KEYWORDS_MAX);
  const descriptionSource = content.htmlDescription?.trim()
    || bulletsToHtmlDescription(content.bulletPoints);
  const description = htmlForListingExport(descriptionSource, DESCRIPTION_MAX);

  const imageUrlColumns: string[] = ["", "", "", "", "", "", "", "", ""];
  publishUrls.forEach((url, index) => {
    if (index === 0) imageUrlColumns[0] = url;
    else if (index <= 8) imageUrlColumns[index] = url;
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

  return { marketplace, row, images, filenameBase, listingContent: content };
}

function csvEscapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAmazonCsvBuffer(bundle: AuditExportBundle): Buffer {
  const headerLine = AMAZON_FLAT_FILE_HEADERS.map(csvEscapeCell).join(",");
  const valueLine = AMAZON_FLAT_FILE_HEADERS
    .map((header) => csvEscapeCell(bundle.row[header] ?? ""))
    .join(",");
  return Buffer.from(`${headerLine}\n${valueLine}\n`, "utf-8");
}

export async function buildExcelBuffer(bundle: AuditExportBundle): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SellerLens";

  const uploadSheet = workbook.addWorksheet("Amazon Upload");
  uploadSheet.addRow([...AMAZON_FLAT_FILE_HEADERS]);
  uploadSheet.addRow(AMAZON_FLAT_FILE_HEADERS.map((header) => bundle.row[header]));
  uploadSheet.getRow(1).font = { bold: true };
  uploadSheet.columns = AMAZON_FLAT_FILE_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.min(48, Math.max(12, header.length + 4)),
  }));
  const descColIndex = AMAZON_FLAT_FILE_HEADERS.indexOf("product_description") + 1;
  if (descColIndex > 0) {
    uploadSheet.getColumn(descColIndex).width = 60;
    uploadSheet.getRow(2).getCell(descColIndex).alignment = { wrapText: true, vertical: "top" };
  }

  const reviewRows = buildListingContentReviewRows(bundle.listingContent, bundle.row, bundle.images);
  const reviewSheet = workbook.addWorksheet("Full listing content");
  reviewSheet.addRow(["Section", "Field", "Value"]);
  reviewSheet.getRow(1).font = { bold: true };
  for (const r of reviewRows) {
    reviewSheet.addRow([r.section, r.field, r.value]);
  }
  reviewSheet.getColumn(1).width = 18;
  reviewSheet.getColumn(2).width = 36;
  reviewSheet.getColumn(3).width = 80;
  for (let i = 2; i <= reviewSheet.rowCount; i++) {
    reviewSheet.getRow(i).getCell(3).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** One workbook: Amazon Upload rows for every bundle + combined Full listing content sheet. */
export async function buildBulkExcelBuffer(bundles: AuditExportBundle[]): Promise<Buffer> {
  if (bundles.length === 0) {
    throw new Error("No listings to export.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SellerLens";

  const uploadSheet = workbook.addWorksheet("Amazon Upload");
  uploadSheet.addRow([...AMAZON_FLAT_FILE_HEADERS]);
  uploadSheet.getRow(1).font = { bold: true };
  for (const bundle of bundles) {
    uploadSheet.addRow(AMAZON_FLAT_FILE_HEADERS.map((header) => bundle.row[header]));
  }
  uploadSheet.columns = AMAZON_FLAT_FILE_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.min(48, Math.max(12, header.length + 4)),
  }));
  const descColIndex = AMAZON_FLAT_FILE_HEADERS.indexOf("product_description") + 1;
  if (descColIndex > 0) {
    uploadSheet.getColumn(descColIndex).width = 60;
    for (let row = 2; row <= uploadSheet.rowCount; row++) {
      uploadSheet.getRow(row).getCell(descColIndex).alignment = { wrapText: true, vertical: "top" };
    }
  }

  const reviewSheet = workbook.addWorksheet("Full listing content");
  reviewSheet.addRow(["Product", "Section", "Field", "Value"]);
  reviewSheet.getRow(1).font = { bold: true };
  for (const bundle of bundles) {
    const productLabel = bundle.filenameBase || bundle.row.item_name || bundle.row.item_sku;
    const reviewRows = buildListingContentReviewRows(bundle.listingContent, bundle.row, bundle.images);
    for (const r of reviewRows) {
      reviewSheet.addRow([productLabel, r.section, r.field, r.value]);
    }
  }
  reviewSheet.getColumn(1).width = 28;
  reviewSheet.getColumn(2).width = 18;
  reviewSheet.getColumn(3).width = 36;
  reviewSheet.getColumn(4).width = 80;
  for (let i = 2; i <= reviewSheet.rowCount; i++) {
    reviewSheet.getRow(i).getCell(4).alignment = { wrapText: true, vertical: "top" };
  }

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
