import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  buildEbayOAuthCallbackUrl,
  describeEbayOAuthSetupIssue,
  ebayOAuthDefaultEnvironment,
  isEbayOAuthAppConfigured,
  parseEbayOAuthEnvironment,
} from "../lib/ebay-oauth-config.js";
import { EBAY_OAUTH_SCOPES } from "../lib/ebay-oauth-scopes.js";
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
import {
  getActiveWorkspaceId,
  resolveTeamAndWorkspace,
  requireWorkspaceAction,
} from "../lib/workspace-route-helpers.js";
import { resolveWorkspaceContext, requireWorkspacePerm as checkPerm } from "../lib/workspace-context.js";

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

router.get("/ebay/oauth/config", requireAuth, resolveTeamAndWorkspace, async (_req: Request, res: Response): Promise<void> => {
  res.json({
    scopes: [...EBAY_OAUTH_SCOPES],
    defaultEnvironment: ebayOAuthDefaultEnvironment(),
    sandbox: {
      configured: isEbayOAuthAppConfigured("sandbox"),
      setupIssue: describeEbayOAuthSetupIssue("sandbox"),
    },
    production: {
      configured: isEbayOAuthAppConfigured("production"),
      setupIssue: describeEbayOAuthSetupIssue("production"),
    },
    callbackUrl: buildEbayOAuthCallbackUrl(_req),
  });
});

router.get("/ebay/status", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const status = await getEbayWorkspaceConnectionPublic(workspaceId);
  res.json({
    ...status,
    publishReady: status.connected,
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
    const environment = parseEbayOAuthEnvironment(req.query.environment);

    const setupIssue = describeEbayOAuthSetupIssue(environment);
    if (setupIssue) {
      res.status(400).json({ error: setupIssue });
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
    res.redirect(`${base}/marketplaces?ebay=connected&ebayEnv=${parsed.environment}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "eBay authorization failed";
    res.status(400).send(message);
  }
});

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
