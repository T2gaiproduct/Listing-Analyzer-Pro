import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import type { Audit, ImageRecord } from "@workspace/db";
import {
  appendImagesToZip,
  buildAplusImageAssets,
  buildProductImageAssets,
  collectAplusImages,
  collectProductImages,
  readGeneratedContent,
  slugify,
  truncate,
  type ExportImageAsset,
} from "./listing-export-shared.js";

/** Shopify product CSV import columns (single-variant product). */
export const SHOPIFY_CSV_HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Grams",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Variant Barcode",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "Gift Card",
  "SEO Title",
  "SEO Description",
  "Status",
] as const;

export type ShopifyCsvRow = Record<(typeof SHOPIFY_CSV_HEADERS)[number], string>;

export interface ShopifyExportBundle {
  rows: ShopifyCsvRow[];
  images: ExportImageAsset[];
  filenameBase: string;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsvLine(row: ShopifyCsvRow): string {
  return SHOPIFY_CSV_HEADERS.map((header) => escapeCsvField(row[header] ?? "")).join(",");
}

export function buildShopifyExportBundle(opts: {
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
}): ShopifyExportBundle {
  const content = readGeneratedContent(opts.audit);
  if (!content) {
    throw new Error("Listing content not generated yet. Complete the Listing step before exporting.");
  }

  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const aplusImages = collectAplusImages(opts.audit);
  const productAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const aplusAssets = buildAplusImageAssets(aplusImages, opts.publicBaseUrl);
  const images = [...productAssets, ...aplusAssets];

  const handle = slugify(opts.audit.projectName || opts.audit.productName || `product-${opts.audit.id}`);
  const brand = opts.audit.brandName?.trim() || opts.audit.productName?.trim() || "";
  const tags = content.keywords.slice(0, 20).join(", ");
  const seoDescription = truncate(content.title, 160);

  const baseRow: ShopifyCsvRow = {
    Handle: handle,
    Title: truncate(content.title, 255),
    "Body (HTML)": content.htmlDescription || "",
    Vendor: truncate(brand, 100),
    Type: opts.audit.category?.trim() ?? "",
    Tags: tags,
    Published: "FALSE",
    "Option1 Name": "Title",
    "Option1 Value": "Default Title",
    "Variant SKU": `SL-${opts.audit.id}`,
    "Variant Grams": "",
    "Variant Inventory Tracker": "",
    "Variant Inventory Qty": "",
    "Variant Inventory Policy": "deny",
    "Variant Fulfillment Service": "manual",
    "Variant Price": "",
    "Variant Compare At Price": "",
    "Variant Requires Shipping": "TRUE",
    "Variant Taxable": "TRUE",
    "Variant Barcode": "",
    "Image Src": "",
    "Image Position": "",
    "Image Alt Text": "",
    "Gift Card": "FALSE",
    "SEO Title": truncate(content.title, 70),
    "SEO Description": seoDescription,
    Status: "draft",
  };

  const rows: ShopifyCsvRow[] = [];
  if (productAssets.length === 0) {
    rows.push({ ...baseRow });
  } else {
    productAssets.forEach((asset, index) => {
      if (index === 0) {
        rows.push({
          ...baseRow,
          "Image Src": asset.absoluteUrl,
          "Image Position": "1",
          "Image Alt Text": truncate(content.title, 512),
        });
      } else {
        rows.push({
          ...emptyShopifyRow(),
          Handle: handle,
          "Image Src": asset.absoluteUrl,
          "Image Position": String(index + 1),
        });
      }
    });
  }

  const filenameBase = `${slugify(opts.audit.projectName || opts.audit.productName)}-shopify`;

  return { rows, images, filenameBase };
}

function emptyShopifyRow(): ShopifyCsvRow {
  return Object.fromEntries(SHOPIFY_CSV_HEADERS.map((h) => [h, ""])) as ShopifyCsvRow;
}

export function buildShopifyCsvBuffer(bundle: ShopifyExportBundle): Buffer {
  const lines = [SHOPIFY_CSV_HEADERS.join(","), ...bundle.rows.map(rowToCsvLine)];
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

export async function buildShopifyZipBuffer(opts: {
  bundle: ShopifyExportBundle;
  csvBuffer: Buffer;
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
  archive.append(opts.csvBuffer, { name: "listing.csv" });
  await appendImagesToZip({
    archive,
    images: opts.bundle.images,
    auditId: opts.auditId,
    graphicsProjectId: opts.graphicsProjectId,
  });

  await archive.finalize();
  return done;
}

export function shopifyExportFilename(base: string, ext: "csv" | "zip"): string {
  return `${base}.${ext}`;
}
