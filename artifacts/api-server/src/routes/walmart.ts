import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getRequestUserId } from "../lib/request-auth.js";
import { requireAuth } from "../lib/require-auth.js";
import {
  buildWalmartOAuthCallbackUrl,
  fixMalformedWalmartAuthorizeReferer,
  getWalmartAppCredentials,
  isWalmartOAuthConnectReady,
  resolveActiveWalmartOAuthEnvironment,
  walmartConnectUnavailableMessageForSellers,
} from "../lib/walmart-oauth-config.js";
import { createWalmartOAuthState, parseWalmartOAuthState } from "../lib/walmart-oauth-state.js";
import { buildWalmartAuthorizeUrl, exchangeWalmartAuthorizationCode } from "../lib/walmart-oauth.js";
import { saveWalmartWorkspaceOAuthConnection } from "../lib/walmart-workspace-connection.js";
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


router.get("/walmart/oauth/config", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  res.json({
    connectReady: isWalmartOAuthConnectReady(),
    unavailableMessage: isWalmartOAuthConnectReady() ? null : walmartConnectUnavailableMessageForSellers(),
    callbackUrl: buildWalmartOAuthCallbackUrl(req),
    environment: resolveActiveWalmartOAuthEnvironment(),
  });
});

router.get(
  "/walmart/oauth/authorize",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("amazon", "edit"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const workspaceId = getActiveWorkspaceId(req);
    const environment = resolveActiveWalmartOAuthEnvironment();
    if (!environment) {
      res.status(400).json({ error: walmartConnectUnavailableMessageForSellers() });
      return;
    }

    const redirectUri = buildWalmartOAuthCallbackUrl(req);
    const state = createWalmartOAuthState({ userId, workspaceId, environment });
    const walmartCallbackRaw = typeof req.query.walmartCallbackUri === "string"
      ? req.query.walmartCallbackUri
      : undefined;
    const authorizeEndpoint = walmartCallbackRaw
      ? fixMalformedWalmartAuthorizeReferer(walmartCallbackRaw)
      : undefined;
    const clientType = typeof req.query.clientType === "string" ? req.query.clientType : undefined;
    try {
      const url = buildWalmartAuthorizeUrl({
        environment,
        redirectUri,
        state,
        clientType,
        authorizeEndpoint,
      });
      if (req.query.mode === "redirect") {
        res.redirect(302, url);
        return;
      }
      res.json({ url, environment, redirectUri });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start Walmart authorization.";
      if (req.query.mode === "redirect") {
        res.status(400).send(message);
        return;
      }
      res.status(400).json({ error: message });
    }
  },
);

router.get("/walmart/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const sessionUserId = getRequestUserId(req);

  const walmartError = typeof req.query.error === "string" ? req.query.error.trim() : "";
  if (walmartError) {
    const detail = typeof req.query.error_description === "string"
      ? req.query.error_description.trim()
      : walmartError;
    res.status(400).send(`Walmart declined authorization: ${detail}`);
    return;
  }

  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const parsed = parseWalmartOAuthState(stateRaw);
  if (!parsed) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }

  if (!sessionUserId || sessionUserId !== parsed.userId) {
    res.status(403).send("Sign in as the account that started Walmart authorization, then try again.");
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
    res.status(403).send("You do not have permission to connect Walmart for this workspace.");
    return;
  }

  const callbackType = typeof req.query.type === "string" ? req.query.type.trim() : "";
  if (callbackType && callbackType !== "auth") {
    res.status(400).send("Unexpected Walmart callback type. Please try connecting again.");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  const sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId.trim() : "";
  const callbackClientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() : "";
  if (!code) {
    res.status(400).send("Missing authorization code from Walmart.");
    return;
  }
  if (!sellerId) {
    res.status(400).send("Missing seller ID from Walmart.");
    return;
  }

  const appCreds = getWalmartAppCredentials(parsed.environment);
  if (!appCreds) {
    res.status(400).send("Walmart OAuth is not configured on the server.");
    return;
  }
  if (callbackClientId && callbackClientId !== appCreds.clientId) {
    res.status(400).send("Walmart callback clientId does not match this application.");
    return;
  }

  try {
    const redirectUri = buildWalmartOAuthCallbackUrl(req);
    const tokens = await exchangeWalmartAuthorizationCode({
      environment: parsed.environment,
      code,
      redirectUri,
      sellerId,
    });

    await saveWalmartWorkspaceOAuthConnection(parsed.workspaceId, {
      sellerId,
      refreshToken: tokens.refreshToken,
      environment: parsed.environment,
    });

    const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
    res.redirect(`${base}/marketplaces?walmart=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Walmart authorization failed";
    res.status(400).send(message);
  }
});

export default router;
