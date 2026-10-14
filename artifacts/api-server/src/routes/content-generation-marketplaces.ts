import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth, type AuthedRequest } from "../lib/require-auth.js";
import {
  listEnabledContentMarketplaces,
  serializeContentMarketplaceForClient,
} from "../lib/content-marketplace-service.js";

const router: IRouter = Router();


router.get("/content-marketplaces", requireAuth, async (_req, res): Promise<void> => {
  const rows = await listEnabledContentMarketplaces();
  res.json({ marketplaces: rows.map(serializeContentMarketplaceForClient) });
});

export default router;
