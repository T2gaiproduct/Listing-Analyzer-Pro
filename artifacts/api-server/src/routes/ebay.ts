import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  buildEbayOAuthCallbackUrl,
  ebayConnectUnavailableMessageForSellers,
  isEbayOAuthConnectReady,
  resolveActiveEbayOAuthEnvironment,
} from "../lib/ebay-oauth-config.js";
import { resolveEbayOAuthScopes } from "../lib/ebay-oauth-scopes.js";
import { createEbayOAuthState, parseEbayOAuthState } from "../lib/ebay-oauth-state.js";
import {
  buildEbayAuthorizeUrl,
  exchangeEbayAuthorizationCode,
  fetchEbayIdentityUser,
} from "../lib/ebay-oauth.js";
import {
  disconnectEbayWorkspaceConnection,
  getEbayWorkspaceConnectionPublic,
  saveEbayWorkspaceSellerConnection,
} from "../lib/ebay-workspace-connection.js";
import { resolvePublicBaseUrl } from "../lib/resolve-public-base-url.js";
import type { ImageRecord } from "@workspace/db";
import { loadAuditForExport } from "../lib/audit-export-loader.js";
import { publishListingToEbay } from "../lib/ebay-publish.js";
import { loadedBuildId } from "../lib/api-build-meta.js";
import { createNewEbayListingFromAudit } from "../lib/ebay-create-listing.js";
import { fetchEbayCategoryAspects, suggestEbayCategories } from "../lib/ebay-taxonomy.js";
import {
  fetchEbayListingPolicyOptions,
  pickDefaultPolicyId,
} from "../lib/ebay-account-policies.js";
import { resolveEbayAccessToken } from "../lib/ebay-inventory-client.js";
import { isEbayTradingApiConfigured } from "../lib/ebay-oauth-config.js";
import { getEbayWorkspaceConnection } from "../lib/ebay-workspace-connection.js";
import { resolveMarketplacePublishBaseUrl } from "../lib/resolve-public-base-url.js";
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceAction,
  requireWorkspaceActionAny,
} from "../lib/workspace-route-helpers.js";
import { resolveWorkspaceContext, requireWorkspacePerm as checkPerm } from "../lib/workspace-context.js";
import {
  computeMarketplaceDeletionChallengeResponse,
  processEbayMarketplaceAccountDeletionNotification,
  resolveEbayMarketplaceDeletionEndpoint,
  resolveEbayMarketplaceDeletionVerificationToken,
} from "../lib/ebay-marketplace-account-deletion.js";

const router: IRouter = Router();

function marketplaceDeletionLog(req: Request): {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
} {
  return {
    info: (obj, msg) => {
      req.log?.info?.(obj, msg);
    },
    error: (obj, msg) => {
      req.log?.error?.(obj, msg);
    },
  };
}

router.get("/ebay/marketplace-account-deletion", (req: Request, res: Response): void => {
  const challengeCode = typeof req.query.challenge_code === "string"
    ? req.query.challenge_code.trim()
    : "";
  if (!challengeCode) {
    res.status(400).json({ error: "Missing challenge_code query parameter" });
    return;
  }

  const verificationToken = resolveEbayMarketplaceDeletionVerificationToken();
  if (!verificationToken) {
    marketplaceDeletionLog(req).error(
      {},
      "eBay marketplace account deletion: EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN is not configured",
    );
    res.status(500).json({ error: "Marketplace account deletion endpoint is not configured" });
    return;
  }

  const endpoint = resolveEbayMarketplaceDeletionEndpoint();
  marketplaceDeletionLog(req).info(
    { endpoint },
    "eBay marketplace account deletion challenge received",
  );

  const challengeResponse = computeMarketplaceDeletionChallengeResponse(
    challengeCode,
    verificationToken,
    endpoint,
  );

  res.status(200).type("application/json").json({ challengeResponse });
});

router.post("/ebay/marketplace-account-deletion", (req: Request, res: Response): void => {
  // TODO(account-deletion): Verify X-EBAY-SIGNATURE before trusting body in production.

  const result = processEbayMarketplaceAccountDeletionNotification(
    req.body,
    marketplaceDeletionLog(req),
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(200).end();
});

function ebayCustomLabelHint(errorMessage: string): string | undefined {
  if (/\[?25707\]?|invalid value for a SKU/i.test(errorMessage)) {
    return "Push hit eBay Inventory with a hyphenated custom label (e.g. WAL-LAM-0880). Redeploy the latest API (uses inventory SKU like SL881), or in sandbox Seller Hub set Custom label to letters/digits only (WALLAMP0880).";
  }
  if (/inventory-based listing management is not currently supported/i.test(errorMessage)) {
    return "This listing was created with eBay Inventory. SellerLens should update via Inventory, not Trading — redeploy latest API or check Seller Hub → Inventory for the offer on this item id.";
  }
  return undefined;
}

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

router.get("/ebay/oauth/config", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  res.json({
    connectReady: isEbayOAuthConnectReady(),
    unavailableMessage: isEbayOAuthConnectReady() ? null : ebayConnectUnavailableMessageForSellers(),
    scopes: resolveEbayOAuthScopes(),
    callbackUrl: buildEbayOAuthCallbackUrl(req),
  });
});

router.get("/ebay/status", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const status = await getEbayWorkspaceConnectionPublic(workspaceId);
  const connection = await getEbayWorkspaceConnection(workspaceId);
  const publishReady = Boolean(
    status.connected
    && connection
    && isEbayTradingApiConfigured(connection.environment),
  );
  res.json({
    ...status,
    publishReady,
  });
});

router.get(
  "/ebay/oauth/authorize",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("amazon", "edit"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const workspaceId = getActiveWorkspaceId(req);
    const environment = resolveActiveEbayOAuthEnvironment();
    if (!environment) {
      res.status(400).json({ error: ebayConnectUnavailableMessageForSellers() });
      return;
    }

    const state = createEbayOAuthState({ userId, workspaceId, environment });
    const url = buildEbayAuthorizeUrl(environment, state);
    res.json({
      url,
      environment,
      redirectUri: buildEbayOAuthCallbackUrl(req),
    });
  },
);

router.get("/ebay/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const sessionUserId = auth?.userId;

  const ebayError = typeof req.query.error === "string" ? req.query.error : "";
  if (ebayError) {
    const detail = typeof req.query.error_description === "string"
      ? req.query.error_description
      : ebayError;
    res.status(400).send(`eBay declined authorization: ${detail}`);
    return;
  }

  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const parsed = parseEbayOAuthState(stateRaw);
  if (!parsed) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }

  if (!sessionUserId || sessionUserId !== parsed.userId) {
    res.status(403).send("Sign in as the account that started eBay authorization, then try again.");
    return;
  }

  if (!parsed.workspaceId) {
    res.status(400).send("Workspace context was missing. Open Marketplaces in a workspace and connect again.");
    return;
  }

  const ctx = await resolveWorkspaceContext(sessionUserId, parsed.workspaceId);
  if (!ctx) {
    res.status(403).send("Workspace not found or access denied.");
    return;
  }
  if (!ctx.isAccountOwner && !checkPerm(ctx, "amazon", "edit")) {
    res.status(403).send("You do not have permission to connect eBay for this workspace.");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) {
    res.status(400).send("Missing authorization code from eBay.");
    return;
  }

  try {
    const tokens = await exchangeEbayAuthorizationCode(parsed.environment, code);
    const refreshToken = tokens.refresh_token?.trim();
    if (!refreshToken) {
      res.status(400).send("eBay did not return a refresh token. Reconnect and approve all requested permissions.");
      return;
    }

    let ebayUserId: string | undefined;
    let username: string | undefined;
    try {
      const identity = await fetchEbayIdentityUser(parsed.environment, tokens.access_token);
      ebayUserId = identity.userId;
      username = identity.username;
    } catch {
      // Connection is still valid without identity metadata.
    }

    await saveEbayWorkspaceSellerConnection(parsed.workspaceId, {
      refreshToken,
      environment: parsed.environment,
      ebayUserId,
      username,
    });

    const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
    res.redirect(`${base}/marketplaces?ebay=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "eBay authorization failed";
    res.status(400).send(message);
  }
});

router.get(
  "/ebay/categories/suggest",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getEbayWorkspaceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect eBay on Marketplaces first." });
      return;
    }
    try {
      const { accessToken, environment } = await resolveEbayAccessToken(workspaceId);
      const categories = await suggestEbayCategories({ environment, accessToken, query: q });
      res.json({ categories });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Category search failed";
      res.status(400).json({ error: message });
    }
  },
);

router.get(
  "/ebay/categories/:categoryId/aspects",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = String(req.params.categoryId ?? "").trim();
    if (!categoryId) {
      res.status(400).json({ error: "Category id is required." });
      return;
    }
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getEbayWorkspaceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect eBay on Marketplaces first." });
      return;
    }
    try {
      const { accessToken, environment } = await resolveEbayAccessToken(workspaceId);
      const aspects = await fetchEbayCategoryAspects({ environment, accessToken, categoryId });
      res.json({ aspects });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load item specifics";
      res.status(400).json({ error: message });
    }
  },
);

router.get(
  "/ebay/listing-options",
  requireAuth,
  resolveTeamAndWorkspace,
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    const connection = await getEbayWorkspaceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect eBay on Marketplaces first." });
      return;
    }
    try {
      const { accessToken, environment } = await resolveEbayAccessToken(workspaceId);
      const policies = await fetchEbayListingPolicyOptions({ environment, accessToken });
      res.json({
        environment: connection.environment,
        createListingEnabled: connection.environment === "sandbox",
        defaults: {
          fulfillmentPolicyId: pickDefaultPolicyId(policies.fulfillmentPolicies),
          paymentPolicyId: pickDefaultPolicyId(policies.paymentPolicies),
          returnPolicyId: pickDefaultPolicyId(policies.returnPolicies),
        },
        ...policies,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load eBay listing options";
      res.status(400).json({ error: message });
    }
  },
);

router.post(
  "/audits/:id/publish/ebay/create",
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
    const connection = await getEbayWorkspaceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your eBay seller account on the Marketplaces page before publishing." });
      return;
    }
    if (connection.environment !== "sandbox") {
      res.status(400).json({
        error: "Creating new eBay listings from SellerLens is enabled for sandbox eBay accounts in this release. Reconnect sandbox eBay on Marketplaces, or import an existing listing and use Push.",
      });
      return;
    }
    if (!isEbayTradingApiConfigured(connection.environment)) {
      res.status(400).json({
        error: "eBay publish is not configured on this server (Trading API keys).",
      });
      return;
    }

    const body = req.body as {
      primaryCategoryId?: string;
      quantity?: number;
      condition?: "NEW" | "LIKE_NEW" | "USED_EXCELLENT";
      fulfillmentPolicyId?: string;
      paymentPolicyId?: string;
      returnPolicyId?: string;
      itemAspects?: Record<string, string>;
    };

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
    const graphicsProjectId = loaded.graphicsProject?.id ?? null;

    try {
      const publicBaseUrl = resolveMarketplacePublishBaseUrl(req);
      const result = await createNewEbayListingFromAudit({
        workspaceId,
        audit: loaded.audit,
        graphicsImageRecords,
        graphicsProjectId,
        publicBaseUrl,
        primaryCategoryId: body.primaryCategoryId ?? "",
        quantity: body.quantity,
        condition: body.condition,
        fulfillmentPolicyId: body.fulfillmentPolicyId,
        paymentPolicyId: body.paymentPolicyId,
        returnPolicyId: body.returnPolicyId,
        itemAspects: body.itemAspects,
      });

      res.json({
        ok: true,
        itemId: result.itemId,
        listingUrl: result.listingUrl,
        sku: result.sku,
        warning: result.warning,
        message: result.warning
          ? "New eBay listing created with a warning."
          : "New eBay listing published successfully.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create listing failed";
      res.status(400).json({
        error: message,
        apiBuildId: loadedBuildId,
        hint: "List as new creates a new eBay listing (Inventory API). Error 25713 means sandbox still has broken offers on SKUs like SL{productId} — not fixed by Push. Clear Inventory in sandbox or redeploy; use Push only when this product is already Live/linked.",
      });
    }
  },
);

router.post(
  "/audits/:id/publish/ebay",
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
    const connection = await getEbayWorkspaceConnection(workspaceId);
    if (!connection) {
      res.status(400).json({ error: "Connect your eBay seller account on the Marketplaces page before publishing." });
      return;
    }
    if (!isEbayTradingApiConfigured(connection.environment)) {
      res.status(400).json({
        error: "eBay publish is not configured on this server (Trading API keys).",
      });
      return;
    }

    const loaded = await loadAuditForExport(req, auditId);
    if (!loaded) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
    const graphicsProjectId = loaded.graphicsProject?.id ?? null;

    try {
      const publicBaseUrl = resolveMarketplacePublishBaseUrl(req);
      const result = await publishListingToEbay({
        workspaceId,
        audit: loaded.audit,
        graphicsImageRecords,
        graphicsProjectId,
        publicBaseUrl,
      });

      res.json({
        ok: true,
        itemId: result.itemId,
        listingUrl: result.listingUrl,
        warning: result.warning,
        message: result.warning
          ? "eBay listing updated with a warning."
          : "This product’s content was pushed to its linked eBay listing only.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      res.status(400).json({
        error: message,
        apiBuildId: loadedBuildId,
        hint: ebayCustomLabelHint(message),
      });
    }
  },
);

router.delete(
  "/ebay/connection",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("amazon", "edit"),
  async (req: Request, res: Response): Promise<void> => {
    const workspaceId = getActiveWorkspaceId(req);
    await disconnectEbayWorkspaceConnection(workspaceId);
    res.status(204).end();
  },
);

export default router;
