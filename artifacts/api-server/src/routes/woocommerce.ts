import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import type { ImageRecord } from "@workspace/db";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";
import {
  getWooCommerceConnection,
  getWooCommerceConnectionPublic,
  isWooCommercePublishReady,
} from "../lib/marketplace-connections.js";
import { publishListingToWooCommerce, type WooCommercePublishMode } from "../lib/woocommerce-publish.js";
import { loadAuditForExport } from "../lib/audit-export-loader.js";
import { resolveMarketplacePublishBaseUrl } from "../lib/resolve-public-base-url.js";

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

function parsePublishMode(raw: unknown): WooCommercePublishMode {
  return raw === "live" ? "live" : "draft";
}

router.get("/woocommerce/status", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const [connection, connectionWithSecret] = await Promise.all([
    getWooCommerceConnectionPublic(workspaceId),
    getWooCommerceConnection(workspaceId),
  ]);

  res.json({
    connected: Boolean(connection),
    publishReady: isWooCommercePublishReady(connectionWithSecret),
    storeUrl: connection?.storeUrl ?? null,
    consumerKey: connection?.consumerKey ?? null,
    connectedAt: connection?.connectedAt ?? null,
  });
});

router.post(
  "/audits/:id/publish/woocommerce",
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
    const connection = await getWooCommerceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your WooCommerce store on the Marketplaces page before publishing." });
      return;
    }
    if (!isWooCommercePublishReady(connection)) {
      res.status(400).json({
        error: "Add your WooCommerce Consumer key and Consumer secret on the Marketplaces page to enable direct publishing.",
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
    const graphicsProjectId = loaded.graphicsProject?.id ?? null;

    try {
      const publicBaseUrl = resolveMarketplacePublishBaseUrl(req);
      const result = await publishListingToWooCommerce({
        connection,
        audit: loaded.audit,
        graphicsImageRecords,
        graphicsProjectId,
        publicBaseUrl,
        publishMode,
      });

      res.json({
        ok: true,
        publishMode,
        productId: result.productId,
        slug: result.slug,
        listingUrl: result.listingUrl,
        status: result.status,
        created: result.created,
        warning: result.warning,
        message: result.warning
          ? "Product updated on WooCommerce."
          : publishMode === "live"
            ? "Product published live on WooCommerce."
            : "Product saved as draft on WooCommerce.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      res.status(400).json({ error: message });
    }
  },
);

export default router;
