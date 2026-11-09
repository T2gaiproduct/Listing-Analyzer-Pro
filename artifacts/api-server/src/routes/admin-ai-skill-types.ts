import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { aiSkillsTable, aiSkillTypesTable, db } from "@workspace/db";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import {
  ensureAiSkillTypesReady,
  invalidateSkillTypeCache,
  refreshSkillTypeCache,
} from "../lib/ensure-ai-skill-types.js";

const router: IRouter = Router();

function slugifyTypeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

// Scope admin guard to this mount only — bare router.use() would intercept every later /api route.
router.use("/admin/ai-skill-types", requireAdmin);

router.get("/admin/ai-skill-types", async (_req, res): Promise<void> => {
  await ensureAiSkillTypesReady();
  const rows = await db
    .select()
    .from(aiSkillTypesTable)
    .orderBy(asc(aiSkillTypesTable.sortOrder), asc(aiSkillTypesTable.slug));
  res.json({
    types: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      catalogGroup: row.catalogGroup,
      editorMode: row.editorMode,
      handlerKey: row.handlerKey,
      description: row.description ?? "",
      enabled: row.enabled === 1,
      isBuiltin: row.isBuiltin === 1,
      sortOrder: row.sortOrder,
    })),
  });
});

router.post(
  "/admin/ai-skill-types",
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureAiSkillTypesReady();
    const b = req.body as Record<string, unknown>;
    const slug = slugifyTypeSlug(typeof b.slug === "string" ? b.slug : "");
    const label = typeof b.label === "string" ? b.label.trim() : "";
    if (!slug || !label) {
      res.status(400).json({ error: "slug and label are required" });
      return;
    }
    const catalogGroup =
      b.catalogGroup === "content"
      || b.catalogGroup === "image"
      || b.catalogGroup === "audit"
      || b.catalogGroup === "other"
        ? b.catalogGroup
        : "other";
    const editorMode =
      b.editorMode === "content"
      || b.editorMode === "image"
      || b.editorMode === "audit"
      || b.editorMode === "generic"
        ? b.editorMode
        : "generic";
    const handlerKey =
      typeof b.handlerKey === "string" && b.handlerKey.trim() ? b.handlerKey.trim() : null;
    const description = typeof b.description === "string" ? b.description.trim() : null;
    const sortOrder = typeof b.sortOrder === "number" ? b.sortOrder : 100;

    try {
      const [row] = await db
        .insert(aiSkillTypesTable)
        .values({
          slug,
          label,
          catalogGroup,
          editorMode,
          handlerKey,
          description,
          enabled: 1,
          isBuiltin: 0,
          sortOrder,
        })
        .returning();
      invalidateSkillTypeCache();
      await refreshSkillTypeCache();
      res.status(201).json({ type: row });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("unique") || msg.includes("duplicate")) {
        res.status(409).json({ error: "A skill type with this slug already exists" });
        return;
      }
      throw e;
    }
  },
);

router.patch(
  "/admin/ai-skill-types/:id",
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureAiSkillTypesReady();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(aiSkillTypesTable)
      .where(eq(aiSkillTypesTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const b = req.body as Record<string, unknown>;
    const patch: Partial<typeof aiSkillTypesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof b.label === "string" && b.label.trim()) patch.label = b.label.trim();
    if (
      b.catalogGroup === "content"
      || b.catalogGroup === "image"
      || b.catalogGroup === "audit"
      || b.catalogGroup === "other"
    ) {
      patch.catalogGroup = b.catalogGroup;
    }
    if (
      b.editorMode === "content"
      || b.editorMode === "image"
      || b.editorMode === "audit"
      || b.editorMode === "generic"
    ) {
      patch.editorMode = b.editorMode;
    }
    if (b.enabled === true) patch.enabled = 1;
    if (b.enabled === false) patch.enabled = 0;
    if (typeof b.description === "string") patch.description = b.description.trim();
    if (typeof b.sortOrder === "number") patch.sortOrder = b.sortOrder;
    if (existing.isBuiltin !== 1 && typeof b.handlerKey === "string") {
      patch.handlerKey = b.handlerKey.trim() || null;
    }

    const [row] = await db
      .update(aiSkillTypesTable)
      .set(patch)
      .where(eq(aiSkillTypesTable.id, id))
      .returning();
    invalidateSkillTypeCache();
    await refreshSkillTypeCache();
    res.json({ type: row });
  },
);

router.delete(
  "/admin/ai-skill-types/:id",
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureAiSkillTypesReady();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(aiSkillTypesTable)
      .where(eq(aiSkillTypesTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.isBuiltin === 1) {
      res.status(400).json({ error: "Built-in skill types cannot be deleted." });
      return;
    }
    const [inUse] = await db
      .select({ id: aiSkillsTable.id })
      .from(aiSkillsTable)
      .where(eq(aiSkillsTable.skillType, existing.slug))
      .limit(1);
    if (inUse) {
      res.status(400).json({
        error: "This type is used by one or more skills. Delete or reassign those skills first.",
      });
      return;
    }
    await db.delete(aiSkillTypesTable).where(eq(aiSkillTypesTable.id, id));
    invalidateSkillTypeCache();
    await refreshSkillTypeCache();
    res.json({ ok: true });
  },
);

export default router;
