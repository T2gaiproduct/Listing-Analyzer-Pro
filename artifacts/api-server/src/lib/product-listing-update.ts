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

  const shouldSyncGeneratedContent = typeof body.listingTitle === "string"
    || Array.isArray(body.bulletPoints)
    || Array.isArray(body.targetKeywords)
    || typeof body.descriptionHtml === "string";
  if (shouldSyncGeneratedContent) {
    const htmlDescription = typeof body.descriptionHtml === "string" && body.descriptionHtml.trim()
      ? body.descriptionHtml.trim()
      : bulletsToHtmlDescription(nextBullets);
    const currentGenerated = (existing.generatedContent ?? null) as GeneratedContent | null;
    const title = typeof body.listingTitle === "string"
      ? body.listingTitle.trim()
      : existing.title?.trim()
        || currentGenerated?.title?.trim()
        || "";
    auditUpdates.generatedContent = {
      title: title || currentGenerated?.title || "",
      bulletPoints: nextBullets,
      keywords: nextKeywords,
      htmlDescription,
    } satisfies GeneratedContent;
  }

  if (Object.keys(auditUpdates).length > 1) {
    await db.update(auditsTable).set(auditUpdates).where(eq(auditsTable.id, auditId));
  }

  if (body.price !== undefined || typeof body.sku === "string") {
    const priceCents = body.price !== undefined ? parsePriceCents(body.price) : undefined;
    const sku = typeof body.sku === "string" ? body.sku.trim() || null : undefined;
    const listingPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (priceCents != null && priceCents > 0) listingPatch.priceCents = priceCents;
    if (sku !== undefined) listingPatch.sku = sku;

    const listingUpdate = await db
      .update(productMarketplaceListingsTable)
      .set(listingPatch)
      .where(and(
        eq(productMarketplaceListingsTable.auditId, auditId),
        eq(productMarketplaceListingsTable.marketplace, "Shopify"),
        eq(productMarketplaceListingsTable.isDeleted, 0),
      ))
      .returning({ id: productMarketplaceListingsTable.id });

    if (listingUpdate.length === 0) {
      const [auditRow] = await db
        .select({ workspaceId: auditsTable.workspaceId })
        .from(auditsTable)
        .where(eq(auditsTable.id, auditId))
        .limit(1);
      if (!auditRow?.workspaceId) {
        throw new Error("Could not save Shopify listing — workspace not found");
      }
      await db.insert(productMarketplaceListingsTable).values({
        auditId,
        workspaceId: auditRow.workspaceId,
        marketplace: "Shopify",
        status: "pending",
        priceCents: priceCents != null && priceCents > 0 ? priceCents : null,
        sku: sku ?? null,
        currency: "USD",
      });
    }
  }
}
