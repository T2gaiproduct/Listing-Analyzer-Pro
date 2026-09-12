import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, graphicsProjectsTable, productMarketplaceListingsTable } from "@workspace/db";
import type { ImageRecord } from "@workspace/db";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";
import {
  getShopifyConnection,
  getShopifyConnectionPublic,
  isShopifyPublishReady,
} from "../lib/marketplace-connections.js";
import { publishListingToShopify, type ShopifyPublishMode } from "../lib/shopify-publish.js";
import { loadAuditForExport } from "../lib/audit-export-loader.js";
import { resolveMarketplacePublishBaseUrl } from "../lib/resolve-public-base-url.js";
import {
  clearShopifyAccessTokenCache,
  fetchShopifyCustomCollections,
  fetchShopifyProductCollectionMembership,
  getShopifyAccessToken,
  parseShopifyShopHost,
} from "../lib/shopify-admin-client.js";
import { resolveShopifyProductHandle } from "../lib/shopify-import-utils.js";

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

function parsePublishMode(raw: unknown): ShopifyPublishMode {
  return raw === "live" ? "live" : "draft";
}

function parseShopifyCollectionGids(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { shopifyCollectionGids?: unknown }).shopifyCollectionGids;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

router.get("/shopify/status", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const [connection, connectionWithSecret] = await Promise.all([
    getShopifyConnectionPublic(workspaceId),
    getShopifyConnection(workspaceId),
  ]);

  res.json({
    connected: Boolean(connection),
    publishReady: isShopifyPublishReady(connectionWithSecret),
    storeUrl: connection?.storeUrl ?? null,
    clientId: connection?.clientId ?? null,
    connectedAt: connection?.connectedAt ?? null,
  });
});

router.get(
  "/shopify/collections",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getShopifyConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your Shopify store on the Marketplaces page first." });
      return;
    }
    if (!isShopifyPublishReady(connection)) {
      res.status(400).json({
        error: "Add your Shopify Client ID and Client secret on the Marketplaces page to load collections.",
      });
      return;
    }

    const shopHost = parseShopifyShopHost(connection.storeUrl);
    try {
      let accessToken = await getShopifyAccessToken({
        shopHost,
        clientId: connection.clientId,
        clientSecret: connection.clientSecret,
      });
      try {
        const collections = await fetchShopifyCustomCollections({ shopHost, accessToken });
        res.json({ collections });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/unauthorized|invalid/i.test(message)) throw err;
        clearShopifyAccessTokenCache({ shopHost, clientId: connection.clientId });
        accessToken = await getShopifyAccessToken({
          shopHost,
          clientId: connection.clientId,
          clientSecret: connection.clientSecret,
        });
        const collections = await fetchShopifyCustomCollections({ shopHost, accessToken });
        res.json({ collections });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Shopify collections";
      res.status(400).json({ error: message });
    }
  },
);

router.get(
  "/audits/:id/shopify/listing-collections",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const auditId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(auditId)) {
      res.status(400).json({ error: "Invalid audit id" });
      return;
    }

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getShopifyConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your Shopify store on the Marketplaces page first." });
      return;
    }
    if (!isShopifyPublishReady(connection)) {
      res.status(400).json({
        error: "Add your Shopify Client ID and Client secret on the Marketplaces page to load collection membership.",
      });
      return;
    }

    const [shopifyListing] = await db
      .select({ listingUrl: productMarketplaceListingsTable.listingUrl })
      .from(productMarketplaceListingsTable)
      .where(and(
        eq(productMarketplaceListingsTable.auditId, auditId),
        eq(productMarketplaceListingsTable.marketplace, "Shopify"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ))
      .limit(1);

    const handle = resolveShopifyProductHandle({
      asin: loaded.audit.asin,
      listingUrl: shopifyListing?.listingUrl ?? null,
    });

    const shopHost = parseShopifyShopHost(connection.storeUrl);
    const storefrontOrigin = (() => {
      const fromListing = shopifyListing?.listingUrl?.trim();
      if (fromListing) {
        try {
          return new URL(fromListing).origin;
        } catch {
          // fall through
        }
      }
      const trimmed = connection.storeUrl?.trim();
      if (!trimmed) return `https://${shopHost}`;
      try {
        const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        return new URL(withProto).origin;
      } catch {
        return `https://${shopHost}`;
      }
    })();

    if (!handle) {
      res.json({
        handle: null,
        productType: null,
        listingCategory: loaded.audit.category?.trim() || null,
        manualCollections: [],
        smartCollections: [],
        storefrontOrigin,
        message: "Publish this product to Shopify (or import from Shopify) to see collection membership.",
      });
      return;
    }

    try {
      let accessToken = await getShopifyAccessToken({
        shopHost,
        clientId: connection.clientId,
        clientSecret: connection.clientSecret,
      });
      let membership;
      try {
        membership = await fetchShopifyProductCollectionMembership({ shopHost, accessToken, handle });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/unauthorized|invalid/i.test(message)) throw err;
        clearShopifyAccessTokenCache({ shopHost, clientId: connection.clientId });
        accessToken = await getShopifyAccessToken({
          shopHost,
          clientId: connection.clientId,
          clientSecret: connection.clientSecret,
        });
        membership = await fetchShopifyProductCollectionMembership({ shopHost, accessToken, handle });
      }

      res.json({
        handle,
        productType: membership.productType,
        listingCategory: loaded.audit.category?.trim() || null,
        manualCollections: membership.manualCollections,
        smartCollections: membership.smartCollections,
        storefrontOrigin,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Shopify collection membership";
      res.status(400).json({ error: message });
    }
  },
);

router.post(
  "/audits/:id/publish/shopify",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["build_brand", "audits"], "edit"),
  async (req: Request, res: Response): Promise<void> => {
    const auditId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(auditId)) {
      res.status(400).json({ error: "Invalid audit id" });
      return;
    }

    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getShopifyConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your Shopify store on the Marketplaces page before publishing." });
      return;
    }
    if (!isShopifyPublishReady(connection)) {
      res.status(400).json({
        error: "Add your Shopify Client ID and Client secret on the Marketplaces page to enable direct publishing.",
      });
      return;
    }

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const body = req.body as {
      publishMode?: string;
      shopifyCollectionGids?: string[];
      shopifyCollectionTitles?: Record<string, string>;
    };
    const publishMode = parsePublishMode(body?.publishMode);
    const shopifyCollectionGids = parseShopifyCollectionGids(body);
    const shopifyCollectionTitles = body?.shopifyCollectionTitles && typeof body.shopifyCollectionTitles === "object"
      ? body.shopifyCollectionTitles
      : undefined;
    const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
    const graphicsProjectId = loaded.graphicsProject?.id ?? null;

    try {
      const result = await publishListingToShopify({
        connection,
        audit: loaded.audit,
        graphicsImageRecords,
        graphicsProjectId,
        publicBaseUrl: resolveMarketplacePublishBaseUrl(req),
        publishMode,
        shopifyCollectionGids,
        shopifyCollectionTitles,
      });

      res.json({
        ok: true,
        publishMode,
        productId: result.productId,
        handle: result.handle,
        listingUrl: result.listingUrl,
        status: result.status,
        created: result.created,
        warning: result.warning,
        collectionsAssigned: result.collectionsAssigned,
        message: result.warning
          ? "Product updated in Shopify."
          : publishMode === "live"
            ? "Product published live on Shopify."
            : "Product saved as draft on Shopify.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      const friendly = /unauthorized|access denied|permission|scope|read_publications|write_publications/i.test(message)
        ? "Shopify rejected the request. In Shopify Dev Dashboard, add read_products, write_products, read_publications, and write_publications API scopes, then reconnect on Marketplaces."
        : message;
      res.status(400).json({ error: friendly });
    }
  },
);

export default router;
