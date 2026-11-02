import * as XLSX from "xlsx";

export type BulkCatalogFieldKey =
  | "sku"
  | "title"
  | "description"
  | "bullet1"
  | "bullet2"
  | "bullet3"
  | "bullet4"
  | "bullet5"
  | "mainImageUrl"
  | "otherImageUrl1"
  | "otherImageUrl2"
  | "brandName"
  | "color"
  | "size"
  | "material"
  | "countryOfOrigin"
  | "productName"
  | "keywords"
  | "priority"
  | "assignedManager"
  | "referenceLinks"
  | "driveFolderUrl"
  | "targetMarketplaces";

export interface BulkCatalogFieldDef {
  key: BulkCatalogFieldKey;
  label: string;
  required: boolean;
  aliases: string[];
  /** Preferred column order in template (lower first). */
  templateOrder?: number;
}

export const BULK_CATALOG_TEMPLATE_HEADERS = [
  "SKU",
  "Title",
  "Description",
  "Bullet Point 1",
  "Bullet Point 2",
  "Bullet Point 3",
  "Bullet Point 4",
  "Bullet Point 5",
  "Main Image URL",
  "Other Image URL 1",
  "Other Image URL 2",
  "Brand Name",
  "Color",
  "Size",
  "Material",
  "Country of Origin",
] as const;

/** Sample rows matching the bulk import Excel reference layout. */
export const BULK_CATALOG_TEMPLATE_SAMPLE_ROWS: string[][] = [
  [
    "WATCH-001",
    "Titan Neo Analog Blue Dial Men's Watch",
    "Premium analog watch with sunray blue dial and stainless steel case.",
    "Sunray blue dial with luminous hands",
    "Scratch-resistant mineral crystal",
    "Water resistant for daily wear",
    "Stainless steel case and bracelet",
    "2-year manufacturer warranty",
    "https://example.com/images/watch-main.jpg",
    "https://example.com/images/watch-alt1.jpg",
    "https://example.com/images/watch-alt2.jpg",
    "Titan",
    "Blue",
    "42 mm",
    "Stainless Steel",
    "India",
  ],
  [
    "LIP-114",
    "Velvet Matte Lipstick",
    "Long-wear matte lipstick with rich color payoff.",
    "One-stroke bold color",
    "Transfer-proof matte finish",
    "Enriched with vitamin E",
    "Paraben free formula",
    "Suitable for all skin tones",
    "https://example.com/images/lipstick-main.jpg",
    "https://example.com/images/lipstick-alt1.jpg",
    "",
    "Glowveda",
    "Ruby Red",
    "4.2 g",
    "Wax blend",
    "India",
  ],
  [
    "SHOE-887",
    "Men's Running Shoes",
    "Lightweight running shoes built for comfort and grip.",
    "Breathable mesh upper",
    "Cushioned midsole for impact support",
    "High-grip rubber outsole",
    "Padded collar and tongue",
    "Ideal for road and treadmill",
    "https://example.com/images/shoe-main.jpg",
    "https://example.com/images/shoe-alt1.jpg",
    "https://example.com/images/shoe-alt2.jpg",
    "Stridefit",
    "Charcoal",
    "UK 9",
    "Mesh",
    "Vietnam",
  ],
];

export const BULK_CATALOG_FIELDS: BulkCatalogFieldDef[] = [
  {
    key: "sku",
    label: "SKU",
    required: true,
    templateOrder: 1,
    aliases: ["product_sku", "seller_sku", "item_sku"],
  },
  {
    key: "title",
    label: "Title",
    required: true,
    templateOrder: 2,
    aliases: ["listing_title", "item_name", "product_title", "product title"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    templateOrder: 3,
    aliases: ["product_description", "desc", "listing_description", "html_description"],
  },
  {
    key: "bullet1",
    label: "Bullet Point 1",
    required: false,
    templateOrder: 4,
    aliases: ["bullet_1", "bullet 1", "bp1"],
  },
  {
    key: "bullet2",
    label: "Bullet Point 2",
    required: false,
    templateOrder: 5,
    aliases: ["bullet_2", "bullet 2", "bp2"],
  },
  {
    key: "bullet3",
    label: "Bullet Point 3",
    required: false,
    templateOrder: 6,
    aliases: ["bullet_3", "bullet 3", "bp3"],
  },
  {
    key: "bullet4",
    label: "Bullet Point 4",
    required: false,
    templateOrder: 7,
    aliases: ["bullet_4", "bullet 4", "bp4"],
  },
  {
    key: "bullet5",
    label: "Bullet Point 5",
    required: false,
    templateOrder: 8,
    aliases: ["bullet_5", "bullet 5", "bp5"],
  },
  {
    key: "mainImageUrl",
    label: "Main Image URL",
    required: false,
    templateOrder: 9,
    aliases: ["main_image", "main image", "primary_image_url", "image_url"],
  },
  {
    key: "otherImageUrl1",
    label: "Other Image URL 1",
    required: false,
    templateOrder: 10,
    aliases: ["other_image_1", "other image 1", "image_url_2", "gallery_image_1"],
  },
  {
    key: "otherImageUrl2",
    label: "Other Image URL 2",
    required: false,
    templateOrder: 11,
    aliases: ["other_image_2", "other image 2", "image_url_3", "gallery_image_2"],
  },
  {
    key: "brandName",
    label: "Brand Name",
    required: false,
    templateOrder: 12,
    aliases: ["brand", "brand_name"],
  },
  {
    key: "color",
    label: "Color",
    required: false,
    templateOrder: 13,
    aliases: ["colour", "color_name"],
  },
  {
    key: "size",
    label: "Size",
    required: false,
    templateOrder: 14,
    aliases: ["item_size", "product_size"],
  },
  {
    key: "material",
    label: "Material",
    required: false,
    templateOrder: 15,
    aliases: ["material_type", "fabric"],
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin",
    required: false,
    templateOrder: 16,
    aliases: ["country", "country_of_origin", "origin_country", "made_in"],
  },
  {
    key: "productName",
    label: "Product name",
    required: false,
    aliases: ["product_name", "name", "product"],
  },
  {
    key: "keywords",
    label: "Keywords",
    required: false,
    aliases: ["target_keywords", "search_terms", "tags"],
  },
  {
    key: "priority",
    label: "Priority",
    required: false,
    aliases: ["project_priority"],
  },
  {
    key: "assignedManager",
    label: "Assigned manager",
    required: false,
    aliases: ["assigned_manager", "manager"],
  },
  {
    key: "referenceLinks",
    label: "Reference links",
    required: false,
    aliases: ["reference_links", "references", "competitor_links"],
  },
  {
    key: "driveFolderUrl",
    label: "Drive folder URL",
    required: false,
    aliases: ["drive_folder_url", "drive_folder", "assets_folder"],
  },
  {
    key: "targetMarketplaces",
    label: "Target marketplaces",
    required: false,
    aliases: ["target_marketplaces", "marketplaces", "channels"],
  },
];

/** Fields shown first in the Structure step (template columns). */
export const BULK_CATALOG_FIELDS_FOR_UI = [...BULK_CATALOG_FIELDS].sort((a, b) => {
  const ao = a.templateOrder ?? 999;
  const bo = b.templateOrder ?? 999;
  if (ao !== bo) return ao - bo;
  return a.label.localeCompare(b.label);
});

export const BULK_CATALOG_SKIP = "__skip__";

export type ColumnMapping = Record<string, BulkCatalogFieldKey | typeof BULK_CATALOG_SKIP>;

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FIELDS_BY_MATCH_SPECIFICITY = [...BULK_CATALOG_FIELDS].sort((a, b) => {
  const maxA = Math.max(a.label.length, ...a.aliases.map((x) => x.length));
  const maxB = Math.max(b.label.length, ...b.aliases.map((x) => x.length));
  return maxB - maxA;
});

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) {
      mapping[header] = BULK_CATALOG_SKIP;
      continue;
    }
    let matched: BulkCatalogFieldKey | typeof BULK_CATALOG_SKIP = BULK_CATALOG_SKIP;
    for (const field of FIELDS_BY_MATCH_SPECIFICITY) {
      const candidates = [field.key, field.label, ...field.aliases].map(normalizeHeader);
      if (candidates.some((c) => c === norm || (c.length >= 4 && (norm.includes(c) || c.includes(norm))))) {
        matched = field.key;
        break;
      }
    }
    mapping[header] = matched;
  }
  return mapping;
}

export function mappingCoversRequiredFields(mapping: ColumnMapping): boolean {
  const mapped = new Set(Object.values(mapping));
  const hasSku = mapped.has("sku");
  const hasTitle = mapped.has("title") || mapped.has("productName");
  return hasSku && hasTitle;
}

export interface ParsedCatalogFile {
  headers: string[];
  rows: Record<string, string>[];
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return String(value).trim();
}

export async function parseCatalogUploadFile(file: File): Promise<ParsedCatalogFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("The workbook has no sheets.");
    }
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (matrix.length === 0) {
      throw new Error("The file is empty.");
    }
    const headerRow = matrix[0]!.map((cell) => cellToString(cell));
    const headers = headerRow.map((h, i) => h || `Column ${i + 1}`);
    const rows: Record<string, string>[] = [];
    for (let r = 1; r < matrix.length; r++) {
      const line = matrix[r]!;
      const record: Record<string, string> = {};
      let hasValue = false;
      headers.forEach((header, col) => {
        const val = cellToString(line[col]);
        record[header] = val;
        if (val) hasValue = true;
      });
      if (hasValue) rows.push(record);
    }
    return { headers, rows };
  }
  throw new Error("Upload a .csv or .xlsx file.");
}

function parseCsvText(text: string): ParsedCatalogFile {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("The file is empty.");
  }
  const headers = splitCsvLine(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, col) => {
      const val = (cells[col] ?? "").trim();
      record[header] = val;
      if (val) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

export function buildCatalogTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const rows = [Array.from(BULK_CATALOG_TEMPLATE_HEADERS), ...BULK_CATALOG_TEMPLATE_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = BULK_CATALOG_TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  return wb;
}

export interface CatalogListingAttribute {
  attribute: string;
  value: string;
}

export interface CatalogImportProductPayload {
  productName: string;
  sku: string;
  category: string;
  priority?: string;
  assignedManager?: string;
  referenceLinks?: string;
  driveFolderUrl?: string;
  targetMarketplaces?: string[];
  brandName?: string;
  title?: string;
  productDescription?: string;
  bulletPoints?: string[];
  targetKeywords?: string[];
  imageUrls?: string[];
  listingAttributes?: CatalogListingAttribute[];
}

export function rowsToImportProducts(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  category: string,
): CatalogImportProductPayload[] {
  const products: CatalogImportProductPayload[] = [];
  for (const row of rows) {
    const values: Partial<Record<BulkCatalogFieldKey, string>> = {};
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === BULK_CATALOG_SKIP) continue;
      const cell = row[header]?.trim() ?? "";
      if (cell) values[fieldKey] = cell;
    }
    const sku = values.sku?.trim();
    const title = values.title?.trim();
    const productName = values.productName?.trim() || title;
    if (!productName || !sku) continue;

    const bullets = [values.bullet1, values.bullet2, values.bullet3, values.bullet4, values.bullet5]
      .map((b) => b?.trim())
      .filter((b): b is string => Boolean(b));

    const imageUrls = [values.mainImageUrl, values.otherImageUrl1, values.otherImageUrl2]
      .map((u) => u?.trim())
      .filter((u): u is string => Boolean(u));

    const listingAttributes: CatalogListingAttribute[] = [];
    if (values.color?.trim()) listingAttributes.push({ attribute: "Color", value: values.color.trim() });
    if (values.size?.trim()) listingAttributes.push({ attribute: "Size", value: values.size.trim() });
    if (values.material?.trim()) listingAttributes.push({ attribute: "Material", value: values.material.trim() });
    if (values.countryOfOrigin?.trim()) {
      listingAttributes.push({ attribute: "Country of Origin", value: values.countryOfOrigin.trim() });
    }

    const keywordsRaw = values.keywords?.trim();
    const targetKeywords = keywordsRaw
      ? keywordsRaw.split(/[,|;]/).map((k) => k.trim()).filter(Boolean)
      : undefined;

    let targetMarketplaces: string[] | undefined;
    const mpRaw = values.targetMarketplaces?.trim();
    if (mpRaw) {
      targetMarketplaces = mpRaw.split(/[,|;]/).map((m) => m.trim()).filter(Boolean);
    }

    products.push({
      productName,
      sku,
      category,
      priority: values.priority,
      assignedManager: values.assignedManager,
      referenceLinks: values.referenceLinks,
      driveFolderUrl: values.driveFolderUrl,
      targetMarketplaces,
      brandName: values.brandName,
      title: title || productName,
      productDescription: values.description?.trim() || undefined,
      bulletPoints: bullets.length > 0 ? bullets : undefined,
      targetKeywords,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      listingAttributes: listingAttributes.length > 0 ? listingAttributes : undefined,
    });
  }
  return products;
}

export function downloadCatalogTemplate(filename: string): void {
  const wb = buildCatalogTemplateWorkbook();
  const safeName = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename.replace(/\.csv$/i, "")}.xlsx`;
  XLSX.writeFile(wb, safeName);
}
