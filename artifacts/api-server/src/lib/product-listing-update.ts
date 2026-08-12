import { and, eq } from "drizzle-orm";
import type { GeneratedContent } from "@workspace/db";
import { db, auditsTable, productMarketplaceListingsTable } from "@workspace/db";
import { bulletsToHtmlDescription } from "./resolve-listing-content.js";

export interface ProductListingPatchInput {
  listingTitle?: string;
  bulletPoints?: string[];
  targetKeywords?: string[];
  descriptionHtml?: string;
  price?: number | string | null;
  sku?: string;
}

function normalizeBulletPoints(raw: string[]): string[] {
  return raw.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 10);
}

function normalizeKeywords(raw: string[]): string[] {
  return raw.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 30);
}

function parsePriceCents(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export async function applyProductListingUpdates(
  auditId: number,
  body: ProductListingPatchInput,
): Promise<void> {
  const [existing] = await db
    .select({
      title: auditsTable.title,
      workspaceId: auditsTable.workspaceId,
      generatedContent: auditsTable.generatedContent,
      bulletPoints: auditsTable.bulletPoints,
      targetKeywords: auditsTable.targetKeywords,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);

  if (!existing) {
    throw new Error("Product not found");
  }

  const auditUpdates: Record<string, unknown> = { updatedAt: new Date() };
  let nextBullets = existing.bulletPoints ?? [];
  let nextKeywords = existing.targetKeywords ?? [];

  if (typeof body.listingTitle === "string") {
    const trimmed = body.listingTitle.trim();
    if (!trimmed) throw new Error("Listing title is required");
    auditUpdates.title = trimmed;
  }

  if (Array.isArray(body.bulletPoints)) {
    nextBullets = normalizeBulletPoints(body.bulletPoints);
    auditUpdates.bulletPoints = nextBullets;
  }

  if (Array.isArray(body.targetKeywords)) {
    nextKeywords = normalizeKeywords(body.targetKeywords);
    auditUpdates.targetKeywords = nextKeywords;
  }

  const currentGenerated = (existing.generatedContent ?? null) as GeneratedContent | null;
  const listingFieldsChanged = typeof body.listingTitle === "string"
    || Array.isArray(body.bulletPoints)
    || Array.isArray(body.targetKeywords)
    || typeof body.descriptionHtml === "string";

  if (listingFieldsChanged) {
    const resolvedTitle = typeof body.listingTitle === "string"
      ? body.listingTitle.trim()
      : currentGenerated?.title?.trim()
        || existing.title?.trim()
        || "";
    const resolvedBullets = Array.isArray(body.bulletPoints)
      ? nextBullets
      : currentGenerated?.bulletPoints?.length
        ? currentGenerated.bulletPoints
        : nextBullets;
    const resolvedKeywords = Array.isArray(body.targetKeywords)
      ? nextKeywords
      : currentGenerated?.keywords?.length
        ? currentGenerated.keywords
        : nextKeywords;
    const htmlDescription = typeof body.descriptionHtml === "string"
      ? body.descriptionHtml.trim() || bulletsToHtmlDescription(resolvedBullets)
      : currentGenerated?.htmlDescription?.trim()
        || bulletsToHtmlDescription(resolvedBullets);

    if (resolvedTitle || resolvedBullets.length > 0 || resolvedKeywords.length > 0 || htmlDescription) {
      auditUpdates.generatedContent = {
        title: resolvedTitle || currentGenerated?.title?.trim() || existing.title?.trim() || "",
        bulletPoints: resolvedBullets,
        keywords: resolvedKeywords,
        htmlDescription,
      } satisfies GeneratedContent;
    }
  }

  if (Object.keys(auditUpdates).length > 1) {
    await db.update(auditsTable).set(auditUpdates).where(eq(auditsTable.id, auditId));
  }

  if (body.price !== undefined || typeof body.sku === "string") {
    const priceCents = body.price !== undefined ? parsePriceCents(body.price) : undefined;
    const sku = typeof body.sku === "string" ? body.sku.trim() || null : undefined;
    for (const marketplace of SYNC_MARKETPLACES) {
      await upsertMarketplaceListingPriceSku(auditId, marketplace, { priceCents, sku }, existing.workspaceId);
    }
  }
}

const SYNC_MARKETPLACES = ["Shopify", "WooCommerce", "Amazon"] as const;
type SyncMarketplace = (typeof SYNC_MARKETPLACES)[number];

async function upsertMarketplaceListingPriceSku(
  auditId: number,
  marketplace: SyncMarketplace,
  patch: { priceCents?: number | null; sku?: string | null | undefined },
  workspaceId?: number | null,
): Promise<void> {
  const listingPatch: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.priceCents != null && patch.priceCents > 0) {
    listingPatch.priceCents = patch.priceCents;
  }
  if (patch.sku !== undefined) {
    listingPatch.sku = patch.sku;
  }
  if (Object.keys(listingPatch).length <= 1) return;

  const listingUpdate = await db
    .update(productMarketplaceListingsTable)
    .set(listingPatch)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.marketplace, marketplace),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length > 0) return;
  if (!workspaceId) return;

  await db.insert(productMarketplaceListingsTable).values({
    auditId,
    workspaceId,
    marketplace,
    status: "pending",
    sku: patch.sku ?? null,
    priceCents: patch.priceCents != null && patch.priceCents > 0 ? patch.priceCents : null,
    currency: "USD",
  });
}
