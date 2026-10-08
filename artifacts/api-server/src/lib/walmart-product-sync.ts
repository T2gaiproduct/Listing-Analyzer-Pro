import { and, eq, inArray } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
  type GeneratedContent,
} from "@workspace/db";
import { TARGET_MARKETPLACES } from "./create-product.js";
import { clampImportLimit } from "./marketplace-catalog-types.js";
import type { ShopifySyncResult } from "./shopify-product-sync.js";
import { walmartAsin, walmartListingUrl, walmartSkuFromAsin } from "./walmart-import-utils.js";
import {
  fetchWalmartItemBySku,
  fetchWalmartItemsPage,
  resolveWalmartAccessToken,
  type WalmartCatalogItem,
} from "./walmart-items-client.js";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const MAX_IMPORT = 500;

function resolveTitle(item: WalmartCatalogItem): string {
  return item.productName?.trim() || item.sku.trim();
}

function buildGeneratedContent(descriptionHtml: string | null): GeneratedContent | null {
  if (!descriptionHtml?.trim()) return null;
  return { title: "", bulletPoints: [], keywords: [], htmlDescription: descriptionHtml };
}

function priceCents(item: WalmartCatalogItem): number | null {
  if (item.priceAmount == null || !Number.isFinite(item.priceAmount)) return null;
  return Math.round(item.priceAmount * 100);
}

function listingStatus(item: WalmartCatalogItem): "live" | "pending" {
  const status = (item.publishedStatus ?? "").toUpperCase();
  return status === "PUBLISHED" || status === "ACTIVE" ? "live" : "pending";
}

async function loadExistingWalmartAudits(
  workspaceId: number,
  skus: string[],
): Promise<Map<string, number>> {
  if (skus.length === 0) return new Map();
  const asins = skus.map(walmartAsin);
  const rows = await db
    .select({ id: auditsTable.id, asin: auditsTable.asin })
    .from(auditsTable)
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
      inArray(auditsTable.asin, asins),
    ));

  const map = new Map<string, number>();
  for (const row of rows) {
    const sku = walmartSkuFromAsin(row.asin);
    if (sku) map.set(sku, row.id);
  }
  return map;
}

async function refreshWalmartProduct(input: {
  auditId: number;
  item: WalmartCatalogItem;
}): Promise<void> {
  const title = resolveTitle(input.item);
  const sku = input.item.sku.trim();
  const imageUrls = input.item.imageUrls.slice(0, 9);
  const storeDescriptionHtml = input.item.descriptionHtml;
  const [existing] = await db
    .select({
      generatedContent: auditsTable.generatedContent,
      sourceListingContent: auditsTable.sourceListingContent,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, input.auditId))
    .limit(1);
  const generatedContent = existing?.sourceListingContent
    ? (existing.generatedContent as GeneratedContent | null | undefined) ?? null
    : buildGeneratedContent(storeDescriptionHtml);

  await db
    .update(auditsTable)
    .set({
      projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      title,
      imageUrls,
      storeDescriptionHtml,
      ...(generatedContent ? { generatedContent } : {}),
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, input.auditId));

  await db
    .update(productProfilesTable)
    .set({ sku })
    .where(eq(productProfilesTable.auditId, input.auditId));

  const status = listingStatus(input.item);
  await db
    .update(productMarketplaceListingsTable)
    .set({
      status,
      sku,
      priceCents: priceCents(input.item),
      currency: input.item.currency ?? "USD",
      listingUrl: walmartListingUrl(input.item.wpid),
      publishedAt: status === "live" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.auditId),
      eq(productMarketplaceListingsTable.marketplace, "Walmart"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));
}

export async function syncWalmartProducts(input: {
  workspaceId: number;
  ownerId: string;
  createdByUserId: string | null;
  productIds?: string[];
  limit?: number;
  search?: string;
}): Promise<ShopifySyncResult> {
  const importLimit = clampImportLimit(input.limit ?? MAX_IMPORT);
  const { connection, accessToken } = await resolveWalmartAccessToken(input.workspaceId);

  const catalog: WalmartCatalogItem[] = [];

  if (input.productIds?.length) {
    for (const id of input.productIds) {
      const sku = id.trim();
      if (!sku) continue;
      const item = await fetchWalmartItemBySku({ connection, accessToken, sku })
        ?? (await fetchWalmartItemsPage({ connection, accessToken, limit: 1, sku })).items[0]
        ?? null;
      if (item) catalog.push(item);
    }
  } else {
    let nextCursor: string | null = null;
    while (catalog.length < importLimit) {
      const batch = await fetchWalmartItemsPage({
        connection,
        accessToken,
        limit: 50,
        nextCursor,
      });
      if (batch.items.length === 0) break;

      for (const item of batch.items) {
        if (input.search?.trim()) {
          const haystack = [item.sku, item.productName, item.upc, item.wpid]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(input.search.trim().toLowerCase())) continue;
        }
        catalog.push(item);
        if (catalog.length >= importLimit) break;
      }

      if (!batch.hasMore || !batch.nextCursor) break;
      nextCursor = batch.nextCursor;
      if (catalog.length > 5_000) break;
    }
    catalog.splice(importLimit);
  }

  const result: ShopifySyncResult = {
    imported: 0,
    skipped: 0,
    updated: 0,
    total: catalog.length,
    auditsQueued: 0,
    pendingAuditIds: [],
    products: [],
    errors: [],
  };

  const existingAudits = catalog.length > 0
    ? await loadExistingWalmartAudits(
      input.workspaceId,
      catalog.map((item) => item.sku.trim()),
    )
    : new Map<string, number>();

  for (const item of catalog) {
    const sku = item.sku?.trim();
    const title = resolveTitle(item);
    if (!sku || !title) {
      result.errors.push({ handle: sku || "unknown", error: "Missing SKU or title" });
      continue;
    }

    if (existingAudits.has(sku)) {
      const auditId = existingAudits.get(sku)!;
      try {
        await refreshWalmartProduct({ auditId, item });
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          handle: sku,
          error: err instanceof Error ? err.message : "Refresh failed",
        });
      }
      result.skipped += 1;
      continue;
    }

    try {
      const imageUrls = item.imageUrls.slice(0, 9);
      const storeDescriptionHtml = item.descriptionHtml;
      const generatedContent = buildGeneratedContent(storeDescriptionHtml);
      const status = listingStatus(item);

      const [audit] = await db
        .insert(auditsTable)
        .values({
          userId: input.ownerId,
          createdByUserId: input.createdByUserId,
          workspaceId: input.workspaceId,
          projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          asin: walmartAsin(sku),
          brandName: null,
          category: null,
          title,
          bulletPoints: [],
          imageUrls,
          targetKeywords: [],
          storeDescriptionHtml,
          generatedContent,
          overallScore: 0,
          status: "pending",
          currentStep: 1,
        })
        .returning();

      await db.insert(productProfilesTable).values({
        auditId: audit.id,
        sku,
        priority: "medium",
        workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
        targetMarketplaces: ["Walmart"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "Walmart" ? status : "not_listed",
          sku: marketplace === "Walmart" ? sku : null,
          priceCents: marketplace === "Walmart" ? priceCents(item) : null,
          currency: item.currency ?? "USD",
          listingUrl: marketplace === "Walmart" ? walmartListingUrl(item.wpid) : null,
          publishedAt: marketplace === "Walmart" && status === "live" ? new Date() : null,
          inventory: null,
        })),
      );

      existingAudits.set(sku, audit.id);
      result.imported += 1;
      result.pendingAuditIds.push(audit.id);
      result.products.push({
        id: audit.id,
        name: audit.projectName ?? audit.productName,
        sku,
        handle: sku,
        detailUrl: `/products/${audit.id}`,
        workflowUrl: `/audits/workflow?resume=${audit.id}`,
      });
    } catch (err) {
      result.errors.push({
        handle: sku,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  result.auditsQueued = result.pendingAuditIds.length;
  return result;
}
