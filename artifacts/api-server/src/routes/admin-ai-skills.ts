import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { aiSkillsTable, db, type AiSkillType, type AiSkillStatus } from "@workspace/db";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import { listAdminSkillSampleProducts, runAdminSkillTest } from "../lib/admin-skill-test.js";
import {
  applySkillTextToContentMarketplace,
  isMarketplaceContentSkillSlug,
  syncAllContentMarketplacesToSkills,
} from "../lib/content-marketplace-skill-sync.js";
import {
  applySkillTextToImagePromptTemplate,
  isImagePromptSkillSlug,
  syncAllImagePromptTemplatesToSkills,
} from "../lib/image-prompt-skill-sync.js";

const router: IRouter = Router();

function serializeSkill(row: typeof aiSkillsTable.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    skillType: row.skillType,
    category: row.category,
    marketplaceSlug: row.marketplaceSlug,
    aiModel: row.aiModel,
    instructionsText: row.instructionsText,
    contentMarketplaceId: row.contentMarketplaceId ?? null,
    imagePromptTemplateId: row.imagePromptTemplateId ?? null,
    skillKind:
      row.contentMarketplaceId != null || isMarketplaceContentSkillSlug(row.slug)
        ? "marketplace_content"
        : row.imagePromptTemplateId != null || isImagePromptSkillSlug(row.slug)
          ? "image_prompt"
          : "custom",
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return base || `skill-${Date.now().toString(36)}`;
}

function parseSkillType(raw: unknown): AiSkillType | null {
  if (raw === "product_content" || raw === "product_images" || raw === "aplus_content") return raw;
  return null;
}

function parseStatus(raw: unknown): AiSkillStatus | null {
  if (raw === "draft" || raw === "published") return raw;
  return null;
}

function parseBody(body: unknown): {
  name: string;
  instructionsText: string;
  skillType: AiSkillType;
  category: string;
  marketplaceSlug: string;
  aiModel: string;
  status: AiSkillStatus;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const instructionsText = typeof b.instructionsText === "string" ? b.instructionsText : "";
  const skillType = parseSkillType(b.skillType) ?? "product_content";
  const category = typeof b.category === "string" ? b.category.trim() : "";
  const marketplaceSlug =
    typeof b.marketplaceSlug === "string" ? b.marketplaceSlug.trim().toLowerCase() : "amazon";
  const aiModel = typeof b.aiModel === "string" ? b.aiModel.trim() : "";
  const status = parseStatus(b.status) ?? "draft";
  if (!name || !instructionsText.trim()) return null;
  return {
    name,
    instructionsText,
    skillType,
    category,
    marketplaceSlug,
    aiModel,
    status,
  };
}

async function findSkillByIdOrSlug(param: string) {
  const asNum = Number(param);
  if (Number.isFinite(asNum) && asNum > 0) {
    const [row] = await db.select().from(aiSkillsTable).where(eq(aiSkillsTable.id, asNum)).limit(1);
    return row ?? null;
  }
  const [row] = await db.select().from(aiSkillsTable).where(eq(aiSkillsTable.slug, param)).limit(1);
  return row ?? null;
}

router.get(
  "/admin/ai-skills/samples/products",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  (_req, res): void => {
    res.json({ products: listAdminSkillSampleProducts() });
  },
);

router.get(
  "/admin/ai-skills",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (_req, res): Promise<void> => {
    await syncAllContentMarketplacesToSkills();
    await syncAllImagePromptTemplatesToSkills();
    const rows = await db
      .select()
      .from(aiSkillsTable)
      .orderBy(asc(aiSkillsTable.name));
    res.json({ skills: rows.map(serializeSkill) });
  },
);

router.get(
  "/admin/ai-skills/:idOrSlug",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const row = await findSkillByIdOrSlug(req.params.idOrSlug ?? "");
    if (!row) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json({ skill: serializeSkill(row) });
  },
);

router.post(
  "/admin/ai-skills",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid skill payload" });
      return;
    }
    const slug = typeof (req.body as { slug?: string }).slug === "string"
      ? slugify((req.body as { slug: string }).slug)
      : slugify(body.name);
    const now = new Date();
    const [inserted] = await db
      .insert(aiSkillsTable)
      .values({
        slug,
        name: body.name,
        status: body.status,
        skillType: body.skillType,
        category: body.category,
        marketplaceSlug: body.marketplaceSlug,
        aiModel: body.aiModel,
        instructionsText: body.instructionsText,
        updatedAt: now,
      })
      .returning();
    res.status(201).json({ skill: serializeSkill(inserted!) });
  },
);

router.patch(
  "/admin/ai-skills/:idOrSlug",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const existing = await findSkillByIdOrSlug(req.params.idOrSlug ?? "");
    if (!existing) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid skill payload" });
      return;
    }
    const [updated] = await db
      .update(aiSkillsTable)
      .set({
        name: body.name,
        status: body.status,
        skillType: body.skillType,
        category: body.category,
        marketplaceSlug: body.marketplaceSlug,
        aiModel: body.aiModel,
        instructionsText: body.instructionsText,
        updatedAt: new Date(),
      })
      .where(eq(aiSkillsTable.id, existing.id))
      .returning();
    const row = updated!;
    if (row.contentMarketplaceId != null) {
      await applySkillTextToContentMarketplace(
        row.contentMarketplaceId,
        row.instructionsText,
        row.status as "draft" | "published",
      );
    }
    if (row.imagePromptTemplateId != null) {
      await applySkillTextToImagePromptTemplate(
        row.imagePromptTemplateId,
        row.instructionsText,
        row.status as "draft" | "published",
      );
    }
    res.json({ skill: serializeSkill(row) });
  },
);

router.post(
  "/admin/ai-skills/test",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const instructionsText =
      typeof (req.body as { instructionsText?: string })?.instructionsText === "string"
        ? (req.body as { instructionsText: string }).instructionsText
        : "";
    if (!instructionsText.trim()) {
      res.status(400).json({ error: "Missing instructionsText" });
      return;
    }
    const sampleProductId =
      typeof (req.body as { sampleProductId?: string })?.sampleProductId === "string"
        ? (req.body as { sampleProductId: string }).sampleProductId
        : undefined;
    const aiModel =
      typeof (req.body as { aiModel?: string })?.aiModel === "string"
        ? (req.body as { aiModel: string }).aiModel
        : undefined;
    res.json({
      output: runAdminSkillTest({ instructionsText, sampleProductId, aiModel }),
    });
  },
);

router.post(
  "/admin/ai-skills/:idOrSlug/test",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const existing = await findSkillByIdOrSlug(req.params.idOrSlug ?? "");
    const instructionsText =
      typeof (req.body as { instructionsText?: string })?.instructionsText === "string"
        ? (req.body as { instructionsText: string }).instructionsText
        : existing?.instructionsText ?? "";
    if (!instructionsText.trim()) {
      res.status(400).json({ error: "Missing instructionsText" });
      return;
    }
    const sampleProductId =
      typeof (req.body as { sampleProductId?: string })?.sampleProductId === "string"
        ? (req.body as { sampleProductId: string }).sampleProductId
        : undefined;
    const aiModel =
      typeof (req.body as { aiModel?: string })?.aiModel === "string"
        ? (req.body as { aiModel: string }).aiModel
        : existing?.aiModel;
    res.json({
      output: runAdminSkillTest({ instructionsText, sampleProductId, aiModel }),
    });
  },
);

export default router;
