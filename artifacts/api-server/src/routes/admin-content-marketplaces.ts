import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  contentMarketplaceRulesSchema,
  contentMarketplacesTable,
  db,
} from "@workspace/db";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import {
  getContentMarketplaceById,
  listAllContentMarketplacesAdmin,
  serializeContentMarketplaceAdmin,
} from "../lib/content-marketplace-service.js";

const router: IRouter = Router();

function parseSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function parseUpsertBody(body: unknown): {
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  aiInstructions: string;
  rules: ReturnType<typeof contentMarketplaceRulesSchema.parse> | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const slug = parseSlug(b.slug);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const aiInstructions = typeof b.aiInstructions === "string" ? b.aiInstructions : "";
  if (!slug || !name || aiInstructions.length < 20) return null;

  let rules = null;
  if (b.rules != null) {
    const parsedRules = contentMarketplaceRulesSchema.safeParse(b.rules);
    if (!parsedRules.success) return null;
    rules = parsedRules.data;
  }

  return {
    slug,
    name,
    description: typeof b.description === "string" ? b.description.trim() || null : null,
    enabled: b.enabled !== false,
    isDefault: b.isDefault === true,
    sortOrder: typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
    aiInstructions,
    rules,
  };
}

function parsePatchBody(body: unknown): Partial<ReturnType<typeof parseUpsertBody>> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const out: Partial<ReturnType<typeof parseUpsertBody>> = {};

  if (b.slug !== undefined) {
    const slug = parseSlug(b.slug);
    if (!slug) return null;
    out.slug = slug;
  }
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) return null;
    out.name = b.name.trim();
  }
  if (b.description !== undefined) {
    out.description = typeof b.description === "string" ? b.description.trim() || null : null;
  }
  if (b.enabled !== undefined) out.enabled = b.enabled !== false;
  if (b.isDefault !== undefined) out.isDefault = b.isDefault === true;
  if (b.sortOrder !== undefined) {
    if (typeof b.sortOrder !== "number" || !Number.isFinite(b.sortOrder)) return null;
    out.sortOrder = b.sortOrder;
  }
  if (b.aiInstructions !== undefined) {
    if (typeof b.aiInstructions !== "string" || b.aiInstructions.length < 20) return null;
    out.aiInstructions = b.aiInstructions;
  }
  if (b.rules !== undefined) {
    if (b.rules == null) {
      out.rules = null;
    } else {
      const parsedRules = contentMarketplaceRulesSchema.safeParse(b.rules);
      if (!parsedRules.success) return null;
      out.rules = parsedRules.data;
    }
  }
  return out;
}

router.get(
  "/admin/content-marketplaces",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (_req, res): Promise<void> => {
    const rows = await listAllContentMarketplacesAdmin();
    res.json({ marketplaces: rows.map(serializeContentMarketplaceAdmin) });
  },
);

router.post(
  "/admin/content-marketplaces",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const body = parseUpsertBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid marketplace payload" });
      return;
    }

    if (body.isDefault) {
      await db.update(contentMarketplacesTable).set({ isDefault: 0 });
    }

    const [created] = await db
      .insert(contentMarketplacesTable)
      .values({
        slug: body.slug,
        name: body.name,
        description: body.description,
        enabled: body.enabled ? 1 : 0,
        isDefault: body.isDefault ? 1 : 0,
        sortOrder: body.sortOrder,
        aiInstructions: body.aiInstructions,
        rules: body.rules,
      })
      .returning();

    res.status(201).json(serializeContentMarketplaceAdmin(created!));
  },
);

router.patch(
  "/admin/content-marketplaces/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await getContentMarketplaceById(id);
    if (!existing) {
      res.status(404).json({ error: "Marketplace not found" });
      return;
    }

    const body = parsePatchBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid marketplace payload" });
      return;
    }

    const updates: Partial<typeof contentMarketplacesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.slug != null) updates.slug = body.slug;
    if (body.name != null) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault ? 1 : 0;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.aiInstructions != null) updates.aiInstructions = body.aiInstructions;
    if (body.rules !== undefined) updates.rules = body.rules;

    if (body.isDefault) {
      await db.update(contentMarketplacesTable).set({ isDefault: 0 });
      updates.isDefault = 1;
    }

    const [updated] = await db
      .update(contentMarketplacesTable)
      .set(updates)
      .where(eq(contentMarketplacesTable.id, id))
      .returning();

    const row = updated ?? (await getContentMarketplaceById(id));
    res.json(serializeContentMarketplaceAdmin(row!));
  },
);

router.delete(
  "/admin/content-marketplaces/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await getContentMarketplaceById(id);
    if (!existing) {
      res.status(404).json({ error: "Marketplace not found" });
      return;
    }

    if (existing.isDefault === 1) {
      res.status(400).json({ error: "Cannot delete the default marketplace. Set another default first." });
      return;
    }

    await db.delete(contentMarketplacesTable).where(eq(contentMarketplacesTable.id, id));
    res.json({ ok: true });
  },
);

export default router;
