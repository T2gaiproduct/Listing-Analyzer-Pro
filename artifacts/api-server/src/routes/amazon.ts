import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db, amazonSellerConnectionsTable, amazonPublishJobsTable } from "@workspace/db";
import type { ImageRecord } from "@workspace/db";
import {
  isAmazonSpConfigured,
  isAmazonPublishReady,
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
import { resolveMarketplacePublishBaseUrl, resolvePublicBaseUrl } from "../lib/resolve-public-base-url.js";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";
import {
  resolveAmazonConnectionForWorkspace,
  resolveAmazonSettingsForWorkspace,
  loadAmazonConnectionStatusForWorkspace,
} from "../lib/resolve-amazon-settings.js";
import {
  disconnectAmazonWorkspaceSellerConnection,
  saveAmazonWorkspaceSellerConnection,
} from "../lib/amazon-workspace-connection.js";

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

router.get("/amazon/status", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);
  const status = await loadAmazonConnectionStatusForWorkspace({ workspaceId, userId, req });
  res.json(status);
});

router.get("/amazon/oauth/authorize", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);
  const { settings } = await resolveAmazonSettingsForWorkspace(workspaceId, req);

  if (!isAmazonSpConfigured(settings)) {
    res.status(400).json({
      error: "Amazon integration is not configured yet. Ask your SellerLens administrator to set up the SP-API application.",
    });
    return;
  }

  const state = createOAuthState({ userId, workspaceId });
  const url = buildAmazonAuthorizeUrl(settings, state);
  res.json({ url });
});

router.get("/amazon/oauth/callback", async (req, res): Promise<void> => {
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
    const { settings } = await resolveAmazonSettingsForWorkspace(parsed.workspaceId, req);
    if (!isAmazonSpConfigured(settings)) {
      res.status(400).send("Amazon SP-API is not configured on this SellerLens instance.");
      return;
    }

    const tokens = await exchangeAuthorizationCode(settings, code);
    const marketplaceIds = typeof req.query.mws_auth_token === "string" ? [] : [];

    if (parsed.workspaceId) {
      await saveAmazonWorkspaceSellerConnection(parsed.workspaceId, {
        sellerId,
        refreshToken: tokens.refresh_token!,
        marketplaceIds,
      });
    } else {
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
    }

    const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
    res.redirect(`${base}/marketplaces?amazon=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon authorization failed";
    res.status(400).send(message);
  }
});

router.delete("/amazon/connection", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);

  if (workspaceId) {
    await disconnectAmazonWorkspaceSellerConnection(workspaceId);
    res.json({ ok: true });
    return;
  }

  await db.update(amazonSellerConnectionsTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(amazonSellerConnectionsTable.userId, userId));
  res.json({ ok: true });
});

router.post("/amazon/test-connection", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const { settings } = await resolveAmazonSettingsForWorkspace(workspaceId);
  const result = await testAmazonSpConnection(settings);
  res.json(result);
});

router.post(
  "/audits/:id/publish/amazon",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceActionAny(["build_brand", "audits"], "edit"),
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const workspaceId = getActiveWorkspaceId(req);
    const auditId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(auditId)) {
      res.status(400).json({ error: "Invalid audit id" });
      return;
    }

    const resolved = await resolveAmazonConnectionForWorkspace({ workspaceId, userId, req });
    if (!resolved) {
      res.status(400).json({
        error: workspaceId
          ? "Connect your Amazon seller account on the Marketplaces page before publishing."
          : "Amazon publishing isn't set up yet. Contact your administrator.",
      });
      return;
    }
    if (!isAmazonPublishReady(resolved.settings)) {
      res.status(400).json({
        error: "Amazon publishing isn't fully configured. Ask your administrator to complete SP-API setup.",
      });
      return;
    }

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const marketplace = typeof req.body?.marketplace === "string"
      ? req.body.marketplace
      : resolved.settings.defaultMarketplace;
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
          settings: resolved.settings,
          refreshToken: resolved.refreshToken,
          sellerId: resolved.sellerId,
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
