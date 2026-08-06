import { createProductRecord, parseCreateProductBody, type CreateProductBody } from "./create-product.js";

export type ImportProductResult = {
  imported: Array<{
    id: number;
    name: string;
    sku: string;
    workflowUrl: string;
    detailUrl: string;
  }>;
  errors: Array<{ row: number; error: string }>;
};

function normalizeImportRow(raw: unknown, rowIndex: number):
  | { success: true; data: CreateProductBody }
  | { success: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: `Row ${rowIndex}: invalid row` };
  }

  const row = raw as Record<string, unknown>;
  const productName = pickString(row, ["productName", "product_name", "name", "title"]);
  const sku = pickString(row, ["sku", "product_sku"]);
  const priority = pickString(row, ["priority"]) || "medium";
  const assignedManager = pickString(row, ["assignedManager", "assigned_manager", "manager"]);
  const referenceLinks = pickString(row, ["referenceLinks", "reference_links", "references"]);
  const driveFolderUrl = pickString(row, ["driveFolderUrl", "drive_folder_url", "drive_folder"]);
  const notes = pickString(row, ["notes", "description"]);

  let targetMarketplaces: string[] = [];
  const marketplacesRaw = row.targetMarketplaces ?? row.target_marketplaces ?? row.marketplaces ?? row.channels;
  if (Array.isArray(marketplacesRaw)) {
    targetMarketplaces = marketplacesRaw.filter((m): m is string => typeof m === "string");
  } else if (typeof marketplacesRaw === "string" && marketplacesRaw.trim()) {
    targetMarketplaces = marketplacesRaw
      .split(/[|,;]/)
      .map((m) => m.trim())
      .filter(Boolean);
  }

  return parseCreateProductBody({
    productName,
    sku,
    priority,
    assignedManager,
    referenceLinks,
    driveFolderUrl,
    notes,
    targetMarketplaces: targetMarketplaces.length > 0 ? targetMarketplaces : ["Amazon"],
  });
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function parseImportProductsBody(body: unknown):
  | { success: true; data: CreateProductBody[] }
  | { success: false; error: string } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid request body" };
  }

  const productsRaw = (body as { products?: unknown }).products;
  if (!Array.isArray(productsRaw)) {
    return { success: false, error: "products array is required" };
  }
  if (productsRaw.length === 0) {
    return { success: false, error: "At least one product row is required" };
  }
  if (productsRaw.length > 200) {
    return { success: false, error: "Maximum 200 products per import" };
  }

  const products: CreateProductBody[] = [];
  const errors: string[] = [];

  productsRaw.forEach((row, index) => {
    const parsed = normalizeImportRow(row, index + 1);
    if (!parsed.success) {
      errors.push(parsed.error);
      return;
    }
    products.push(parsed.data);
  });

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return { success: true, data: products };
}

export async function importProductRecords(input: {
  products: CreateProductBody[];
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
}): Promise<ImportProductResult> {
  const imported: ImportProductResult["imported"] = [];
  const errors: ImportProductResult["errors"] = [];

  for (const [index, body] of input.products.entries()) {
    try {
      const product = await createProductRecord({
        body,
        ownerId: input.ownerId,
        createdByUserId: input.createdByUserId,
        workspaceId: input.workspaceId,
      });
      imported.push(product);
    } catch (err) {
      errors.push({
        row: index + 1,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return { imported, errors };
}
