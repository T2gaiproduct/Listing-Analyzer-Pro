import type { Audit, ImageRecord } from "@workspace/db";
import {
  AMAZON_FLAT_FILE_HEADERS,
  buildAuditExportBundle,
  type AmazonFlatFileRow,
} from "./amazon-listing-export.js";
import {
  buildAplusImageAssets,
  buildProductImageAssets,
  collectAplusImages,
  collectProductImages,
  stripHtml,
} from "./listing-export-shared.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";

export type ExportPreviewRowStatus = "complete" | "missing" | "optional";

export interface ExportPreviewRow {
  section: string;
  amazonField: string;
  value: string;
  charCount: number;
  status: ExportPreviewRowStatus;
}

const FIELD_SECTION: Record<string, string> = {
  marketplace: "Listing",
  item_sku: "Listing",
  external_product_id: "Listing",
  external_product_id_type: "Listing",
  item_name: "Listing",
  brand_name: "Listing",
  manufacturer: "Listing",
  product_description: "Listing",
  bullet_point1: "Listing",
  bullet_point2: "Listing",
  bullet_point3: "Listing",
  bullet_point4: "Listing",
  bullet_point5: "Listing",
  generic_keywords: "Listing",
  feed_product_type: "Listing",
  item_type: "Listing",
  main_image_url: "Images",
  other_image_url1: "Images",
  other_image_url2: "Images",
  other_image_url3: "Images",
  other_image_url4: "Images",
  other_image_url5: "Images",
  other_image_url6: "Images",
  other_image_url7: "Images",
  other_image_url8: "Images",
};

const FIELD_LABEL: Record<string, string> = {
  marketplace: "Marketplace",
  item_sku: "SKU",
  external_product_id: "External product ID",
  external_product_id_type: "External product ID type",
  item_name: "Product title",
  brand_name: "Brand name",
  manufacturer: "Manufacturer",
  product_description: "Product description",
  bullet_point1: "Bullet point 1",
  bullet_point2: "Bullet point 2",
  bullet_point3: "Bullet point 3",
  bullet_point4: "Bullet point 4",
  bullet_point5: "Bullet point 5",
  generic_keywords: "Search terms",
  main_image_url: "Main image URL",
  other_image_url1: "Other image URL 1",
  other_image_url2: "Other image URL 2",
  other_image_url3: "Other image URL 3",
  other_image_url4: "Other image URL 4",
  other_image_url5: "Other image URL 5",
  other_image_url6: "Other image URL 6",
  other_image_url7: "Other image URL 7",
  other_image_url8: "Other image URL 8",
  feed_product_type: "Feed product type",
  item_type: "Item type / category",
};

const REQUIRED_FIELDS = new Set<string>([
  "item_name",
  "brand_name",
  "bullet_point1",
  "main_image_url",
]);

function rowStatus(field: string, value: string): ExportPreviewRowStatus {
  const trimmed = value.trim();
  if (!trimmed) {
    return REQUIRED_FIELDS.has(field) ? "missing" : "optional";
  }
  return "complete";
}

function flatRowToPreviewRows(row: AmazonFlatFileRow): ExportPreviewRow[] {
  return AMAZON_FLAT_FILE_HEADERS.map((key) => {
    const value = row[key] ?? "";
    return {
      section: FIELD_SECTION[key] ?? "Listing",
      amazonField: FIELD_LABEL[key] ?? key,
      value,
      charCount: value.length,
      status: rowStatus(key, value),
    };
  });
}

function partialListingRows(audit: Audit): ExportPreviewRow[] {
  const content = resolveListingContentForExport(audit);
  const description = stripHtml(content.htmlDescription || "");
  const bullets = content.bulletPoints.slice(0, 5);
  const rows: ExportPreviewRow[] = [
    {
      section: "Listing",
      amazonField: "Product title",
      value: content.title,
      charCount: content.title.length,
      status: rowStatus("item_name", content.title),
    },
    {
      section: "Listing",
      amazonField: "Brand name",
      value: audit.brandName?.trim() ?? "",
      charCount: (audit.brandName?.trim() ?? "").length,
      status: rowStatus("brand_name", audit.brandName ?? ""),
    },
    ...bullets.map((bullet, index) => ({
      section: "Listing" as const,
      amazonField: `Bullet point ${index + 1}`,
      value: bullet,
      charCount: bullet.length,
      status: rowStatus(`bullet_point${index + 1}`, bullet),
    })),
    {
      section: "Listing",
      amazonField: "Search terms",
      value: content.keywords.join(" "),
      charCount: content.keywords.join(" ").length,
      status: rowStatus("generic_keywords", content.keywords.join(" ")),
    },
    {
      section: "Listing",
      amazonField: "Product description",
      value: description,
      charCount: description.length,
      status: rowStatus("product_description", description),
    },
    {
      section: "Listing",
      amazonField: "Item type / category",
      value: audit.category?.trim() ?? "",
      charCount: (audit.category?.trim() ?? "").length,
      status: rowStatus("item_type", audit.category ?? ""),
    },
  ];
  return rows;
}

export function buildAuditExportPreview(opts: {
  audit: Audit;
  marketplaceId?: string | null;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
}): {
  readinessScore: number;
  readinessMax: number;
  readinessHint: string;
  rows: ExportPreviewRow[];
  canDownload: boolean;
} {
  let flatRows: ExportPreviewRow[] = [];
  let aplusRows: ExportPreviewRow[] = [];

  try {
    const bundle = buildAuditExportBundle({
      audit: opts.audit,
      marketplaceId: opts.marketplaceId,
      graphicsImageRecords: opts.graphicsImageRecords,
      publicBaseUrl: opts.publicBaseUrl,
    });
    flatRows = flatRowToPreviewRows(bundle.row);
    aplusRows = bundle.images
      .filter((img) => img.kind === "aplus")
      .map((img) => ({
        section: "A+ Content",
        amazonField: `A+ module image (${img.id.replace(/^aplus-/, "")})`,
        value: img.absoluteUrl,
        charCount: img.absoluteUrl.length,
        status: "complete" as const,
      }));
  } catch {
    flatRows = partialListingRows(opts.audit);
    const productAssets = buildProductImageAssets(
      collectProductImages(opts.audit, opts.graphicsImageRecords),
      opts.publicBaseUrl,
    );
    for (const asset of productAssets) {
      const isMain = asset.kind === "main";
      flatRows.push({
        section: "Images",
        amazonField: isMain ? "Main image URL" : `Other image URL ${asset.id.replace("product-", "")}`,
        value: asset.absoluteUrl,
        charCount: asset.absoluteUrl.length,
        status: isMain ? rowStatus("main_image_url", asset.absoluteUrl) : "optional",
      });
    }
    aplusRows = buildAplusImageAssets(collectAplusImages(opts.audit), opts.publicBaseUrl).map((img) => ({
      section: "A+ Content",
      amazonField: `A+ module image (${img.id.replace(/^aplus-/, "")})`,
      value: img.absoluteUrl,
      charCount: img.absoluteUrl.length,
      status: "complete" as const,
    }));
  }

  const rows = [...flatRows, ...aplusRows];

  const requiredChecks = [
    rows.find((r) => r.amazonField === "Product title"),
    rows.find((r) => r.amazonField === "Bullet point 1"),
    rows.find((r) => r.amazonField === "Main image URL"),
  ];
  const readinessMax = requiredChecks.length;
  const readinessScore = requiredChecks.filter((r) => r && r.status === "complete").length;

  const canDownload = Boolean(rows.find((r) => r.amazonField === "Product title" && r.value.trim()));

  return {
    readinessScore,
    readinessMax,
    readinessHint: readinessScore >= readinessMax
      ? "Listing is ready to export."
      : "Complete required product details, generate content, and add a main image URL.",
    rows,
    canDownload,
  };
}
