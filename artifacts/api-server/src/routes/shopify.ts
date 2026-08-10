import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, graphicsProjectsTable } from "@workspace/db";
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

function resolvePublicBaseUrl(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0]?.trim()
    : req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

function parsePublishMode(raw: unknown): ShopifyPublishMode {
  return raw === "live" ? "live" : "draft";
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

    const publishMode = parsePublishMode((req.body as { publishMode?: string })?.publishMode);
    const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;

    try {
      const result = await publishListingToShopify({
        connection,
        audit: loaded.audit,
        graphicsImageRecords,
        publicBaseUrl: resolvePublicBaseUrl(req),
        publishMode,
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
