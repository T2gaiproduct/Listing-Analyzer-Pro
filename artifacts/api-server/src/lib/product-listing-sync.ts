import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { getAuth } from "@clerk/express";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable } from "@workspace/db";
import { loadAuditForExport } from "./audit-export-loader.js";
import { publishListingToAmazonMarketplace } from "./amazon-publish.js";
import { resolveAmazonConnectionForWorkspace } from "./resolve-amazon-settings.js";
import { isAmazonPublishReady } from "./amazon-sp-settings.js";
import {
  getShopifyConnection,
  getWooCommerceConnection,
  isShopifyPublishReady,
  isWooCommercePublishReady,
} from "./marketplace-connections.js";
import { publishListingToShopify } from "./shopify-publish.js";
import { publishListingToWooCommerce } from "./woocommerce-publish.js";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";
import {
  resolveMarketplacePublishBaseUrl,
  resolvePublicBaseUrl,
} from "./resolve-public-base-url.js";
import { getActiveWorkspaceId } from "./workspace-route-helpers.js";

export type MarketplaceSyncPlatformResult = {
  ok: boolean;
  listingUrl?: string | null;
  warning?: string;
  error?: string;
};

export type MarketplaceSyncResult = {
  shopify?: MarketplaceSyncPlatformResult;
  woocommerce?: MarketplaceSyncPlatformResult;
  amazon?: MarketplaceSyncPlatformResult;
  synced: boolean;
};

interface AuthedRequest extends Request {
  userId: string;
}

function resolveUserId(req: Request): string {
  const auth = getAuth(req);
  return auth?.userId ?? (req as AuthedRequest).userId;
}

function isRealAmazonAsin(asin: string | null | undefined): boolean {
  const trimmed = asin?.trim();
  if (!trimmed) return false;
  return !isShopifyImportAsin(trimmed) && !isWooCommerceImportAsin(trimmed);
}

function hasActiveListing(
  rows: Array<{ marketplace: string; status: string }>,
  marketplace: string,
): boolean {
  return rows.some((row) => (
    row.marketplace === marketplace
    && row.status !== "not_listed"
  ));
}

async function loadMarketplaceListingRows(auditId: number) {
  return db
    .select({
      marketplace: productMarketplaceListingsTable.marketplace,
      status: productMarketplaceListingsTable.status,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, auditId),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));
}

function resolveSyncTargets(audit: Audit, listingRows: Array<{ marketplace: string; status: string }>) {
  return {
    shopify: isShopifyImportAsin(audit.asin) || hasActiveListing(listingRows, "Shopify"),
    woocommerce: isWooCommerceImportAsin(audit.asin) || hasActiveListing(listingRows, "WooCommerce"),
    amazon: isRealAmazonAsin(audit.asin) || hasActiveListing(listingRows, "Amazon"),
  };
}

function hasListingFieldChanges(body: Record<string, unknown>): boolean {
  return (
    body.listingTitle !== undefined
    || body.bulletPoints !== undefined
    || body.targetKeywords !== undefined
    || body.descriptionHtml !== undefined
    || body.price !== undefined
    || body.sku !== undefined
    || body.productName !== undefined
    || body.brandName !== undefined
    || body.category !== undefined
  );
}

export async function syncListingToConnectedMarketplaces(opts: {
  req: Request;
  auditId: number;
  body?: Record<string, unknown>;
}): Promise<MarketplaceSyncResult> {
  if (opts.body && !hasListingFieldChanges(opts.body)) {
    return { synced: false };
  }

  const loaded = await loadAuditForExport(opts.req, opts.auditId);
  if (!loaded) {
    return { synced: false };
  }

  const { audit, graphicsProject } = loaded;
  const listingRows = await loadMarketplaceListingRows(opts.auditId);
  const targets = resolveSyncTargets(audit, listingRows);
  if (!targets.shopify && !targets.woocommerce && !targets.amazon) {
    return { synced: false };
  }

  const workspaceId = getActiveWorkspaceId(opts.req) ?? audit.workspaceId;
  const userId = resolveUserId(opts.req);
  const graphicsImageRecords = (graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
  const graphicsProjectId = graphicsProject?.id ?? null;

  const result: MarketplaceSyncResult = { synced: false };

  if (targets.shopify) {
    const connection = await getShopifyConnection(workspaceId);
    if (!connection || !isShopifyPublishReady(connection)) {
      result.shopify = {
        ok: false,
        error: "Connect Shopify credentials on Marketplaces to sync listing changes.",
      };
    } else {
      try {
        const publishResult = await publishListingToShopify({
          connection,
          audit,
          graphicsImageRecords,
          publicBaseUrl: resolvePublicBaseUrl(opts.req),
          publishMode: "live",
        });
        result.shopify = {
          ok: true,
          listingUrl: publishResult.listingUrl,
          warning: publishResult.warning,
        };
        result.synced = true;
      } catch (err) {
        result.shopify = {
          ok: false,
          error: err instanceof Error ? err.message : "Shopify sync failed",
        };
      }
    }
  }

  if (targets.woocommerce) {
    const connection = await getWooCommerceConnection(workspaceId);
    if (!connection || !isWooCommercePublishReady(connection)) {
      result.woocommerce = {
        ok: false,
        error: "Connect WooCommerce credentials on Marketplaces to sync listing changes.",
      };
    } else {
      try {
        const publicBaseUrl = resolveMarketplacePublishBaseUrl(opts.req);
        const publishResult = await publishListingToWooCommerce({
          connection,
          audit,
          graphicsImageRecords,
          graphicsProjectId,
          publicBaseUrl,
          publishMode: "live",
        });
        result.woocommerce = {
          ok: true,
          listingUrl: publishResult.listingUrl,
          warning: publishResult.warning,
        };
        result.synced = true;
      } catch (err) {
        result.woocommerce = {
          ok: false,
          error: err instanceof Error ? err.message : "WooCommerce sync failed",
        };
      }
    }
  }

  if (targets.amazon) {
    const resolved = await resolveAmazonConnectionForWorkspace({ workspaceId, userId });
    if (!resolved || !isAmazonPublishReady(resolved.settings)) {
      result.amazon = {
        ok: false,
        error: "Connect Amazon credentials on Marketplaces to sync listing changes.",
      };
    } else {
      try {
        const publicBaseUrl = resolveMarketplacePublishBaseUrl(opts.req);
        const publishResult = await publishListingToAmazonMarketplace({
          settings: resolved.settings,
          refreshToken: resolved.refreshToken,
          sellerId: resolved.sellerId,
          audit,
          marketplaceCode: resolved.settings.defaultMarketplace,
          graphicsImageRecords,
          graphicsProjectId,
          publicBaseUrl,
        });
        result.amazon = {
          ok: true,
          listingUrl: publishResult.listingUrl,
          warning: publishResult.warning,
        };
        result.synced = true;
      } catch (err) {
        result.amazon = {
          ok: false,
          error: err instanceof Error ? err.message : "Amazon sync failed",
        };
      }
    }
  }

  return result;
}
