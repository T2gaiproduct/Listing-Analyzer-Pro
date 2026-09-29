import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
import {
  listEnabledImagePromptTemplates,
  serializeImagePromptTemplatePublic,
} from "../lib/image-prompt-template-service.js";
import type { ImagePromptTemplateCategory } from "@workspace/db";

const router: IRouter = Router();

function parseCategory(raw: unknown): ImagePromptTemplateCategory | null {
  if (raw === "graphics" || raw === "aplus") return raw;
  return null;
}

router.get("/image-prompt-templates", requireAuth, async (req, res): Promise<void> => {
  const category = parseCategory(req.query.category);
  if (!category) {
    res.status(400).json({ error: "category query param must be graphics or aplus" });
    return;
  }

  const rows = await listEnabledImagePromptTemplates(category);
  res.json({
    templates: rows.map(serializeImagePromptTemplatePublic),
  });
});

export default router;
