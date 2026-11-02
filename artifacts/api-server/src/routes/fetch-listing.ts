import { Router, type IRouter } from "express";
import { requireAuth, type AuthedRequest } from "../lib/require-auth.js";
import { fetchListing } from "../lib/listing-fetcher";
import { rateLimit } from "../lib/rate-limit";
import { resolveWorkspaceContext, WORKSPACE_HEADER } from "../lib/workspace-context.js";

const router: IRouter = Router();


router.post(
  "/fetch-listing",
  requireAuth,
  rateLimit({ route: "fetch-listing", windowMs: 60_000, max: 20 }),
  async (req, res): Promise<void> => {
    const { asin, url } = req.body as { asin?: string; url?: string };

    if (!asin && !url) {
      res.status(400).json({ error: "Either asin or url must be provided" });
      return;
    }

    try {
      const authed = req as AuthedRequest;
      const headerVal = req.get(WORKSPACE_HEADER) ?? req.get("X-Workspace-Id");
      const workspaceCtx = await resolveWorkspaceContext(authed.userId, headerVal);
      const listing = await fetchListing({
        asin,
        url,
        spApi: workspaceCtx
          ? { workspaceId: workspaceCtx.workspaceId, userId: authed.userId, req }
          : undefined,
      });
      res.json(listing);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch listing";
      req.log.warn({ err, asin, url }, "fetch-listing failed");
      const isCaptcha = message.toLowerCase().includes("captcha") || message.toLowerCase().includes("blocked");
      res.status(isCaptcha ? 503 : 400).json({ error: message, captchaBlocked: isCaptcha });
    }
  },
);

export default router;
