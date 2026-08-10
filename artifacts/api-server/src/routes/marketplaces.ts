import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable } from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { getWorkspaceMarketplacesOverview } from "../lib/workspace-marketplaces.js";
import {
  disconnectStoreConnection,
  getShopifyConnection,
  getShopifyConnectionPublic,
  getStoreConnection,
  getWooCommerceConnection,
  isShopifyPublishReady,
  isWooCommercePublishReady,
  saveShopifyConnection,
  saveWooCommerceConnection,
  type StoreMarketplace,
} from "../lib/marketplace-connections.js";
import { verifyWooCommerceConnection } from "../lib/woocommerce-connection-verify.js";
import {
  buildAmazonOAuthRedirectUri,
  disconnectAmazonWorkspaceConnection,
  getAmazonWorkspaceConnection,
  saveAmazonWorkspaceConnection,
} from "../lib/amazon-workspace-connection.js";
import { loadAmazonConnectionStatusForWorkspace } from "../lib/resolve-amazon-settings.js";
import { normalizeLwaClientSecret, testAmazonSpConnection } from "../lib/amazon-sp-api.js";
import { syncShopifyProducts } from "../lib/shopify-product-sync.js";
import { syncShopifyOrders } from "../lib/shopify-order-sync.js";
import { syncWooCommerceProducts } from "../lib/woocommerce-product-sync.js";
import { verifyShopifyConnection } from "../lib/shopify-connection-verify.js";

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

function parseConnectionPlatform(raw: string): StoreMarketplace | "amazon" | null {
  if (raw === "amazon") return "amazon";
  return parseStorePlatform(raw);
}

async function loadAmazonConnectionStatus(userId: string, workspaceId: number) {
  return loadAmazonConnectionStatusForWorkspace({ userId, workspaceId });
}

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function auditCreatedByUserId(req: Request): string | null {
  const ctx = getWorkspaceCtx(req);
  if (ctx.isAccountOwner) return null;
  return (req as AuthedRequest).userId;
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
    loadAmazonConnectionStatus(userId, workspaceId),
    getShopifyConnectionPublic(workspaceId),
    getStoreConnection(workspaceId, "woocommerce"),
  ]);

  const shopifyWithSecret = await getShopifyConnection(workspaceId);
  const woocommerceWithSecret = await getWooCommerceConnection(workspaceId);

  res.json({
    amazon,
    shopify: {
      connected: Boolean(shopify),
      publishReady: isShopifyPublishReady(shopifyWithSecret),
      storeUrl: shopify?.storeUrl ?? null,
      clientId: shopify?.clientId ?? null,
      connectedAt: shopify?.connectedAt ?? null,
    },
    woocommerce: {
      connected: Boolean(woocommerce),
      publishReady: isWooCommercePublishReady(woocommerceWithSecret),
      storeUrl: woocommerce?.storeUrl ?? null,
      consumerKey: woocommerce?.consumerKey ?? null,
      connectedAt: woocommerce?.connectedAt ?? null,
    },
  });
});

router.post("/marketplaces/connections/:platform", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const platform = parseConnectionPlatform(String(req.params.platform ?? ""));
  if (!platform) {
    res.status(400).json({ error: "Invalid marketplace platform" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);

  if (platform === "amazon") {
    const body = req.body as {
      applicationId?: string;
      clientId?: string;
      clientSecret?: string;
      awsAccessKeyId?: string;
      awsSecretAccessKey?: string;
      awsRoleArn?: string;
      defaultMarketplace?: string;
      sandbox?: boolean;
    };

    const applicationId = String(body.applicationId ?? "").trim();
    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = normalizeLwaClientSecret(String(body.clientSecret ?? ""));
    const awsAccessKeyId = String(body.awsAccessKeyId ?? "").trim();
    const awsSecretAccessKey = String(body.awsSecretAccessKey ?? "").trim();
    const redirectUri = buildAmazonOAuthRedirectUri(req);

    if (!applicationId || !clientId || !clientSecret) {
      res.status(400).json({ error: "Amazon Application ID, LWA Client ID, and Client secret are required." });
      return;
    }

    const existingConnection = await getAmazonWorkspaceConnection(workspaceId);
    const resolvedAwsAccessKeyId = awsAccessKeyId || existingConnection?.awsAccessKeyId || "";
    const resolvedAwsSecretAccessKey = awsSecretAccessKey || existingConnection?.awsSecretAccessKey || "";
    const resolvedAwsRoleArn = String(body.awsRoleArn ?? "").trim() || existingConnection?.awsRoleArn || "";

    const verification = await testAmazonSpConnection({
      enabled: true,
      sandbox: body.sandbox !== false,
      applicationId,
      clientId,
      clientSecret,
      redirectUri,
      defaultMarketplace: body.defaultMarketplace?.trim().toUpperCase() || "US",
      awsAccessKeyId: resolvedAwsAccessKeyId,
      awsSecretAccessKey: resolvedAwsSecretAccessKey,
      awsRoleArn: resolvedAwsRoleArn,
    });
    if (!verification.ok) {
      res.status(400).json({ error: verification.message });
      return;
    }

    const connection = await saveAmazonWorkspaceConnection(workspaceId, {
      applicationId,
      clientId,
      clientSecret,
      awsAccessKeyId: resolvedAwsAccessKeyId,
      awsSecretAccessKey: resolvedAwsSecretAccessKey,
      awsRoleArn: resolvedAwsRoleArn,
      defaultMarketplace: body.defaultMarketplace,
      sandbox: body.sandbox,
      redirectUri,
    });

    const publishReady = Boolean(resolvedAwsAccessKeyId && resolvedAwsSecretAccessKey);
    res.status(201).json({
      connected: false,
      credentialsReady: true,
      publishReady,
      redirectUri,
      defaultMarketplace: connection.defaultMarketplace,
      sandbox: connection.sandbox,
      message: publishReady
        ? "Amazon SP-API credentials saved. Authorize your seller account to finish connecting."
        : "Amazon credentials saved. Authorize your seller account now. Add AWS IAM keys later if you want to publish listings.",
    });
    return;
  }

  const storePlatform = platform as StoreMarketplace;

  if (storePlatform === "shopify") {
    const body = req.body as {
      storeUrl?: string;
      clientId?: string;
      clientSecret?: string;
    };
    const storeUrl = normalizeStoreUrl(String(body.storeUrl ?? ""));
    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = String(body.clientSecret ?? "").trim();
    if (!storeUrl) {
      res.status(400).json({ error: "A valid store URL is required" });
      return;
    }
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: "Shopify Client ID and Client secret are required for direct publishing." });
      return;
    }

    let verification;
    try {
      verification = await verifyShopifyConnection({ storeUrl, clientId, clientSecret });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not verify Shopify credentials";
      res.status(400).json({ error: message });
      return;
    }
    if (!verification.ok) {
      res.status(400).json({ error: verification.message, scopes: verification.scopes });
      return;
    }

    const connection = await saveShopifyConnection(workspaceId, { storeUrl, clientId, clientSecret });
    res.status(201).json({
      connected: true,
      publishReady: true,
      storeUrl: connection.storeUrl,
      clientId: connection.clientId,
      connectedAt: connection.connectedAt,
      scopes: verification.scopes,
      message: verification.message,
    });
    return;
  }

  if (storePlatform === "woocommerce") {
    const body = req.body as {
      storeUrl?: string;
      consumerKey?: string;
      consumerSecret?: string;
    };
    const storeUrl = normalizeStoreUrl(String(body.storeUrl ?? ""));
    const consumerKey = String(body.consumerKey ?? "").trim();
    const consumerSecret = String(body.consumerSecret ?? "").trim();
    if (!storeUrl) {
      res.status(400).json({ error: "A valid store URL is required" });
      return;
    }
    if (!consumerKey || !consumerSecret) {
      res.status(400).json({ error: "WooCommerce consumer key and consumer secret are required." });
      return;
    }

    let verification;
    try {
      verification = await verifyWooCommerceConnection({ storeUrl, consumerKey, consumerSecret });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not verify WooCommerce credentials";
      res.status(400).json({ error: message });
      return;
    }
    if (!verification.ok) {
      res.status(400).json({ error: verification.message });
      return;
    }

    const connection = await saveWooCommerceConnection(workspaceId, {
      storeUrl,
      consumerKey,
      consumerSecret,
    });
    res.status(201).json({
      connected: true,
      publishReady: true,
      storeUrl: connection.storeUrl,
      consumerKey: connection.consumerKey,
      connectedAt: connection.connectedAt,
      message: verification.message,
    });
    return;
  }

  res.status(400).json({ error: "Invalid marketplace platform" });
});

router.delete("/marketplaces/connections/:platform", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const platform = parseConnectionPlatform(String(req.params.platform ?? ""));
  if (!platform) {
    res.status(400).json({ error: "Invalid marketplace platform" });
    return;
  }

  const workspaceId = getActiveWorkspaceId(req);

  if (platform === "amazon") {
    await disconnectAmazonWorkspaceConnection(workspaceId);
    res.status(204).end();
    return;
  }

  await disconnectStoreConnection(workspaceId, platform);
  res.status(204).end();
});

router.post(
  "/marketplaces/shopify/sync",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["build_brand", "audits"], "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getShopifyConnectionPublic(workspaceId);
    if (!connection?.storeUrl) {
      res.status(400).json({ error: "Connect your Shopify store first on the Marketplaces page." });
      return;
    }

    const credentials = await getShopifyConnection(workspaceId);

    try {
      const result = await syncShopifyProducts({
        storeUrl: connection.storeUrl,
        clientId: credentials?.clientId,
        clientSecret: credentials?.clientSecret,
        ownerId: getEffectiveUserId(req),
        createdByUserId: auditCreatedByUserId(req),
        workspaceId,
      });

      const orderSyncInput = {
        workspaceId,
        storeUrl: connection.storeUrl,
        clientId: credentials?.clientId,
        clientSecret: credentials?.clientSecret,
      };
      void syncShopifyOrders(orderSyncInput).catch((err) => {
        req.log?.error?.({ err }, "Shopify order sync failed");
      });

      res.status(201).json({
        ...result,
        auditsCompleted: 0,
        auditsFailed: 0,
        auditsRemaining: 0,
        ordersSyncQueued: true,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Shopify product sync failed");
      const message = err instanceof Error ? err.message : "Failed to import Shopify products";
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/marketplaces/woocommerce/sync",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["build_brand", "audits"], "create"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getWooCommerceConnection(workspaceId);
    if (!connection?.storeUrl || !connection.consumerKey || !connection.consumerSecret) {
      res.status(400).json({
        error: "Connect your WooCommerce store with REST API credentials on the Marketplaces page first.",
      });
      return;
    }

    try {
      const result = await syncWooCommerceProducts({
        storeUrl: connection.storeUrl,
        consumerKey: connection.consumerKey,
        consumerSecret: connection.consumerSecret,
        ownerId: getEffectiveUserId(req),
        createdByUserId: auditCreatedByUserId(req),
        workspaceId,
      });

      res.status(201).json({
        ...result,
        auditsCompleted: 0,
        auditsFailed: 0,
        auditsRemaining: 0,
      });
    } catch (err) {
      req.log?.error?.({ err }, "WooCommerce product sync failed");
      const message = err instanceof Error ? err.message : "Failed to import WooCommerce products";
      res.status(500).json({ error: message });
    }
  },
);

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
