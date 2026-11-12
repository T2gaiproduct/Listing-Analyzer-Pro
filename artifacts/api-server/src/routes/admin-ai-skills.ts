import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  aiSkillsTable,
  contentMarketplacesTable,
  db,
  imagePromptTemplatesTable,
  type AiSkillStatus,
  type AiSkillType,
} from "@workspace/db";
import { requireAdmin, requireAdminPermission } from "../lib/admin-auth.js";
import {
  listAdminSkillSampleProducts,
  runAdminListingAuditSkillTest,
  runAdminSkillTest,
} from "../lib/admin-skill-test.js";
import {
  applySkillTextToContentMarketplace,
  deleteSkillForContentMarketplace,
  isMarketplaceContentSkillSlug,
  syncAllContentMarketplacesToSkills,
} from "../lib/content-marketplace-skill-sync.js";
import { getContentMarketplaceById } from "../lib/content-marketplace-service.js";
import {
  applySkillTextToImagePromptTemplate,
  deleteSkillForImagePromptTemplate,
  isImagePromptSkillSlug,
  syncAllImagePromptTemplatesToSkills,
} from "../lib/image-prompt-skill-sync.js";
import { getImagePromptTemplateById } from "../lib/image-prompt-template-service.js";

function routeParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}
import { ensureAiSkillTypesReady, isEnabledSkillTypeSlug } from "../lib/ensure-ai-skill-types.js";
import {
  listSkillChatModelOptions,
  skillTypeToAiUseCase,
} from "../lib/admin-skill-chat-models.js";

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

async function allocateUniqueSkillSlug(baseName: string, preferredRaw?: string): Promise<string> {
  const preferred = preferredRaw?.trim() ? slugify(preferredRaw) : "";
  const base = preferred || slugify(baseName) || `skill-${Date.now().toString(36)}`;
  let candidate = base;
  for (let n = 2; n < 10_000; n++) {
    const [row] = await db
      .select({ id: aiSkillsTable.id })
      .from(aiSkillsTable)
      .where(eq(aiSkillsTable.slug, candidate))
      .limit(1);
    if (!row) return candidate;
    candidate = `${base.slice(0, 58)}-${n}`;
  }
  return `${base.slice(0, 48)}-${Date.now().toString(36)}`;
}

function formatAiSkillSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/unique|duplicate key|ai_skills_slug/i.test(message)) {
    return "A skill with this name already exists. Change the skill name in the instructions header and try again.";
  }
  if (/Failed query:/i.test(message)) {
    return "Could not save the skill. If the name is “New skill”, rename it in the instructions (name: …) and publish again.";
  }
  if (message.length > 220) {
    return "Could not save the skill.";
  }
  return message;
}

function parseSkillType(raw: unknown): AiSkillType | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim();
  if (!slug) return null;
  if (isEnabledSkillTypeSlug(slug)) return slug;
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
  "/admin/ai-skills/chat-models",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const skillType =
      typeof req.query.skillType === "string" ? req.query.skillType.trim() : "product_content";
    const useCase = skillTypeToAiUseCase(skillType);
    const payload = await listSkillChatModelOptions(useCase);
    res.json(payload);
  },
);

router.get(
  "/admin/ai-skills",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (_req, res): Promise<void> => {
    await ensureAiSkillTypesReady();
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
    const row = await findSkillByIdOrSlug(routeParam(req.params.idOrSlug));
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
    await ensureAiSkillTypesReady();
    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid skill payload" });
      return;
    }
    try {
      const preferredSlug =
        typeof (req.body as { slug?: string }).slug === "string"
          ? (req.body as { slug: string }).slug
          : undefined;
      const slug = await allocateUniqueSkillSlug(body.name, preferredSlug);
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
    } catch (err) {
      req.log?.error?.({ err }, "admin-ai-skills create failed");
      res.status(400).json({ error: formatAiSkillSaveError(err) });
    }
  },
);

router.patch(
  "/admin/ai-skills/:idOrSlug",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    await ensureAiSkillTypesReady();
    const existing = await findSkillByIdOrSlug(routeParam(req.params.idOrSlug));
    if (!existing) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Invalid skill payload" });
      return;
    }
    try {
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
    } catch (err) {
      req.log?.error?.({ err }, "admin-ai-skills update failed");
      res.status(400).json({ error: formatAiSkillSaveError(err) });
    }
  },
);

async function handleAdminSkillTest(req: import("express").Request, res: import("express").Response): Promise<void> {
  const body = req.body as {
    instructionsText?: string;
    sampleProductId?: string;
    aiModel?: string;
    skillType?: string;
    category?: string;
  };
  const instructionsText = typeof body.instructionsText === "string" ? body.instructionsText : "";
  if (!instructionsText.trim()) {
    res.status(400).json({ error: "Missing instructionsText" });
    return;
  }
  const sampleProductId =
    typeof body.sampleProductId === "string" ? body.sampleProductId : undefined;
  const aiModel = typeof body.aiModel === "string" ? body.aiModel : undefined;
  const skillType = typeof body.skillType === "string" ? body.skillType.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";

  if (skillType === "listing_audit") {
    try {
      const audit = await runAdminListingAuditSkillTest({
        instructionsText,
        sampleProductId,
        category,
        aiModel,
      });
      res.json(audit);
      return;
    } catch (err) {
      req.log?.error?.({ err }, "admin listing audit skill test failed");
      res.status(400).json({
        error:
          err instanceof Error && err.message.length < 220
            ? err.message
            : "Audit test failed. Check AI Settings provider/key, then try again.",
      });
      return;
    }
  }

  res.json({
    mode: "product_content",
    output: runAdminSkillTest({ instructionsText, sampleProductId, aiModel }),
  });
}

router.delete(
  "/admin/ai-skills/:idOrSlug",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const existing = await findSkillByIdOrSlug(routeParam(req.params.idOrSlug));
    if (!existing) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    try {
      if (existing.contentMarketplaceId != null) {
        const mp = await getContentMarketplaceById(existing.contentMarketplaceId);
        if (mp?.isDefault === 1) {
          res.status(400).json({
            error: "Cannot delete the default marketplace skill. Set another marketplace as default first.",
          });
          return;
        }
        if (mp) {
          await deleteSkillForContentMarketplace(mp.id);
          await db.delete(contentMarketplacesTable).where(eq(contentMarketplacesTable.id, mp.id));
        } else {
          await db.delete(aiSkillsTable).where(eq(aiSkillsTable.id, existing.id));
        }
        res.json({ ok: true, deleted: "marketplace_content" });
        return;
      }

      if (existing.imagePromptTemplateId != null) {
        const tpl = await getImagePromptTemplateById(existing.imagePromptTemplateId);
        if (tpl?.isSystem === 1) {
          res.status(400).json({
            error: "System image prompt skills cannot be deleted. Disable the template instead.",
          });
          return;
        }
        if (tpl) {
          await deleteSkillForImagePromptTemplate(tpl.id);
          await db.delete(imagePromptTemplatesTable).where(eq(imagePromptTemplatesTable.id, tpl.id));
        } else {
          await db.delete(aiSkillsTable).where(eq(aiSkillsTable.id, existing.id));
        }
        res.json({ ok: true, deleted: "image_prompt" });
        return;
      }

      await db.delete(aiSkillsTable).where(eq(aiSkillsTable.id, existing.id));
      res.json({ ok: true, deleted: "custom" });
    } catch (err) {
      req.log?.error?.({ err }, "admin-ai-skills delete failed");
      res.status(400).json({
        error: err instanceof Error && err.message.length < 220 ? err.message : "Could not delete skill.",
      });
    }
  },
);

router.post(
  "/admin/ai-skills/test",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  handleAdminSkillTest,
);

router.post(
  "/admin/ai-skills/:idOrSlug/test",
  requireAdmin,
  requireAdminPermission("manage_settings"),
  async (req, res): Promise<void> => {
    const existing = await findSkillByIdOrSlug(routeParam(req.params.idOrSlug));
    const body = req.body as Record<string, unknown>;
    if (typeof body.instructionsText !== "string" && existing?.instructionsText) {
      body.instructionsText = existing.instructionsText;
    }
    if (typeof body.skillType !== "string" && existing?.skillType) {
      body.skillType = existing.skillType;
    }
    if (typeof body.category !== "string" && existing?.category) {
      body.category = existing.category;
    }
    if (typeof body.aiModel !== "string" && existing?.aiModel) {
      body.aiModel = existing.aiModel;
    }
    await handleAdminSkillTest(req, res);
  },
);

export default router;
