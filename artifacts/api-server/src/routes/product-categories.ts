import { Router, type IRouter } from "express";
import { ensureGraphicsProductCategoriesReady } from "../lib/ensure-graphics-product-categories.js";
import { listProductCategoryNames } from "../lib/graphics-module-examples-service.js";

const router: IRouter = Router();

router.get("/product-categories", async (_req, res): Promise<void> => {
  await ensureGraphicsProductCategoriesReady();
  const categories = await listProductCategoryNames();
  res.json({ categories });
});

export default router;
