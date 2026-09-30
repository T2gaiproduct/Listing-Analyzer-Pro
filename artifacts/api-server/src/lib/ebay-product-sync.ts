import { and, eq, inArray } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
  type GeneratedContent,
} from "@workspace/db";
import { TARGET_MARKETPLACES } from "./create-product.js";
import { ebayAsin, ebaySkuFromAsin } from "./ebay-import-utils.js";
import {
  fetchEbayInventoryItemBySku,
  fetchEbayInventoryItemsPage,
  resolveEbayAccessToken,
  type EbayInventoryItem,
} from "./ebay-inventory-client.js";
import { migrateLegacyEbayListingsForWorkspace } from "./ebay-listing-migrate.js";
import { clampImportLimit } from "./marketplace-catalog-types.js";
import type { ShopifySyncResult } from "./shopify-product-sync.js";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const MAX_IMPORT = 500;

function resolveTitle(item: EbayInventoryItem): string {
  return item.product?.title?.trim() || item.sku.trim();
}

function resolveImageUrls(item: EbayInventoryItem): string[] {
  return (item.product?.imageUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
    .slice(0, 9);
}

function resolveDescriptionHtml(item: EbayInventoryItem): string | null {
  const raw = item.product?.description?.trim();
  return raw || null;
}

function buildGeneratedContent(descriptionHtml: string | null): GeneratedContent | null {
  if (!descriptionHtml) return null;
  return { title: "", bulletPoints: [], keywords: [], htmlDescription: descriptionHtml };
}

async function loadExistingEbayAudits(
  workspaceId: number,
  skus: string[],
): Promise<Map<string, number>> {
  if (skus.length === 0) return new Map();
  const asins = skus.map(ebayAsin);
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
    const sku = ebaySkuFromAsin(row.asin);
    if (sku) map.set(sku, row.id);
  }
  return map;
}

async function refreshEbayProduct(input: {
  auditId: number;
  item: EbayInventoryItem;
}): Promise<void> {
  const title = resolveTitle(input.item);
  const sku = input.item.sku.trim();
  const imageUrls = resolveImageUrls(input.item);
  const storeDescriptionHtml = resolveDescriptionHtml(input.item);
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
      bulletPoints: [],
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

  await db
    .update(productMarketplaceListingsTable)
    .set({
      status: "live",
      sku,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.auditId),
      eq(productMarketplaceListingsTable.marketplace, "eBay"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));
}

export async function syncEbayProducts(input: {
  workspaceId: number;
  ownerId: string;
  createdByUserId: string | null;
  productIds?: string[];
  limit?: number;
  search?: string;
}): Promise<ShopifySyncResult> {
  const importLimit = clampImportLimit(input.limit ?? MAX_IMPORT);
  const migration = await migrateLegacyEbayListingsForWorkspace({
    workspaceId: input.workspaceId,
    maxListings: importLimit,
  });
  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);

  let catalog: EbayInventoryItem[] = [];

  if (input.productIds?.length) {
    for (const id of input.productIds) {
      const sku = id.trim();
      if (!sku) continue;
      const item = await fetchEbayInventoryItemBySku({ environment, accessToken, sku });
      if (item) catalog.push(item);
    }
  } else {
    let offset = 0;
    const pageSize = 100;
    while (catalog.length < importLimit) {
      const batch = await fetchEbayInventoryItemsPage({
        environment,
        accessToken,
        limit: pageSize,
        offset,
      });
      if (batch.items.length === 0) break;

      for (const item of batch.items) {
        if (input.search?.trim()) {
          const haystack = [
            item.sku,
            item.product?.title,
            item.product?.description,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(input.search.trim().toLowerCase())) continue;
        }
        catalog.push(item);
        if (catalog.length >= importLimit) break;
      }

      if (!batch.hasMore) break;
      offset += batch.items.length;
      if (offset > 5_000) break;
    }
    catalog = catalog.slice(0, importLimit);
  }

  if (catalog.length === 0) {
    const errors = migration.errors.map((message) => ({ handle: "ebay-migrate", error: message }));
    if (migration.activeListingsFound > 0 && migration.migrated === 0 && errors.length === 0) {
      errors.push({
        handle: "ebay-migrate",
        error: "Active eBay listings were found but could not be converted to inventory items. Check eBay listing eligibility for migration.",
      });
    }
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      total: 0,
      auditsQueued: 0,
      pendingAuditIds: [],
      products: [],
      errors,
    };
  }

  const existingAudits = await loadExistingEbayAudits(
    input.workspaceId,
    catalog.map((item) => item.sku.trim()),
  );

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
        await refreshEbayProduct({ auditId, item });
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
      const imageUrls = resolveImageUrls(item);
      const storeDescriptionHtml = resolveDescriptionHtml(item);
      const generatedContent = buildGeneratedContent(storeDescriptionHtml);

      const [audit] = await db
        .insert(auditsTable)
        .values({
          userId: input.ownerId,
          createdByUserId: input.createdByUserId,
          workspaceId: input.workspaceId,
          projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          asin: ebayAsin(sku),
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
        targetMarketplaces: ["eBay"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "eBay" ? "live" : "not_listed",
          sku: marketplace === "eBay" ? sku : null,
          priceCents: null,
          currency: "USD",
          listingUrl: null,
          publishedAt: marketplace === "eBay" ? new Date() : null,
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
