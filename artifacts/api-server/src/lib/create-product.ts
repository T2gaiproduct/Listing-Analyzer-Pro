import { db, auditsTable, productProfilesTable, productMarketplaceListingsTable } from "@workspace/db";
import type { GeneratedContent } from "@workspace/db";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";

export const TARGET_MARKETPLACES = [
  "Amazon",
  "Flipkart",
  "Shopsy",
  "Shopify",
  "WooCommerce",
  "eBay",
  "Walmart",
  "Meesho",
] as const;

export interface CreateProductBody {
  productName: string;
  sku: string;
  priority: "high" | "medium" | "low";
  assignedManager?: string;
  referenceLinks?: string;
  driveFolderUrl?: string;
  targetMarketplaces: string[];
  category?: string;
  brandName?: string;
  title?: string;
  bulletPoints?: string[];
  targetKeywords?: string[];
  productDescription?: string;
  imageUrls?: string[];
  listingAttributes?: Array<{ attribute: string; value: string }>;
}

export function parseCreateProductBody(body: unknown):
  | { success: true; data: CreateProductBody }
  | { success: false; error: string } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid request body" };
  }
  const raw = body as Record<string, unknown>;
  const titleRaw = typeof raw.title === "string" ? raw.title.trim() : "";
  const productName = typeof raw.productName === "string" ? raw.productName.trim() : titleRaw;
  const sku = typeof raw.sku === "string" ? raw.sku.trim() : "";
  if (!productName) return { success: false, error: "Product name or title is required" };
  if (!sku) return { success: false, error: "SKU is required" };

  const priorityRaw = typeof raw.priority === "string" ? raw.priority : "medium";
  const priority = priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";
  const targetMarketplaces = Array.isArray(raw.targetMarketplaces)
    ? raw.targetMarketplaces.filter((m): m is string => typeof m === "string")
    : [];

  const category = typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : undefined;
  const brandName = typeof raw.brandName === "string" && raw.brandName.trim() ? raw.brandName.trim() : undefined;
  const title = titleRaw || productName;
  const productDescription =
    typeof raw.productDescription === "string" && raw.productDescription.trim()
      ? raw.productDescription.trim()
      : undefined;
  const imageUrls = Array.isArray(raw.imageUrls)
    ? raw.imageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim())
    : undefined;
  const listingAttributes = Array.isArray(raw.listingAttributes)
    ? raw.listingAttributes.filter(
        (a): a is { attribute: string; value: string } =>
          Boolean(a)
          && typeof a === "object"
          && typeof (a as { attribute?: unknown }).attribute === "string"
          && typeof (a as { value?: unknown }).value === "string"
          && (a as { attribute: string }).attribute.trim().length > 0
          && (a as { value: string }).value.trim().length > 0,
      ).map((a) => ({ attribute: a.attribute.trim(), value: a.value.trim() }))
    : undefined;
  const bulletPoints = Array.isArray(raw.bulletPoints)
    ? raw.bulletPoints.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
    : undefined;
  const targetKeywords = Array.isArray(raw.targetKeywords)
    ? raw.targetKeywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim())
    : undefined;

  return {
    success: true,
    data: {
      productName,
      sku,
      priority,
      assignedManager: typeof raw.assignedManager === "string" ? raw.assignedManager : undefined,
      referenceLinks: typeof raw.referenceLinks === "string" ? raw.referenceLinks : undefined,
      driveFolderUrl: typeof raw.driveFolderUrl === "string" ? raw.driveFolderUrl : undefined,
      targetMarketplaces,
      category,
      brandName,
      title,
      bulletPoints: bulletPoints?.length ? bulletPoints : undefined,
      targetKeywords: targetKeywords?.length ? targetKeywords : undefined,
      productDescription,
      imageUrls: imageUrls?.length ? imageUrls : undefined,
      listingAttributes: listingAttributes?.length ? listingAttributes : undefined,
    },
  };
}

export async function createProductRecord(input: {
  body: CreateProductBody;
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
}) {
  const { body, ownerId, createdByUserId, workspaceId } = input;
  const brandGuess = body.productName.trim().split(/\s+/)[0] ?? null;
  const brandName = body.brandName?.trim() || brandGuess;
  const category = body.category?.trim() || null;
  const title = body.title?.trim() || body.productName.trim();
  const bulletPoints = body.bulletPoints?.length ? body.bulletPoints : [];
  const targetKeywords = body.targetKeywords?.length ? body.targetKeywords : [];
  const imageUrls = body.imageUrls?.length ? body.imageUrls : [];
  const productDescription = body.productDescription?.trim() || null;

  let sourceListingContent: GeneratedContent | undefined;
  if (
    body.listingAttributes?.length
    || productDescription
    || bulletPoints.length > 0
    || title
  ) {
    sourceListingContent = {
      title,
      bulletPoints,
      keywords: targetKeywords,
      htmlDescription: productDescription ?? "",
      attributes: body.listingAttributes?.length ? body.listingAttributes : undefined,
    };
  }

  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: ownerId,
      createdByUserId,
      workspaceId,
      projectName: body.productName.trim(),
      productName: body.productName.trim(),
      productDescription,
      asin: null,
      brandName,
      category,
      title,
      bulletPoints,
      imageUrls,
      targetKeywords,
      sourceListingContent,
      overallScore: 0,
      status: "draft",
      currentStep: 1,
    })
    .returning();

  await db.insert(productProfilesTable).values({
    auditId: audit.id,
    sku: body.sku.trim(),
    priority: body.priority,
    assignedManager: body.assignedManager?.trim() || null,
    referenceLinks: body.referenceLinks?.trim() || null,
    driveFolderUrl: body.driveFolderUrl?.trim() || null,
    workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
    targetMarketplaces: body.targetMarketplaces,
  });

  const selected = new Set(body.targetMarketplaces);
  await db.insert(productMarketplaceListingsTable).values(
    TARGET_MARKETPLACES.map((marketplace) => ({
      auditId: audit.id,
      workspaceId,
      marketplace,
      status: selected.has(marketplace) ? "pending" : "not_listed",
      sku: selected.has(marketplace) ? body.sku.trim() : null,
      currency: "USD",
    })),
  );

  return {
    id: audit.id,
    name: audit.projectName ?? audit.productName,
    sku: body.sku.trim(),
    workflowUrl: `/audits/workflow?resume=${audit.id}`,
    detailUrl: `/products/${audit.id}`,
  };
}
