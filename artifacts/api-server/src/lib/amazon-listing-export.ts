import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import type { Audit, GeneratedContent, GraphicsProject, ImageRecord } from "@workspace/db";
import { GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./image-storage";

export type ExportValidationLevel = "error" | "warning" | "info";

export interface ExportValidationItem {
  level: ExportValidationLevel;
  field: string;
  message: string;
}

export interface AmazonListingExportImage {
  label: string;
  url: string;
  filePath: string | null;
  zipName: string;
}

export interface AmazonListingExportData {
  auditId: number;
  sku: string;
  productName: string;
  brandName: string;
  category: string;
  asin: string | null;
  title: string;
  bulletPoints: string[];
  keywords: string;
  descriptionPlain: string;
  descriptionHtml: string;
  images: AmazonListingExportImage[];
  aplusModuleCount: number;
}

const FLAT_FILE_HEADERS = [
  "item_sku",
  "item_name",
  "brand_name",
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
  "external_product_id",
  "external_product_id_type",
  "item_type",
  "update_delete",
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tsvEscape(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function resolveGraphicsImagePath(projectId: number, imageUrl: string): string | null {
  const filename = path.basename((imageUrl.split("?")[0] ?? imageUrl));
  const candidates = [
    path.join(GRAPHICS_IMAGES_DIR, String(projectId), filename),
    path.join(process.cwd(), "public", "images", "graphics", String(projectId), filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) return candidate;
  }
  return null;
}

function absoluteImageUrl(baseUrl: string, relativeUrl: string): string {
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  const base = baseUrl.replace(/\/$/, "");
  const rel = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  return `${base}${rel}`;
}

function collectImages(
  audit: Audit,
  graphicsProject: GraphicsProject | null,
  publicBaseUrl: string,
): AmazonListingExportImage[] {
  const images: AmazonListingExportImage[] = [];
  const seen = new Set<string>();

  const add = (label: string, url: string, filePath: string | null, zipName: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({
      label,
      url: absoluteImageUrl(publicBaseUrl, url),
      filePath,
      zipName,
    });
  };

  const records = (audit.imageRecords ?? []) as ImageRecord[];
  records.forEach((record, idx) => {
    if (!record.currentUrl) return;
    const filePath = resolveAuditImagePath(audit.id, record.currentUrl);
    const ext = path.extname(record.currentUrl) || ".jpg";
    add(
      `${record.type} ${record.index + 1}`,
      record.currentUrl,
      filePath,
      `images/audit_${record.type}_${idx + 1}${ext}`,
    );
  });

  if (graphicsProject?.imageRecords) {
    graphicsProject.imageRecords.forEach((record, idx) => {
      if (!record.currentUrl) return;
      const filePath = resolveGraphicsImagePath(graphicsProject.id, record.currentUrl);
      const ext = path.extname(record.currentUrl) || ".jpg";
      add(
        `graphics ${record.type} ${record.index + 1}`,
        record.currentUrl,
        filePath,
        `images/graphics_${record.type}_${idx + 1}${ext}`,
      );
    });
  }

  (audit.imageUrls ?? []).forEach((url, idx) => {
    if (url.startsWith("data:")) return;
    add(`upload ${idx + 1}`, url, null, `images/upload_${idx + 1}.jpg`);
  });

  return images;
}

export function buildAmazonListingExportData(
  audit: Audit,
  graphicsProject: GraphicsProject | null,
  publicBaseUrl: string,
): AmazonListingExportData | null {
  const content = audit.generatedContent as GeneratedContent | null;
  if (!content) return null;

  const sku = `SL-${audit.id}`;
  const images = collectImages(audit, graphicsProject, publicBaseUrl);
  const aplus = (audit.generatedImages as { aplus?: { modules?: unknown[] } } | null)?.aplus;

  return {
    auditId: audit.id,
    sku,
    productName: audit.productName,
    brandName: audit.brandName ?? "",
    category: audit.category ?? "",
    asin: audit.asin ?? null,
    title: content.title,
    bulletPoints: content.bulletPoints ?? [],
    keywords: (content.keywords ?? []).join(" "),
    descriptionPlain: stripHtml(content.htmlDescription ?? ""),
    descriptionHtml: content.htmlDescription ?? "",
    images,
    aplusModuleCount: aplus?.modules?.length ?? 0,
  };
}

export function validateAmazonListingExport(data: AmazonListingExportData): ExportValidationItem[] {
  const items: ExportValidationItem[] = [];

  if (!data.title.trim()) {
    items.push({ level: "error", field: "title", message: "Listing title is required." });
  } else if (data.title.length > 200) {
    items.push({ level: "warning", field: "title", message: `Title is ${data.title.length} characters (Amazon limit is 200).` });
  }

  if (data.bulletPoints.length < 5) {
    items.push({ level: "warning", field: "bullets", message: `Only ${data.bulletPoints.length} bullet points (Amazon recommends 5).` });
  }

  data.bulletPoints.forEach((bullet, i) => {
    if (bullet.length > 500) {
      items.push({ level: "warning", field: `bullet_point${i + 1}`, message: `Bullet ${i + 1} exceeds 500 characters.` });
    }
  });

  if (!data.brandName.trim()) {
    items.push({ level: "warning", field: "brand", message: "Brand name is missing — Amazon requires a brand for most categories." });
  }

  if (data.images.length === 0) {
    items.push({ level: "warning", field: "images", message: "No product images found. Add graphics or audit images before publishing." });
  }

  if (!data.asin) {
    items.push({
      level: "info",
      field: "asin",
      message: "No ASIN on file — use Seller Central bulk upload for new listings (UPC/EAN may be required).",
    });
  }

  if (data.keywords.length > 250) {
    items.push({ level: "warning", field: "keywords", message: "Backend keywords may exceed Amazon's 250-byte limit." });
  }

  if (data.aplusModuleCount > 0) {
    items.push({
      level: "info",
      field: "aplus",
      message: `${data.aplusModuleCount} A+ module(s) included in ZIP — publish A+ separately in Seller Central (Brand Registry required).`,
    });
  }

  return items;
}

export function buildAmazonFlatFileTsv(data: AmazonListingExportData): string {
  const bullets = [...data.bulletPoints];
  while (bullets.length < 5) bullets.push("");

  const imageUrls = data.images.map((img) => img.url);
  const row: Record<(typeof FLAT_FILE_HEADERS)[number], string> = {
    item_sku: data.sku,
    item_name: data.title,
    brand_name: data.brandName,
    product_description: data.descriptionPlain,
    bullet_point1: bullets[0] ?? "",
    bullet_point2: bullets[1] ?? "",
    bullet_point3: bullets[2] ?? "",
    bullet_point4: bullets[3] ?? "",
    bullet_point5: bullets[4] ?? "",
    generic_keywords: data.keywords,
    main_image_url: imageUrls[0] ?? "",
    other_image_url1: imageUrls[1] ?? "",
    other_image_url2: imageUrls[2] ?? "",
    other_image_url3: imageUrls[3] ?? "",
    other_image_url4: imageUrls[4] ?? "",
    other_image_url5: imageUrls[5] ?? "",
    other_image_url6: imageUrls[6] ?? "",
    other_image_url7: imageUrls[7] ?? "",
    external_product_id: data.asin ?? "",
    external_product_id_type: data.asin ? "ASIN" : "",
    item_type: data.category,
    update_delete: data.asin ? "Update" : "PartialUpdate",
  };

  const lines = [
    FLAT_FILE_HEADERS.join("\t"),
    FLAT_FILE_HEADERS.map((h) => tsvEscape(row[h])).join("\t"),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

const README_TEXT = `SellerLens — Amazon Listing Export Package
==========================================

CONTENTS
--------
- listing.tsv          Amazon flat-file (tab-separated). Open in Excel and save as .xlsx if needed.
- description.html     Product description with Amazon-safe HTML tags.
- aplus-summary.txt    A+ module summary (publish separately in Seller Central).
- images/              Product images for manual upload or URL reference.

HOW TO UPLOAD TO AMAZON
-----------------------
1. Sign in to Seller Central → Catalog → Add Products via Upload.
2. Download the category template if required, or use Inventory Loader / Listing Loader.
3. Import listing.tsv (or paste values into your template).
4. Upload images from the images/ folder if URLs are not publicly reachable.
5. A+ Content must be published separately under Advertising → A+ Content Manager.

IMAGE REQUIREMENTS
------------------
- JPEG, PNG, TIFF, or GIF
- Main image: pure white background (RGB 255,255,255), product fills ~85% of frame
- Minimum 1000px on longest side recommended

VIDEO
-----
Product videos are not included in this export. Upload videos separately in Seller Central.

Generated by SellerLens
`;

export async function buildAmazonExportZip(data: AmazonListingExportData): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("listing.tsv", buildAmazonFlatFileTsv(data));
  zip.file("description.html", data.descriptionHtml);
  zip.file("README.txt", README_TEXT);

  if (data.aplusModuleCount > 0) {
    zip.file(
      "aplus-summary.txt",
      `${data.aplusModuleCount} A+ module(s) were generated in SellerLens.\n` +
        "Publish A+ content in Seller Central → Advertising → A+ Content Manager.\n" +
        "Brand Registry enrollment is required.\n",
    );
  }

  const imagesFolder = zip.folder("images");
  if (imagesFolder) {
    for (const image of data.images) {
      if (image.filePath && fs.existsSync(image.filePath)) {
        const buffer = fs.readFileSync(image.filePath);
        imagesFolder.file(path.basename(image.zipName), buffer);
      }
    }
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
