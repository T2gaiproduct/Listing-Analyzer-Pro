import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, amazonSellerConnectionsTable } from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
} from "../lib/workspace-route-helpers";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { getWorkspaceMarketplacesOverview } from "../lib/workspace-marketplaces.js";
import {
  disconnectStoreConnection,
  getStoreConnection,
  saveStoreConnection,
  type StoreMarketplace,
} from "../lib/marketplace-connections.js";
import {
  ensureAmazonAutoEnabled,
  isAmazonSpConfigured,
  isAmazonPublishReady,
  canSignSpApiRequests,
} from "../lib/amazon-sp-settings.js";

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

function parseStorePlatform(raw: string): StoreMarketplace | null {
  if (raw === "shopify" || raw === "woocommerce") return raw;
  return null;
}

function normalizeStoreUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function loadAmazonConnectionStatus(userId: string) {
  const settings = await ensureAmazonAutoEnabled();
  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(and(eq(amazonSellerConnectionsTable.userId, userId), eq(amazonSellerConnectionsTable.isDeleted, 0)))
    .limit(1);

  return {
    configured: isAmazonSpConfigured(settings),
    publishReady: isAmazonPublishReady(settings),
    enabled: settings.enabled,
    sandbox: settings.sandbox,
    canSignRequests: canSignSpApiRequests(settings),
    connected: Boolean(connection),
    sellerId: connection?.sellerId ?? null,
    marketplaceIds: connection?.marketplaceIds ?? [],
    defaultMarketplace: settings.defaultMarketplace,
  };
}

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

async function productsScopeWhere(req: Request) {
  const ownerId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "build_brand", worked, "audit", auditsTable);
  return and(
    eq(auditsTable.userId, ownerId),
    or(
      eq(auditsTable.workspaceId, workspaceId),
      and(isNull(auditsTable.workspaceId), eq(auditsTable.userId, ownerId)),
    ),
    eq(auditsTable.isDeleted, 0),
    sql`${auditsTable.status} != 'archived'`,
    sql`(${auditsTable.asin} IS NULL OR trim(${auditsTable.asin}) = '')`,
    ownFilter,
  );
}

router.get("/marketplaces/connections", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);

  const [amazon, shopify, woocommerce] = await Promise.all([
    loadAmazonConnectionStatus(userId),
    getStoreConnection(workspaceId, "shopify"),
    getStoreConnection(workspaceId, "woocommerce"),
  ]);

  res.json({
    amazon,
    shopify: {
      connected: Boolean(shopify),
      storeUrl: shopify?.storeUrl ?? null,
      connectedAt: shopify?.connectedAt ?? null,
    },
    woocommerce: {
      connected: Boolean(woocommerce),
      storeUrl: woocommerce?.storeUrl ?? null,
      connectedAt: woocommerce?.connectedAt ?? null,
    },
  });
});

router.post("/marketplaces/connections/:platform", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const platform = parseStorePlatform(String(req.params.platform ?? ""));
  if (!platform) {
    res.status(400).json({ error: "Invalid marketplace platform" });
    return;
  }

  const storeUrl = normalizeStoreUrl(String((req.body as { storeUrl?: string })?.storeUrl ?? ""));
  if (!storeUrl) {
    res.status(400).json({ error: "A valid store URL is required" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);
  const connection = await saveStoreConnection(workspaceId, platform, storeUrl);

  res.status(201).json({
    connected: true,
    storeUrl: connection.storeUrl,
    connectedAt: connection.connectedAt,
  });
});

router.delete("/marketplaces/connections/:platform", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const platform = parseStorePlatform(String(req.params.platform ?? ""));
  if (!platform) {
    res.status(400).json({ error: "Invalid marketplace platform" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);
  await disconnectStoreConnection(workspaceId, platform);
  res.status(204).end();
});

router.get("/marketplaces", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const where = await productsScopeWhere(req);
  const workspaceId = getActiveWorkspaceId(req);

  const rows = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      projectName: auditsTable.projectName,
      imageUrls: auditsTable.imageUrls,
      imageRecords: auditsTable.imageRecords,
      generatedImages: auditsTable.generatedImages,
    })
    .from(auditsTable)
    .where(where)
    .orderBy(desc(auditsTable.updatedAt));

  const products = rows.map((row) => {
    const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
    return {
      id: row.id,
      name,
      sku: deriveSku(name, row.id),
      imageUrl: pickThumbnail({
        imageUrls: row.imageUrls,
        imageRecords: row.imageRecords as Array<{ currentUrl?: string }> | null,
        generatedImages: row.generatedImages as { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null,
      }),
    };
  });

  const overview = await getWorkspaceMarketplacesOverview({ workspaceId, products });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json(overview);
});

export default router;
