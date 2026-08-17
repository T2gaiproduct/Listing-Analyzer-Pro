import { and, eq } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import { isRealAmazonAsin } from "./amazon-asin-utils.js";
import { resolveAmazonMarketplace, amazonMarketplaceCurrency } from "./amazon-marketplaces.js";
import { fetchMerchantListingsAllDataReport, type MerchantListingsReportRow } from "./amazon-sp-api.js";
import { resolveMarketplaceCodeFromSpId } from "./amazon-sp-settings.js";
import type { ResolvedAmazonConnection } from "./resolve-amazon-settings.js";
import { TARGET_MARKETPLACES } from "./create-product.js";
import type { ShopifySyncResult } from "./shopify-product-sync.js";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const MAX_IMPORT = 500;

function amazonProductUrl(marketplaceCode: string, asin: string): string {
  const marketplace = resolveAmazonMarketplace(marketplaceCode);
  return `https://www.${marketplace.domain}/dp/${asin}`;
}

function resolveAmazonListingStatus(status: string | null | undefined): {
  listingStatus: "live" | "pending" | "not_listed";
  auditStatus: "complete" | "draft";
  published: boolean;
} {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (normalized === "active") {
    return { listingStatus: "live", auditStatus: "complete", published: true };
  }
  if (normalized === "inactive" || normalized === "incomplete") {
    return { listingStatus: "pending", auditStatus: "draft", published: false };
  }
  return { listingStatus: "not_listed", auditStatus: "draft", published: false };
}

async function loadExistingAmazonAudits(workspaceId: number): Promise<{
  byAsin: Map<string, number>;
  bySku: Map<string, number>;
}> {
  const rows = await db
    .select({
      id: auditsTable.id,
      asin: auditsTable.asin,
      sku: productProfilesTable.sku,
    })
    .from(auditsTable)
    .leftJoin(productProfilesTable, eq(productProfilesTable.auditId, auditsTable.id))
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
    ));

  const byAsin = new Map<string, number>();
  const bySku = new Map<string, number>();

  for (const row of rows) {
    if (row.asin && isRealAmazonAsin(row.asin)) {
      byAsin.set(row.asin.trim().toUpperCase(), row.id);
    }
    if (row.sku?.trim()) {
      bySku.set(row.sku.trim(), row.id);
    }
  }

  return { byAsin, bySku };
}

async function refreshAmazonProductFromCatalog(input: {
  auditId: number;
  row: MerchantListingsReportRow;
  marketplaceCode: string;
  currency: string;
}): Promise<void> {
  const { row, marketplaceCode, currency } = input;
  const title = row.title.trim();
  if (!title) return;

  const listing = resolveAmazonListingStatus(row.status);
  const sku = row.sku.trim();
  const asin = row.asin?.trim().toUpperCase() ?? null;
  const productUrl = asin ? amazonProductUrl(marketplaceCode, asin) : null;
  const imageUrls = row.imageUrl?.trim() ? [row.imageUrl.trim()] : [];

  await db
    .update(auditsTable)
    .set({
      productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      asin: asin ?? undefined,
      title,
      imageUrls,
      status: listing.auditStatus,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, input.auditId));

  await db
    .update(productProfilesTable)
    .set({
      sku,
      referenceLinks: productUrl ?? undefined,
    })
    .where(eq(productProfilesTable.auditId, input.auditId));

  await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listing.listingStatus,
      sku,
      priceCents: row.priceCents,
      currency,
      inventory: row.quantity,
      listingUrl: productUrl,
      publishedAt: listing.published ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.auditId),
      eq(productMarketplaceListingsTable.marketplace, "Amazon"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));
}

function resolvePrimaryMarketplaceCode(connection: ResolvedAmazonConnection): string {
  const sellerDefault = connection.settings.defaultMarketplace?.trim().toUpperCase();
  if (sellerDefault) return sellerDefault;

  const firstSpId = connection.marketplaceIds?.[0]?.trim();
  if (firstSpId) return resolveMarketplaceCodeFromSpId(firstSpId);

  return "US";
}

export async function syncAmazonProducts(input: {
  connection: ResolvedAmazonConnection;
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
  marketplaceCode?: string;
}): Promise<ShopifySyncResult> {
  const marketplaceCode = input.marketplaceCode?.trim().toUpperCase()
    || resolvePrimaryMarketplaceCode(input.connection);
  const currency = amazonMarketplaceCurrency(marketplaceCode);

  const catalog = await fetchMerchantListingsAllDataReport({
    settings: input.connection.settings,
    refreshToken: input.connection.refreshToken,
    marketplaceCode,
  });

  if (catalog.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      total: 0,
      auditsQueued: 0,
      pendingAuditIds: [],
      products: [],
      errors: [],
    };
  }

  const limitedCatalog = catalog.slice(0, MAX_IMPORT);
  const existing = await loadExistingAmazonAudits(input.workspaceId);

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

  for (const row of limitedCatalog) {
    const sku = row.sku.trim();
    const title = row.title.trim();
    const asin = row.asin?.trim().toUpperCase() ?? null;

    if (!sku && !title) {
      result.errors.push({ handle: "unknown", error: "Missing SKU and title" });
      continue;
    }

    const existingId = asin && existing.byAsin.has(asin)
      ? existing.byAsin.get(asin)!
      : existing.bySku.get(sku);

    if (existingId != null) {
      try {
        await refreshAmazonProductFromCatalog({
          auditId: existingId,
          row,
          marketplaceCode,
          currency,
        });
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
      const listing = resolveAmazonListingStatus(row.status);
      const productUrl = asin ? amazonProductUrl(marketplaceCode, asin) : null;
      const imageUrls = row.imageUrl?.trim() ? [row.imageUrl.trim()] : [];
      const displayTitle = title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60);

      const [audit] = await db
        .insert(auditsTable)
        .values({
          userId: input.ownerId,
          createdByUserId: input.createdByUserId,
          workspaceId: input.workspaceId,
          projectName: displayTitle,
          productName: displayTitle,
          asin: asin ?? null,
          brandName: null,
          category: null,
          title,
          bulletPoints: [],
          imageUrls,
          targetKeywords: [],
          overallScore: 0,
          status: listing.auditStatus,
          currentStep: 1,
        })
        .returning();

      await db.insert(productProfilesTable).values({
        auditId: audit.id,
        sku,
        priority: "medium",
        referenceLinks: productUrl ?? undefined,
        workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
        targetMarketplaces: ["Amazon"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "Amazon" ? listing.listingStatus : "not_listed",
          sku: marketplace === "Amazon" ? sku : null,
          priceCents: marketplace === "Amazon" ? row.priceCents : null,
          currency,
          listingUrl: marketplace === "Amazon" ? productUrl : null,
          publishedAt: marketplace === "Amazon" && listing.published ? new Date() : null,
          inventory: marketplace === "Amazon" ? row.quantity : null,
        })),
      );

      if (asin) existing.byAsin.set(asin, audit.id);
      existing.bySku.set(sku, audit.id);

      result.imported += 1;
      result.pendingAuditIds.push(audit.id);
      result.products.push({
        id: audit.id,
        name: audit.projectName ?? audit.productName,
        sku,
        handle: asin ?? sku,
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

  if (catalog.length > MAX_IMPORT) {
    result.errors.push({
      handle: "catalog",
      error: `Imported first ${MAX_IMPORT} of ${catalog.length} listings. Run import again after reviewing, or contact support for higher limits.`,
    });
  }

  return result;
}
