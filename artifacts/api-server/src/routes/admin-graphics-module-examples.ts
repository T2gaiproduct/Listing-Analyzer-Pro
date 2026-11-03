import { Router, type IRouter } from "express";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import { ensureGraphicsProductCategoriesReady } from "../lib/ensure-graphics-product-categories.js";
import { ensureImagePromptTemplatesReady } from "../lib/ensure-image-prompt-templates.js";
import {
  addGraphicsModuleExample,
  addProductCategory,
  deleteCustomProductCategory,
  deleteGraphicsModuleExampleById,
  deleteGraphicsModuleExamplesForSlug,
  getGraphicsModuleExamplesForCategory,
  listProductCategoriesAdmin,
} from "../lib/graphics-module-examples-service.js";
import { saveGraphicsExampleImageFromDataUrl } from "../lib/graphics-example-image-storage.js";

const router: IRouter = Router();

router.get(
  "/admin/product-categories",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (_req, res): Promise<void> => {
    await ensureGraphicsProductCategoriesReady();
    const categories = await listProductCategoriesAdmin();
    res.json({ categories });
  },
);

router.post(
  "/admin/product-categories",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureGraphicsProductCategoriesReady();
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    try {
      const created = await addProductCategory(name);
      res.status(201).json({ category: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate/i.test(message)) {
        res.status(409).json({ error: "A category with that name already exists." });
        return;
      }
      res.status(400).json({ error: message });
    }
  },
);

router.delete(
  "/admin/product-categories/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await deleteCustomProductCategory(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

router.get(
  "/admin/graphics-module-examples",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureImagePromptTemplatesReady();
    await ensureGraphicsProductCategoriesReady();
    const categoryRaw = req.query.category;
    const category = typeof categoryRaw === "string" ? categoryRaw : null;
    const payload = await getGraphicsModuleExamplesForCategory(category);
    res.json(payload);
  },
);

router.put(
  "/admin/graphics-module-examples",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const b = req.body as Record<string, unknown>;
    const productCategoryName = typeof b.productCategoryName === "string" ? b.productCategoryName : "";
    const templateSlug = typeof b.templateSlug === "string" ? b.templateSlug : "";
    const exampleImageUrl = typeof b.exampleImageUrl === "string" ? b.exampleImageUrl : "";
    const exampleIdRaw = b.exampleId;
    const exampleId =
      typeof exampleIdRaw === "number"
        ? exampleIdRaw
        : typeof exampleIdRaw === "string"
          ? parseInt(exampleIdRaw, 10)
          : NaN;

    try {
      if (!exampleImageUrl.trim()) {
        if (Number.isFinite(exampleId) && exampleId > 0) {
          await deleteGraphicsModuleExampleById(exampleId);
        } else {
          await deleteGraphicsModuleExamplesForSlug(productCategoryName, templateSlug);
        }
        res.json({ ok: true });
        return;
      }
      const { id } = await addGraphicsModuleExample(productCategoryName, templateSlug, exampleImageUrl);
      res.json({ ok: true, id });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

router.delete(
  "/admin/graphics-module-examples/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await deleteGraphicsModuleExampleById(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

router.post(
  "/admin/graphics-module-example-image",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    if (!dataUrl.trim()) {
      res.status(400).json({ error: "dataUrl is required" });
      return;
    }
    try {
      const url = saveGraphicsExampleImageFromDataUrl(dataUrl);
      res.json({ url });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

export default router;
