import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { fetchListing } from "../lib/listing-fetcher";
import { rateLimit } from "../lib/rate-limit";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

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
      const listing = await fetchListing({ asin, url });
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
