import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  imagePromptTemplateCategorySchema,
  imagePromptTemplateMetadataSchema,
  imagePromptTemplatesTable,
} from "@workspace/db";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import {
  getImagePromptTemplateById,
  listAllImagePromptTemplatesAdmin,
  serializeImagePromptTemplateAdmin,
  validateTemplatePlaceholders,
} from "../lib/image-prompt-template-service.js";

const router: IRouter = Router();

function parseSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function deriveSlugFromName(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

type ParsedUpsert = {
  slug: string;
  category: "graphics" | "aplus";
  name: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  promptTemplate: string;
  headlineTemplate: string | null;
  bodyTemplate: string | null;
  metadata: ReturnType<typeof imagePromptTemplateMetadataSchema.parse> | null;
};

function parseUpsertBody(body: unknown): { ok: true; data: ParsedUpsert } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;
  const categoryParsed = imagePromptTemplateCategorySchema.safeParse(b.category);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const promptTemplate = typeof b.promptTemplate === "string" ? b.promptTemplate : "";
  if (!categoryParsed.success) {
    return { ok: false, error: "Category must be graphics or aplus." };
  }
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  let slug = parseSlug(b.slug);
  if (!slug) slug = deriveSlugFromName(name);
  if (!slug) {
    return { ok: false, error: "Slug is required (use letters, numbers, and hyphens only)." };
  }

  const meta = b.metadata == null
    ? null
    : imagePromptTemplateMetadataSchema.safeParse(b.metadata);
  if (b.metadata != null && !meta?.success) {
    return { ok: false, error: "Invalid metadata." };
  }

  const isCustom = meta?.success && meta.data.isUserCustomType;
  if (categoryParsed.data === "graphics" && !isCustom && promptTemplate.trim().length < 10) {
    return { ok: false, error: "Image prompt must be at least 10 characters (or enable user custom prompt type)." };
  }
  if (categoryParsed.data === "aplus" && promptTemplate.trim().length < 20) {
    return { ok: false, error: "A+ image prompt must be at least 20 characters." };
  }

  const placeholderError = validateTemplatePlaceholders(
    categoryParsed.data,
    promptTemplate,
    typeof b.headlineTemplate === "string" ? b.headlineTemplate : null,
    typeof b.bodyTemplate === "string" ? b.bodyTemplate : null,
  );
  if (placeholderError) {
    return { ok: false, error: placeholderError };
  }

  return {
    ok: true,
    data: {
      slug,
      category: categoryParsed.data,
      name,
      description: typeof b.description === "string" ? b.description.trim() || null : null,
      enabled: b.enabled !== false,
      sortOrder: typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
      promptTemplate,
      headlineTemplate: typeof b.headlineTemplate === "string" ? b.headlineTemplate.trim() || null : null,
      bodyTemplate: typeof b.bodyTemplate === "string" ? b.bodyTemplate.trim() || null : null,
      metadata: meta?.success ? meta.data : null,
    },
  };
}

router.get(
  "/admin/image-prompt-templates",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const categoryRaw = req.query.category;
    const category =
      categoryRaw === "graphics" || categoryRaw === "aplus" ? categoryRaw : undefined;
    const rows = await listAllImagePromptTemplatesAdmin(category);
    res.json({ templates: rows.map(serializeImagePromptTemplateAdmin) });
  },
);

router.post(
  "/admin/image-prompt-templates",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const parsed = parseUpsertBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const data = parsed.data;

    try {
      const [inserted] = await db
        .insert(imagePromptTemplatesTable)
        .values({
          slug: data.slug,
          category: data.category,
          name: data.name,
          description: data.description,
          enabled: data.enabled ? 1 : 0,
          isSystem: 0,
          sortOrder: data.sortOrder,
          promptTemplate: data.promptTemplate,
          headlineTemplate: data.headlineTemplate,
          bodyTemplate: data.bodyTemplate,
          metadata: data.metadata,
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json({ template: serializeImagePromptTemplateAdmin(inserted) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate/i.test(message)) {
        res.status(409).json({ error: `A ${data.category} template with slug "${data.slug}" already exists.` });
        return;
      }
      throw err;
    }
  },
);

router.patch(
  "/admin/image-prompt-templates/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await getImagePromptTemplateById(id);
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const merged = {
      slug: existing.slug,
      category: existing.category,
      name: existing.name,
      description: existing.description,
      enabled: existing.enabled === 1,
      sortOrder: existing.sortOrder,
      promptTemplate: existing.promptTemplate,
      headlineTemplate: existing.headlineTemplate,
      bodyTemplate: existing.bodyTemplate,
      metadata: existing.metadata,
      ...(req.body as object),
    };

    const parsed = parseUpsertBody(merged);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const data = parsed.data;

    if (existing.isSystem === 1 && data.slug !== existing.slug) {
      res.status(400).json({ error: "System template slug cannot be changed" });
      return;
    }

    const [updated] = await db
      .update(imagePromptTemplatesTable)
      .set({
        slug: data.slug,
        category: data.category,
        name: data.name,
        description: data.description,
        enabled: data.enabled ? 1 : 0,
        sortOrder: data.sortOrder,
        promptTemplate: data.promptTemplate,
        headlineTemplate: data.headlineTemplate,
        bodyTemplate: data.bodyTemplate,
        metadata: data.metadata,
        updatedAt: new Date(),
      })
      .where(eq(imagePromptTemplatesTable.id, id))
      .returning();

    res.json({ template: serializeImagePromptTemplateAdmin(updated) });
  },
);

router.delete(
  "/admin/image-prompt-templates/:id",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await getImagePromptTemplateById(id);
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    if (existing.isSystem === 1) {
      res.status(400).json({ error: "System templates cannot be deleted. Disable them instead." });
      return;
    }

    await db.delete(imagePromptTemplatesTable).where(eq(imagePromptTemplatesTable.id, id));
    res.json({ ok: true });
  },
);

export default router;
