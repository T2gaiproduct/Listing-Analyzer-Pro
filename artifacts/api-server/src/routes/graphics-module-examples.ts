import { Router, type IRouter } from "express";
import { ensureGraphicsProductCategoriesReady } from "../lib/ensure-graphics-product-categories.js";
import { ensureImagePromptTemplatesReady } from "../lib/ensure-image-prompt-templates.js";
import { getGraphicsModuleExamplesForCategory } from "../lib/graphics-module-examples-service.js";

const router: IRouter = Router();

router.get("/graphics-module-examples", async (req, res): Promise<void> => {
  await ensureImagePromptTemplatesReady();
  await ensureGraphicsProductCategoriesReady();
  const categoryRaw = req.query.category;
  const category = typeof categoryRaw === "string" ? categoryRaw : null;
  const templateCategory = req.query.templateCategory === "aplus" ? "aplus" : "graphics";
  const payload = await getGraphicsModuleExamplesForCategory(
    category,
    { mergeDefaultExamples: true },
    templateCategory,
  );
  res.json(payload);
});

export default router;
