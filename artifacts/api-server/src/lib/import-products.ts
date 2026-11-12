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
  const category = pickString(row, ["category", "product_category"]);
  const brandName = pickString(row, ["brandName", "brand_name", "brand"]);
  const title = pickString(row, ["title", "listing_title", "listingTitle"]);
  const productDescription = pickString(row, ["productDescription", "product_description", "description"]);
  const keywordsRaw = pickString(row, ["targetKeywords", "target_keywords", "keywords", "search_terms"]);

  const imageUrls: string[] = [];
  for (const key of ["mainImageUrl", "main_image_url", "otherImageUrl1", "other_image_url_1", "otherImageUrl2", "other_image_url_2"]) {
    const url = pickString(row, [key]);
    if (url) imageUrls.push(url);
  }
  if (imageUrls.length === 0 && Array.isArray(row.imageUrls)) {
    for (const u of row.imageUrls) {
      if (typeof u === "string" && u.trim()) imageUrls.push(u.trim());
    }
  }

  const listingAttributes: Array<{ attribute: string; value: string }> = [];
  const color = pickString(row, ["color", "colour"]);
  const size = pickString(row, ["size"]);
  const material = pickString(row, ["material"]);
  const country = pickString(row, ["countryOfOrigin", "country_of_origin", "country"]);
  if (color) listingAttributes.push({ attribute: "Color", value: color });
  if (size) listingAttributes.push({ attribute: "Size", value: size });
  if (material) listingAttributes.push({ attribute: "Material", value: material });
  if (country) listingAttributes.push({ attribute: "Country of Origin", value: country });
  if (Array.isArray(row.listingAttributes)) {
    for (const a of row.listingAttributes) {
      if (
        a
        && typeof a === "object"
        && typeof (a as { attribute?: unknown }).attribute === "string"
        && typeof (a as { value?: unknown }).value === "string"
      ) {
        listingAttributes.push({
          attribute: (a as { attribute: string }).attribute.trim(),
          value: (a as { value: string }).value.trim(),
        });
      }
    }
  }

  const bulletPoints: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const b = pickString(row, [`bullet${i}`, `bullet_${i}`, `bulletPoint${i}`]);
    if (b) bulletPoints.push(b);
  }
  if (bulletPoints.length === 0) {
    const bulletsRaw = row.bulletPoints ?? row.bullet_points;
    if (Array.isArray(bulletsRaw)) {
      for (const b of bulletsRaw) {
        if (typeof b === "string" && b.trim()) bulletPoints.push(b.trim());
      }
    }
  }

  let targetKeywords: string[] | undefined;
  if (keywordsRaw) {
    targetKeywords = keywordsRaw.split(/[,|;]/).map((k) => k.trim()).filter(Boolean);
  } else if (Array.isArray(row.targetKeywords)) {
    targetKeywords = row.targetKeywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim());
  }

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
    targetMarketplaces: targetMarketplaces.length > 0 ? targetMarketplaces : ["Amazon"],
    category: category || undefined,
    brandName: brandName || undefined,
    title: title || undefined,
    bulletPoints: bulletPoints.length > 0 ? bulletPoints : undefined,
    targetKeywords,
    productDescription: productDescription || undefined,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    listingAttributes: listingAttributes.length > 0 ? listingAttributes : undefined,
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
