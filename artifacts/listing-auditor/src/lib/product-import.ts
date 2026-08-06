export type ImportProductRow = {
  productName: string;
  sku: string;
  priority?: string;
  assignedManager?: string;
  referenceLinks?: string;
  driveFolderUrl?: string;
  notes?: string;
  targetMarketplaces?: string;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string): keyof ImportProductRow | null {
  const key = header.trim().toLowerCase().replace(/\s+/g, "_");
  switch (key) {
    case "product_name":
    case "productname":
    case "name":
    case "title":
      return "productName";
    case "sku":
    case "product_sku":
      return "sku";
    case "priority":
      return "priority";
    case "assigned_manager":
    case "manager":
      return "assignedManager";
    case "reference_links":
    case "references":
    case "reference_links_urls":
      return "referenceLinks";
    case "drive_folder_url":
    case "drive_folder":
      return "driveFolderUrl";
    case "notes":
    case "description":
      return "notes";
    case "target_marketplaces":
    case "marketplaces":
    case "channels":
      return "targetMarketplaces";
    default:
      return null;
  }
}

export function parseProductsCsv(text: string): ImportProductRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one product row.");
  }

  const headers = parseCsvLine(lines[0]!);
  const fieldIndexes = headers.map((header) => normalizeHeader(header));

  const rows: ImportProductRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]!);
    const row: ImportProductRow = { productName: "", sku: "" };

    fieldIndexes.forEach((field, index) => {
      if (!field) return;
      const value = values[index]?.trim() ?? "";
      if (!value) return;
      row[field] = value;
    });

    if (!row.productName && !row.sku) continue;
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("No product rows found in CSV.");
  }

  const invalid = rows.find((row) => !row.productName.trim() || !row.sku.trim());
  if (invalid) {
    throw new Error("Each row must include productName and sku.");
  }

  return rows;
}

export const PRODUCT_IMPORT_CSV_TEMPLATE = [
  "productName,sku,priority,assignedManager,referenceLinks,driveFolderUrl,notes,targetMarketplaces",
  "Organic Honey 500g,OH-500G-001,high,Account Owner,https://amazon.in/example,,Premium honey,Amazon|Shopify|WooCommerce",
].join("\n");

export function downloadProductImportTemplate(): void {
  const blob = new Blob([PRODUCT_IMPORT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "product-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
