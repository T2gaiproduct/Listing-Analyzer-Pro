import ExcelJS from "exceljs";
import type { Audit, AuditContentVariantGenerated, GeneratedContent, ImageRecord } from "@workspace/db";
import { buildSourceListingSnapshot } from "./source-listing-content.js";
import {
  defaultFieldSourcesAi,
  mergeListingContentByFieldSources,
  resolveAiSnapshot,
} from "./listing-content-field-merge.js";
import { htmlForListingExport, slugify, stripHtml } from "./listing-export-shared.js";
import { resolveListingExportImageUrlsFromAudit } from "./materialize-audit-images-for-publish.js";

const MARKETPLACE_SHEET_NAMES: Record<string, string> = {
  amazon: "amazon_3p",
  walmart: "wallmart",
};

const MARKETPLACE_CONTENT_HEADERS = [
  "Title",
  "Bullet 1",
  "Bullet 2",
  "Bullet 3",
  "Bullet 4",
  "Bullet 5",
  "Keywords",
  "Description",
  "Attributes",
] as const;

export type ContentMarketplaceMeta = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
};

function excelSheetName(slug: string): string {
  const key = slug.trim().toLowerCase();
  const base = MARKETPLACE_SHEET_NAMES[key] ?? key.replace(/[^a-z0-9_]/gi, "_");
  return base.slice(0, 31);
}

function folderSlug(audit: Audit, sku: string): string {
  const raw = audit.productName?.trim() || audit.title?.trim() || sku;
  return slugify(raw).replace(/-/g, "_") || `product_${audit.id}`;
}

function variantToExportContent(
  variant: AuditContentVariantGenerated,
  sourceListing: GeneratedContent,
): GeneratedContent {
  const ai = resolveAiSnapshot(variant);
  const fieldSources = variant.fieldSources ?? defaultFieldSourcesAi();
  return mergeListingContentByFieldSources(sourceListing, ai, fieldSources);
}

function hasListingCopy(content: GeneratedContent): boolean {
  return Boolean(
    content.title?.trim()
    || content.bulletPoints?.some((b) => b?.trim())
    || content.keywords?.some((k) => k?.trim())
    || content.htmlDescription?.trim()
    || (content.attributes?.length ?? 0) > 0,
  );
}

function marketplaceContentRow(content: GeneratedContent): string[] {
  const bullets = [...(content.bulletPoints ?? [])];
  while (bullets.length < 5) bullets.push("");
  const keywords = (content.keywords ?? []).filter(Boolean).join(", ");
  const description = stripHtml(
    htmlForListingExport(content.htmlDescription?.trim() ?? "", 8000),
  );
  const attributes = (content.attributes ?? [])
    .map((row) => `${row.attribute}: ${row.value}`)
    .join(" · ");

  return [
    content.title?.trim() ?? "",
    ...bullets.slice(0, 5).map((b) => b?.trim() ?? ""),
    keywords,
    description,
    attributes,
  ];
}

function applyUrlHyperlink(cell: ExcelJS.Cell, url: string): void {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  cell.value = { text: url, hyperlink: url };
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
}

function boldHeaderRow(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = { bold: true };
}

export function buildMultiMarketplaceExportFilename(audit: Audit): string {
  const base = slugify(audit.productName?.trim() || audit.title?.trim() || `audit-${audit.id}`);
  return `multi-marketplace-${base || audit.id}.xlsx`;
}

export async function buildMultiMarketplaceExcelBuffer(opts: {
  audit: Audit;
  variants: Array<{ contentMarketplaceId: number; generatedContent: AuditContentVariantGenerated }>;
  marketplaces: ContentMarketplaceMeta[];
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
}): Promise<Buffer> {
  const { audit, variants, marketplaces } = opts;
  const sourceListing = (audit.sourceListingContent as GeneratedContent | null)
    ?? buildSourceListingSnapshot(audit);

  const marketplaceById = new Map(marketplaces.map((m) => [m.id, m]));

  const sheets: Array<{ slug: string; name: string; content: GeneratedContent }> = [];

  for (const row of variants) {
    const meta = marketplaceById.get(row.contentMarketplaceId);
    if (!meta) continue;
    const content = variantToExportContent(row.generatedContent, sourceListing);
    if (!hasListingCopy(content)) continue;
    sheets.push({ slug: meta.slug, name: meta.name, content });
  }

  if (sheets.length === 0 && audit.generatedContent && audit.contentMarketplaceId != null) {
    const meta = marketplaceById.get(audit.contentMarketplaceId);
    const legacy = audit.generatedContent as GeneratedContent;
    if (meta && hasListingCopy(legacy)) {
      sheets.push({ slug: meta.slug, name: meta.name, content: legacy });
    }
  }

  if (sheets.length === 0) {
    throw new Error("No marketplace content to export. Generate and save optimized copy for at least one marketplace tab first.");
  }

  const sortOrderBySlug = new Map(marketplaces.map((m) => [m.slug.toLowerCase(), m.sortOrder]));
  sheets.sort(
    (a, b) => (sortOrderBySlug.get(a.slug.toLowerCase()) ?? 999)
      - (sortOrderBySlug.get(b.slug.toLowerCase()) ?? 999),
  );

  const sku = `SL-${audit.id}`;
  const folder = folderSlug(audit, sku);
  const publishUrls = await resolveListingExportImageUrlsFromAudit({
    audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId ?? null,
    publicBaseUrl: opts.publicBaseUrl,
  });

  const imageRecords = opts.graphicsImageRecords ?? (audit.imageRecords as ImageRecord[] | null) ?? [];
  const imageNotes: string[] = [];
  publishUrls.slice(0, 8).forEach((url, index) => {
    const rec = imageRecords[index];
    const label = rec?.type ? `${rec.type}${rec.style ? ` — ${rec.style}` : ""}` : "product image";
    imageNotes.push(`${index + 1}. (${label})`);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ecommerce Guru";

  const productsSheet = workbook.addWorksheet("Products");
  productsSheet.addRow(["Folder", "SKU", "Product name", "Brand", "Category", "ASIN"]);
  productsSheet.addRow([
    folder,
    sku,
    audit.productName?.trim() || audit.title?.trim() || "",
    audit.brandName?.trim() ?? "",
    audit.category?.trim() ?? "",
    audit.asin?.trim() ?? "",
  ]);
  boldHeaderRow(productsSheet);
  productsSheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 36 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
  ];

  const imageSheet = workbook.addWorksheet("Image Order");
  imageSheet.addRow([
    "Folder",
    "Image 1",
    "Image 2",
    "Image 3",
    "Image 4",
    "Image 5",
    "Image 6",
    "Image notes",
  ]);
  const imageRow = imageSheet.addRow([
    folder,
    "",
    "",
    "",
    "",
    "",
    "",
    imageNotes.join("\n"),
  ]);
  for (let i = 0; i < 6; i++) {
    const url = publishUrls[i];
    if (!url) {
      imageRow.getCell(i + 2).value = `${folder}_${String(i + 1).padStart(2, "0")}.jpg`;
      continue;
    }
    applyUrlHyperlink(imageRow.getCell(i + 2), url);
  }
  imageRow.getCell(8).alignment = { wrapText: true, vertical: "top" };
  boldHeaderRow(imageSheet);
  imageSheet.getColumn(8).width = 42;
  for (let c = 2; c <= 7; c++) imageSheet.getColumn(c).width = 28;
  imageSheet.getColumn(1).width = 22;

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(excelSheetName(sheet.slug));
    ws.addRow([...MARKETPLACE_CONTENT_HEADERS]);
    ws.addRow(marketplaceContentRow(sheet.content));
    boldHeaderRow(ws);
    ws.columns = MARKETPLACE_CONTENT_HEADERS.map((header) => ({
      width: header === "Description" ? 56 : header === "Attributes" ? 40 : Math.min(36, header.length + 20),
    }));
    const descCol = MARKETPLACE_CONTENT_HEADERS.indexOf("Description") + 1;
    if (descCol > 0) {
      ws.getRow(2).getCell(descCol).alignment = { wrapText: true, vertical: "top" };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
