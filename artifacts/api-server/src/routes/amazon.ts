import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db, amazonSellerConnectionsTable, amazonPublishJobsTable } from "@workspace/db";
import type { ImageRecord } from "@workspace/db";
import {
  loadAmazonSpSettings,
  ensureAmazonAutoEnabled,
  isAmazonSpConfigured,
  isAmazonPublishReady,
  canSignSpApiRequests,
} from "../lib/amazon-sp-settings.js";
import {
  buildAmazonAuthorizeUrl,
  createOAuthState,
  parseOAuthState,
  exchangeAuthorizationCode,
  testAmazonSpConnection,
} from "../lib/amazon-sp-api.js";
import { publishListingToAmazonMarketplace } from "../lib/amazon-publish.js";
import { resolveAmazonMarketplace } from "../lib/amazon-marketplaces.js";
import { loadAuditForExport } from "../lib/audit-export-loader.js";
import { resolveMarketplacePublishBaseUrl } from "../lib/resolve-public-base-url.js";
import {
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";

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

router.get("/amazon/status", requireAuth, async (req, res): Promise<void> => {
  const settings = await ensureAmazonAutoEnabled();
  const userId = (req as AuthedRequest).userId;
  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(and(eq(amazonSellerConnectionsTable.userId, userId), eq(amazonSellerConnectionsTable.isDeleted, 0)))
    .limit(1);

  res.json({
    configured: isAmazonSpConfigured(settings),
    publishReady: isAmazonPublishReady(settings),
    enabled: settings.enabled,
    sandbox: settings.sandbox,
    canSignRequests: canSignSpApiRequests(settings),
    connected: Boolean(connection),
    sellerId: connection?.sellerId ?? null,
    marketplaceIds: connection?.marketplaceIds ?? [],
    defaultMarketplace: settings.defaultMarketplace,
  });
});

router.get("/amazon/oauth/authorize", requireAuth, async (req, res): Promise<void> => {
  const settings = await loadAmazonSpSettings();
  if (!isAmazonSpConfigured(settings)) {
    res.status(400).json({ error: "Amazon publishing isn't set up yet. Contact your administrator." });
    return;
  }
  const userId = (req as AuthedRequest).userId;
  const state = createOAuthState(userId);
  const url = buildAmazonAuthorizeUrl(settings, state);
  res.json({ url });
});

router.get("/amazon/oauth/callback", async (req, res): Promise<void> => {
  const settings = await loadAmazonSpSettings();
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const parsed = parseOAuthState(stateRaw);
  if (!parsed) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }

  const code = typeof req.query.spapi_oauth_code === "string"
    ? req.query.spapi_oauth_code
    : typeof req.query.code === "string"
      ? req.query.code
      : "";
  const sellerId = typeof req.query.selling_partner_id === "string" ? req.query.selling_partner_id : "";

  if (!code) {
    res.status(400).send("Missing authorization code from Amazon.");
    return;
  }
  if (!sellerId) {
    res.status(400).send("Missing selling_partner_id from Amazon.");
    return;
  }

  try {
    const tokens = await exchangeAuthorizationCode(settings, code);
    const marketplaceIds = typeof req.query.mws_auth_token === "string" ? [] : [];

    await db.insert(amazonSellerConnectionsTable)
      .values({
        userId: parsed.userId,
        sellerId,
        refreshToken: tokens.refresh_token!,
        marketplaceIds,
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: amazonSellerConnectionsTable.userId,
        set: {
          sellerId,
          refreshToken: tokens.refresh_token!,
          isDeleted: 0,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

    const base = settings.redirectUri.replace(/\/api\/amazon\/oauth\/callback.*$/, "");
    res.redirect(`${base}/audits/new?amazon=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon authorization failed";
    res.status(400).send(message);
  }
});

router.delete("/amazon/connection", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await db.update(amazonSellerConnectionsTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(amazonSellerConnectionsTable.userId, userId));
  res.json({ ok: true });
});

router.post("/amazon/test-connection", requireAuth, async (_req, res): Promise<void> => {
  const settings = await loadAmazonSpSettings();
  const result = await testAmazonSpConnection(settings);
  res.status(result.ok ? 200 : 400).json(result);
});

router.post(
  "/audits/:id/publish/amazon",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["build_brand", "audits"], "edit"),
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const auditId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(auditId)) {
      res.status(400).json({ error: "Invalid audit id" });
      return;
    }

    const settings = await ensureAmazonAutoEnabled();
    if (!isAmazonPublishReady(settings)) {
      res.status(400).json({ error: "Amazon publishing isn't set up yet. Contact your administrator." });
      return;
    }

    const [connection] = await db
      .select()
      .from(amazonSellerConnectionsTable)
      .where(and(eq(amazonSellerConnectionsTable.userId, userId), eq(amazonSellerConnectionsTable.isDeleted, 0)))
      .limit(1);
    if (!connection) {
      res.status(400).json({ error: "Connect your Amazon seller account before publishing." });
      return;
    }

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const marketplace = typeof req.body?.marketplace === "string"
      ? req.body.marketplace
      : settings.defaultMarketplace;
    resolveAmazonMarketplace(marketplace);

    const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
    const graphicsProjectId = loaded.graphicsProject?.id ?? null;

    try {
      const publicBaseUrl = resolveMarketplacePublishBaseUrl(req);
      const [job] = await db.insert(amazonPublishJobsTable)
        .values({
          auditId,
          userId,
          marketplace,
          sku: `SL-${auditId}`,
          status: "pending",
        })
        .returning();

      try {
        const result = await publishListingToAmazonMarketplace({
          settings,
          refreshToken: connection.refreshToken,
          sellerId: connection.sellerId,
          audit: loaded.audit,
          marketplaceCode: marketplace,
          graphicsImageRecords,
          graphicsProjectId,
          publicBaseUrl,
        });

        await db.update(amazonPublishJobsTable)
          .set({ status: "success", sku: result.sku, response: { marketplace: result.marketplace } })
          .where(eq(amazonPublishJobsTable.id, job!.id));

        res.json({
          ok: true,
          sandbox: result.sandbox,
          marketplace: result.marketplace,
          sku: result.sku,
          listingUrl: result.listingUrl,
          status: result.status,
          jobId: job!.id,
          warning: result.warning,
          message: result.sandbox
            ? "Listing submitted to Amazon SP-API sandbox."
            : "Listing submitted to Amazon.",
        });
      } catch (publishErr) {
        const message = publishErr instanceof Error ? publishErr.message : "Publish failed";
        await db.update(amazonPublishJobsTable)
          .set({ status: "failed", errorMessage: message })
          .where(eq(amazonPublishJobsTable.id, job!.id));
        res.status(400).json({ error: message });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      res.status(400).json({ error: message });
    }
  },
);

export default router;
