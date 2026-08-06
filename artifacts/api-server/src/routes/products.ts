import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, competitorsTable, userProfilesTable, productProfilesTable } from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { buildProductSuggestions, type ProductSuggestionInput } from "../lib/product-suggestions.js";
import { mapProductPriority, priorityFromStoredLevel } from "../lib/product-priority.js";
import {
  ensureSampleProductOrders,
  getProductOrderStats,
  listProductOrders,
} from "../lib/product-orders.js";
import { getProductSales } from "../lib/product-sales.js";
import {
  ensureSampleMarketplaceListings,
  listProductMarketplaces,
} from "../lib/product-marketplaces.js";
import { createProductRecord, parseCreateProductBody } from "../lib/create-product.js";
import { applyProductProfileUpdates } from "../lib/product-profile-update.js";
import { loadUnifiedProductList } from "../lib/unified-product-list.js";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  return true;
}

function pickThumbnail(opts: {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): string | null {
  const candidates: string[] = [];
  for (const rec of opts.imageRecords ?? []) {
    if (isUsableImageUrl(rec.currentUrl)) candidates.push(rec.currentUrl.trim());
  }
  for (const url of opts.imageUrls ?? []) {
    if (isUsableImageUrl(url)) candidates.push(url.trim());
  }
  const generated = opts.generatedImages;
  if (generated) {
    for (const url of [
      ...(generated.main ?? []),
      ...(generated.lifestyle ?? []),
      ...(generated.infographic ?? []),
    ]) {
      if (isUsableImageUrl(url)) candidates.push(url.trim());
    }
  }
  return candidates[0] ?? null;
}

function deriveSku(productName: string, id: number): string {
  const parts = productName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase());
  const prefix = parts.join("-") || "PRD";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

type ProductStatus = "active" | "in_progress" | "draft" | "failed";

function mapProductStatus(status: string, currentStep: number | null): { status: ProductStatus; label: string } {
  if (status === "complete") return { status: "active", label: "Active" };
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (status === "draft" && (currentStep ?? 1) > 1) {
    return { status: "in_progress", label: "In progress" };
  }
  if (status === "pending") return { status: "in_progress", label: "In progress" };
  return { status: "draft", label: "Draft" };
}

const WORKFLOW_STEP_LABELS = ["Upload", "Listing", "Graphics", "A+ Content", "Export"];

function mapStageLabel(status: string, currentStep: number | null): string {
  if (status === "complete") return "Live";
  const step = Math.min(5, Math.max(1, currentStep ?? 1));
  if (step >= 5) return "Ready to export";
  return WORKFLOW_STEP_LABELS[step - 1] ?? "Upload";
}

function calcProgress(status: string, currentStep: number | null): number {
  if (status === "complete") return 100;
  const step = currentStep ?? 1;
  return Math.min(100, Math.round((step / 5) * 100));
}

function managerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function buildNotes(audit: {
  result?: { summary?: string } | null;
  generatedContent?: { bulletPoints?: string[] } | null;
  bulletPoints?: string[];
}): string {
  const summary = audit.result?.summary?.trim();
  if (summary) return summary;
  const bullets = audit.generatedContent?.bulletPoints ?? audit.bulletPoints ?? [];
  if (bullets.length > 0) {
    return bullets.slice(0, 2).join(" ");
  }
  return "No notes yet. Complete the listing step in Build Your Brand to generate product notes.";
}

function countImages(row: {
  imageUrls?: string[] | null;
  imageRecords?: unknown[] | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): number {
  const urls = new Set<string>();
  for (const u of row.imageUrls ?? []) {
    if (isUsableImageUrl(u)) urls.add(u.trim());
  }
  for (const rec of row.imageRecords ?? []) {
    const url = (rec as { currentUrl?: string }).currentUrl;
    if (isUsableImageUrl(url)) urls.add(url.trim());
  }
  const g = row.generatedImages;
  if (g) {
    for (const u of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (isUsableImageUrl(u)) urls.add(u.trim());
    }
  }
  return urls.size;
}

function mapRowToProductListItem(row: {
  id: number;
  productName: string;
  projectName: string | null;
  brandName: string | null;
  category: string | null;
  status: string;
  currentStep: number | null;
  imageUrls: string[] | null;
  imageRecords: unknown;
  generatedImages: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
  const mapped = mapProductStatus(row.status, row.currentStep);
  return {
    id: row.id,
    name,
    sku: deriveSku(name, row.id),
    imageUrl: pickThumbnail({
      imageUrls: row.imageUrls,
      imageRecords: row.imageRecords as Array<{ currentUrl?: string }> | null,
      generatedImages: row.generatedImages as { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null,
    }),
    channels: [] as string[],
    price: null as number | null,
    currency: "INR",
    stock: null as number | null,
    status: mapped.status,
    statusLabel: mapped.label,
    currentStep: row.currentStep,
    brandName: row.brandName,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    workflowUrl: `/audits/workflow?resume=${row.id}`,
  };
}

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function auditCreatedByUserId(req: Request): string | null {
  const ctx = getWorkspaceCtx(req);
  return ctx.isAccountOwner ? null : (req as AuthedRequest).userId;
}

function productsWorkspaceFilter(ownerId: string, workspaceId: number) {
  return and(
    eq(auditsTable.userId, ownerId),
    or(
      eq(auditsTable.workspaceId, workspaceId),
      and(isNull(auditsTable.workspaceId), eq(auditsTable.userId, ownerId)),
    ),
  );
}

async function productsScopeWhere(req: Request) {
  const ownerId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "build_brand", worked, "audit", auditsTable);
  return and(
    productsWorkspaceFilter(ownerId, workspaceId),
    eq(auditsTable.isDeleted, 0),
    sql`${auditsTable.status} != 'archived'`,
    sql`(${auditsTable.asin} IS NULL OR trim(${auditsTable.asin}) = '')`,
    ownFilter,
  );
}

router.post("/products", requireAuth, resolveTeamAndWorkspace, requireWorkspaceActionAny(["build_brand", "audits"], "create"), async (req: Request, res: Response): Promise<void> => {
  const parsed = parseCreateProductBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const product = await createProductRecord({
      body: parsed.data,
      ownerId: getEffectiveUserId(req),
      createdByUserId: auditCreatedByUserId(req),
      workspaceId: getActiveWorkspaceId(req),
    });

    res.status(201).json(product);
  } catch (err) {
    req.log?.error?.({ err }, "Create product failed");
    const message = err instanceof Error ? err.message : "Failed to create product";
    res.status(500).json({ error: message });
  }
});

router.get("/products", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const products = await loadUnifiedProductList(req as AuthedRequest);

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({ products });
});

router.get("/products/:id/orders", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select({ id: auditsTable.id })
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);
  await ensureSampleProductOrders(id, workspaceId);

  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const marketplace = typeof req.query.marketplace === "string" ? req.query.marketplace : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : undefined;

  const result = await listProductOrders(id, { search, marketplace, status, dateRange });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({
    orders: result.orders,
    total: result.total,
    revenue: result.revenue,
  });
});

router.get("/products/:id/sales", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select({ id: auditsTable.id })
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);
  await ensureSampleProductOrders(id, workspaceId);

  const sales = await getProductSales(id);

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(sales);
});

router.get("/products/:id/marketplaces", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      projectName: auditsTable.projectName,
    })
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);
  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
  const sku = deriveSku(name, row.id);
  await ensureSampleMarketplaceListings(id, workspaceId, name, sku);

  const result = await listProductMarketplaces(id);

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(result);
});

router.get("/products/:id", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select()
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const competitors = await db
    .select({
      id: competitorsTable.id,
      productName: competitorsTable.productName,
      asin: competitorsTable.asin,
    })
    .from(competitorsTable)
    .where(and(eq(competitorsTable.auditId, id), eq(competitorsTable.isDeleted, 0)));

  const managerUserId = row.createdByUserId ?? row.userId;
  const [managerProfile] = await db
    .select({ fullName: userProfilesTable.fullName, companyName: userProfilesTable.companyName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, managerUserId))
    .limit(1);

  const managerName = managerProfile?.fullName?.trim()
    || managerProfile?.companyName?.trim()
    || "Account Owner";

  const [profile] = await db
    .select()
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, id))
    .limit(1);

  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
  const sku = profile?.sku?.trim() || deriveSku(name, row.id);
  const displayManagerName = profile?.assignedManager?.trim() || managerName;
  const mapped = mapProductStatus(row.status, row.currentStep);
  const stageLabel = mapStageLabel(row.status, row.currentStep);
  const progress = calcProgress(row.status, row.currentStep);
  const workflowUrl = `/audits/workflow?resume=${row.id}`;

  const referenceLinks: Array<{ label: string; url: string }> = [];
  if (row.asin?.trim()) {
    referenceLinks.push({
      label: "Amazon Ref",
      url: `https://www.amazon.in/dp/${row.asin.trim()}`,
    });
  }
  competitors.forEach((c, i) => {
    const label = c.productName?.trim() || `Competitor ${String.fromCharCode(65 + i)}`;
    const url = c.asin?.trim()
      ? `https://www.amazon.in/dp/${c.asin.trim()}`
      : "#";
    referenceLinks.push({ label, url });
  });

  const brand = row.brandName?.trim() || "Brand";
  const driveFolder = `${brand} / ${name}`;

  const aiSuggestions = buildProductSuggestions({
    productName: row.productName,
    title: row.title,
    brandName: row.brandName,
    category: row.category,
    bulletPoints: row.bulletPoints,
    generatedContent: row.generatedContent as ProductSuggestionInput["generatedContent"],
    targetKeywords: row.targetKeywords,
    imageUrls: row.imageUrls,
    imageRecords: row.imageRecords as ProductSuggestionInput["imageRecords"],
    generatedImages: row.generatedImages as ProductSuggestionInput["generatedImages"],
    currentStep: row.currentStep,
    status: row.status,
    overallScore: row.overallScore,
    result: row.result,
    competitorCount: competitors.length,
  });

  const priority = priorityFromStoredLevel(profile?.priority)
    ?? mapProductPriority({
    overallScore: row.overallScore,
    status: row.status,
    currentStep: row.currentStep,
    aiSuggestionCount: aiSuggestions.length,
  });

  const workspaceId = getActiveWorkspaceId(req);
  await ensureSampleProductOrders(id, workspaceId);
  const orderStats = await getProductOrderStats(id);
  await ensureSampleMarketplaceListings(id, workspaceId, name, deriveSku(name, row.id));
  const marketplaceStats = await listProductMarketplaces(id);

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({
    ...mapRowToProductListItem(row),
    sku,
    title: name,
    stageLabel,
    priorityLabel: priority.label,
    priorityLevel: priority.level,
    progressPercent: progress,
    manager: {
      name: displayManagerName,
      initials: managerInitials(displayManagerName),
    },
    notes: profile?.notes?.trim() || buildNotes(row),
    referenceLinks,
    driveFolder,
    driveFolderUrl: workflowUrl,
    workflowSteps: WORKFLOW_STEP_LABELS.map((label, index) => ({
      id: index + 1,
      label,
      completed: (row.currentStep ?? 1) > index + 1 || row.status === "complete",
      active: (row.currentStep ?? 1) === index + 1 && row.status !== "complete",
    })),
    stats: {
      totalOrders: orderStats.totalOrders,
      revenue: orderStats.revenue > 0 ? orderStats.revenue : null,
      revenueCurrency: "USD",
      marketplacesActive: marketplaceStats.activeCount,
      listingScore: row.overallScore ?? 0,
      competitorCount: competitors.length,
      imageCount: countImages(row),
      keywordCount: (row.targetKeywords ?? []).length,
    },
    generatedContent: row.generatedContent,
    bulletPoints: row.bulletPoints,
    targetKeywords: row.targetKeywords,
    detailUrl: `/products/${row.id}`,
    workflowUrl,
    aiSuggestions,
    status: mapped.status,
    statusLabel: mapped.status === "active" ? "Live" : mapped.label,
  });
});

router.patch("/products/:id", requireAuth, resolveTeamAndWorkspace, requireWorkspaceActionAny(["build_brand", "audits"], "edit"), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const body = req.body as Partial<{
    productName: string;
    brandName: string;
    category: string;
    sku: string;
    priority: string;
    assignedManager: string;
    notes: string;
  }>;

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select()
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const auditUpdates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.productName === "string") {
    const trimmed = body.productName.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }
    auditUpdates.projectName = trimmed;
    auditUpdates.productName = trimmed;
    auditUpdates.title = trimmed;
  }
  if (typeof body.brandName === "string") {
    auditUpdates.brandName = body.brandName.trim() || null;
  }
  if (typeof body.category === "string") {
    auditUpdates.category = body.category.trim() || null;
  }

  if (Object.keys(auditUpdates).length > 1) {
    await db.update(auditsTable).set(auditUpdates).where(eq(auditsTable.id, id));
  }

  try {
    await applyProductProfileUpdates(
      id,
      {
        sku: body.sku,
        priority: body.priority,
        assignedManager: body.assignedManager,
        notes: body.notes,
      },
      row.projectName?.trim() || row.productName?.trim() || "Untitled Product",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update product profile";
    res.status(400).json({ error: message });
    return;
  }

  res.json({ success: true });
});

export default router;
