import { db, auditsTable, productProfilesTable, productMarketplaceListingsTable } from "@workspace/db";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";

export const TARGET_MARKETPLACES = [
  "Amazon",
  "Flipkart",
  "Shopsy",
  "Shopify",
  "WooCommerce",
  "Meesho",
] as const;

export interface CreateProductBody {
  productName: string;
  sku: string;
  priority: "high" | "medium" | "low";
  assignedManager?: string;
  referenceLinks?: string;
  driveFolderUrl?: string;
  notes?: string;
  targetMarketplaces: string[];
}

export function parseCreateProductBody(body: unknown):
  | { success: true; data: CreateProductBody }
  | { success: false; error: string } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid request body" };
  }
  const raw = body as Record<string, unknown>;
  const productName = typeof raw.productName === "string" ? raw.productName.trim() : "";
  const sku = typeof raw.sku === "string" ? raw.sku.trim() : "";
  if (!productName) return { success: false, error: "Product name is required" };
  if (!sku) return { success: false, error: "SKU is required" };

  const priorityRaw = typeof raw.priority === "string" ? raw.priority : "medium";
  const priority = priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";
  const targetMarketplaces = Array.isArray(raw.targetMarketplaces)
    ? raw.targetMarketplaces.filter((m): m is string => typeof m === "string")
    : [];

  return {
    success: true,
    data: {
      productName,
      sku,
      priority,
      assignedManager: typeof raw.assignedManager === "string" ? raw.assignedManager : undefined,
      referenceLinks: typeof raw.referenceLinks === "string" ? raw.referenceLinks : undefined,
      driveFolderUrl: typeof raw.driveFolderUrl === "string" ? raw.driveFolderUrl : undefined,
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      targetMarketplaces,
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

  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: ownerId,
      createdByUserId,
      workspaceId,
      projectName: body.productName.trim(),
      productName: body.productName.trim(),
      asin: null,
      brandName: brandGuess,
      category: null,
      title: body.productName.trim(),
      bulletPoints: [],
      imageUrls: [],
      targetKeywords: [],
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
    notes: body.notes?.trim() || null,
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
