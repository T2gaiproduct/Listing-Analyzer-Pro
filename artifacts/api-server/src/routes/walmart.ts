import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  buildWalmartOAuthCallbackUrl,
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
    const authorizeEndpoint = typeof req.query.walmartCallbackUri === "string"
      ? req.query.walmartCallbackUri
      : undefined;
    const clientType = typeof req.query.clientType === "string" ? req.query.clientType : undefined;
    const url = buildWalmartAuthorizeUrl({
      environment,
      redirectUri,
      state,
      clientType,
      authorizeEndpoint,
    });
    res.json({ url, environment, redirectUri });
  },
);

router.get("/walmart/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const sessionUserId = auth?.userId;

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

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId : "";
  if (!code) {
    res.status(400).send("Missing authorization code from Walmart.");
    return;
  }
  if (!sellerId) {
    res.status(400).send("Missing seller ID from Walmart.");
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
