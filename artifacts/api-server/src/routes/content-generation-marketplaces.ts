import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  listEnabledContentMarketplaces,
  serializeContentMarketplaceForClient,
} from "../lib/content-marketplace-service.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/content-marketplaces", requireAuth, async (_req, res): Promise<void> => {
  const rows = await listEnabledContentMarketplaces();
  res.json({ marketplaces: rows.map(serializeContentMarketplaceForClient) });
});

export default router;
