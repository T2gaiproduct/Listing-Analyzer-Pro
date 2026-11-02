import * as XLSX from "xlsx";

export type BulkCatalogFieldKey =
  | "productName"
  | "sku"
  | "brandName"
  | "title"
  | "bullet1"
  | "bullet2"
  | "bullet3"
  | "bullet4"
  | "bullet5"
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
}

export const BULK_CATALOG_FIELDS: BulkCatalogFieldDef[] = [
  {
    key: "productName",
    label: "Product name",
    required: true,
    aliases: ["product_name", "product name", "name", "product"],
  },
  {
    key: "sku",
    label: "SKU",
    required: true,
    aliases: ["product_sku", "seller_sku", "item_sku"],
  },
  {
    key: "brandName",
    label: "Brand",
    required: false,
    aliases: ["brand", "brand_name"],
  },
  {
    key: "title",
    label: "Listing title",
    required: false,
    aliases: ["listing_title", "item_name", "product_title"],
  },
  {
    key: "bullet1",
    label: "Bullet 1",
    required: false,
    aliases: ["bullet_1", "bullet point 1", "bp1"],
  },
  {
    key: "bullet2",
    label: "Bullet 2",
    required: false,
    aliases: ["bullet_2", "bullet point 2", "bp2"],
  },
  {
    key: "bullet3",
    label: "Bullet 3",
    required: false,
    aliases: ["bullet_3", "bullet point 3", "bp3"],
  },
  {
    key: "bullet4",
    label: "Bullet 4",
    required: false,
    aliases: ["bullet_4", "bullet point 4", "bp4"],
  },
  {
    key: "bullet5",
    label: "Bullet 5",
    required: false,
    aliases: ["bullet_5", "bullet point 5", "bp5"],
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

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) {
      mapping[header] = BULK_CATALOG_SKIP;
      continue;
    }
    let matched: BulkCatalogFieldKey | typeof BULK_CATALOG_SKIP = BULK_CATALOG_SKIP;
    for (const field of BULK_CATALOG_FIELDS) {
      const candidates = [field.key, field.label, ...field.aliases].map(normalizeHeader);
      if (candidates.some((c) => c === norm || norm.includes(c) || c.includes(norm))) {
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
  return BULK_CATALOG_FIELDS.filter((f) => f.required).every((f) => mapped.has(f.key));
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

export function buildCatalogTemplateCsv(): string {
  const headers = BULK_CATALOG_FIELDS.map((f) => f.label);
  const sample = [
    "Example Watch",
    "SKU-001",
    "Example Brand",
    "Example Watch — Premium Dial",
    "Bullet one",
    "Bullet two",
    "",
    "",
    "",
    "watch, chronograph",
    "medium",
    "Alex",
    "https://example.com/ref",
    "",
    "Amazon, Shopify",
  ];
  return `${headers.join(",")}\n${sample.map(escapeCsvCell).join(",")}\n`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
  bulletPoints?: string[];
  targetKeywords?: string[];
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
    const productName = values.productName?.trim();
    const sku = values.sku?.trim();
    if (!productName || !sku) continue;

    const bullets = [values.bullet1, values.bullet2, values.bullet3, values.bullet4, values.bullet5]
      .map((b) => b?.trim())
      .filter((b): b is string => Boolean(b));

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
      title: values.title,
      bulletPoints: bullets.length > 0 ? bullets : undefined,
      targetKeywords,
    });
  }
  return products;
}

export function downloadCatalogTemplate(filename: string): void {
  const csv = buildCatalogTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
