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
  buildTeamAwareCreditCtx,
} from "../lib/workspace-route-helpers";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { buildProductSuggestions, type ProductSuggestionInput } from "../lib/product-suggestions.js";
import { mapProductPriority, priorityFromStoredLevel } from "../lib/product-priority.js";
import {
  getProductOrderStats,
  listProductOrders,
} from "../lib/product-orders.js";
import { getProductSales, emptyProductSalesData } from "../lib/product-sales.js";
import {
  listProductMarketplaces,
} from "../lib/product-marketplaces.js";
import {
  ensureLiveWooCommerceListingPriceOnStore,
} from "../lib/woocommerce-publish.js";
import {
  getWooCommerceConnection,
  isWooCommercePublishReady,
} from "../lib/marketplace-connections.js";
import { createProductRecord, parseCreateProductBody } from "../lib/create-product.js";
import { importProductRecords, parseImportProductsBody } from "../lib/import-products.js";
import { applyProductProfileUpdates } from "../lib/product-profile-update.js";
import { applyProductListingUpdates } from "../lib/product-listing-update.js";
import { syncListingToConnectedMarketplaces } from "../lib/product-listing-sync.js";
import { loadUnifiedProductList } from "../lib/unified-product-list.js";
import { backfillWorkspaceScopeForOwner } from "../lib/backfill-workspace-scope.js";
import {
  loadProductDetail,
  parseProductSourceFromRequest,
  resolveStatsAuditId,
} from "../lib/product-detail-load.js";
import { runListingAuditForAuditId, sendRunListingAuditResult } from "../lib/listing-audit-runner.js";
import {
  getShopifyConnection,
  getShopifyConnectionPublic,
} from "../lib/marketplace-connections.js";
import { maybeSyncShopifyOrdersForWorkspace } from "../lib/shopify-order-sync.js";
import { isShopifyImportAsin } from "../lib/shopify-import-utils.js";

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

async function maybeRefreshShopifyOrders(req: Request, auditId: number): Promise<void> {
  const workspaceId = getActiveWorkspaceId(req);
  const [audit] = await db
    .select({ asin: auditsTable.asin })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);

  if (!isShopifyImportAsin(audit?.asin)) return;

  const connection = await getShopifyConnectionPublic(workspaceId);
  if (!connection?.storeUrl) return;

  const credentials = await getShopifyConnection(workspaceId);
  await maybeSyncShopifyOrdersForWorkspace({
    workspaceId,
    storeUrl: connection.storeUrl,
    clientId: credentials?.clientId,
    clientSecret: credentials?.clientSecret,
  });
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

router.post("/products/import", requireAuth, resolveTeamAndWorkspace, requireWorkspaceActionAny(["build_brand", "audits"], "create"), async (req: Request, res: Response): Promise<void> => {
  const parsed = parseImportProductsBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const result = await importProductRecords({
      products: parsed.data,
      ownerId: getEffectiveUserId(req),
      createdByUserId: auditCreatedByUserId(req),
      workspaceId: getActiveWorkspaceId(req),
    });

    res.status(201).json(result);
  } catch (err) {
    req.log?.error?.({ err }, "Import products failed");
    const message = err instanceof Error ? err.message : "Failed to import products";
    res.status(500).json({ error: message });
  }
});

router.get("/products", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const ownerUserId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  await backfillWorkspaceScopeForOwner(ownerUserId, workspaceId);

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

  const statsAuditId = await resolveStatsAuditId(req, id, parseProductSourceFromRequest(req));
  if (!statsAuditId) {
    res.json({ orders: [], total: 0, revenue: 0 });
    return;
  }

  await maybeRefreshShopifyOrders(req, statsAuditId);

  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const marketplace = typeof req.query.marketplace === "string" ? req.query.marketplace : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : undefined;

  const result = await listProductOrders(statsAuditId, { search, marketplace, status, dateRange });

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

  const statsAuditId = await resolveStatsAuditId(req, id, parseProductSourceFromRequest(req));
  if (!statsAuditId) {
    res.json(emptyProductSalesData());
    return;
  }

  await maybeRefreshShopifyOrders(req, statsAuditId);

  const sales = await getProductSales(statsAuditId);

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(sales);
});

router.get("/products/:id/marketplaces", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const statsAuditId = await resolveStatsAuditId(req, id, parseProductSourceFromRequest(req));
  if (!statsAuditId) {
    res.json({
      listings: [],
      activeCount: 0,
      listedCount: 0,
      liveMarketplaces: [],
      listedMarketplaces: [],
    });
    return;
  }

  const result = await listProductMarketplaces(statsAuditId);

  const wooListing = result.listings.find((listing) => listing.marketplace === "WooCommerce");
  if (wooListing?.status === "live" && wooListing.price != null && wooListing.price > 0) {
    const workspaceId = getActiveWorkspaceId(req);
    if (workspaceId) {
      const connection = await getWooCommerceConnection(workspaceId);
      if (connection && isWooCommercePublishReady(connection)) {
        try {
          await ensureLiveWooCommerceListingPriceOnStore({
            connection,
            auditId: statsAuditId,
            listing: wooListing,
          });
        } catch {
          // Non-fatal: SellerLens cards still show the stored price if the store sync fails.
        }
      }
    }
  }

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(result);
});

router.post("/products/:id/run-audit", requireAuth, resolveTeamAndWorkspace, requireWorkspaceActionAny(["build_brand", "audits"], "edit"), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const auditId = await resolveStatsAuditId(req, id, parseProductSourceFromRequest(req));
  if (!auditId) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const creditCtx = buildTeamAwareCreditCtx(req);
  const outcome = await runListingAuditForAuditId(auditId, creditCtx);
  await sendRunListingAuditResult(res, auditId, outcome);
});

router.get("/products/:id", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const product = await loadProductDetail(req, id, parseProductSourceFromRequest(req));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(product);
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
    listingTitle: string;
    bulletPoints: string[];
    targetKeywords: string[];
    descriptionHtml: string;
    price: number | string | null;
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
    if (body.listingTitle === undefined) {
      auditUpdates.title = trimmed;
    }
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
    await applyProductListingUpdates(id, {
      listingTitle: body.listingTitle,
      bulletPoints: body.bulletPoints,
      targetKeywords: body.targetKeywords,
      descriptionHtml: body.descriptionHtml,
      price: body.price,
      sku: body.sku,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update listing fields";
    res.status(400).json({ error: message });
    return;
  }

  try {
    await applyProductProfileUpdates(
      id,
      {
        sku: body.sku,
        priority: body.priority,
        assignedManager: body.assignedManager,
      },
      row.projectName?.trim() || row.productName?.trim() || "Untitled Product",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update product profile";
    res.status(400).json({ error: message });
    return;
  }

  const marketplaceSync = await syncListingToConnectedMarketplaces({
    req,
    auditId: id,
    body: body as Record<string, unknown>,
  });

  res.json({ success: true, marketplaceSync });
});

export default router;
