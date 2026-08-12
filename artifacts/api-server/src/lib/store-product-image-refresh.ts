import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { auditsTable } from "@workspace/db/schema";
import { findShopifyAdminCatalogProductByHandle, getShopifyAccessToken, parseShopifyShopHost } from "./shopify-admin-client.js";
import { findWooCommerceProductBySlug } from "./woocommerce-admin-client.js";
import { getShopifyConnection, getWooCommerceConnection } from "./marketplace-connections.js";
import { isShopifyImportAsin, shopifyHandleFromAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin, woocommerceSlugFromAsin } from "./woocommerce-import-utils.js";

function normalizeImageUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result.slice(0, 9);
}

async function persistAuditImageUrls(auditId: number, imageUrls: string[]): Promise<string[]> {
  if (imageUrls.length === 0) return [];
  await db
    .update(auditsTable)
    .set({ imageUrls, updatedAt: new Date() })
    .where(eq(auditsTable.id, auditId));
  return imageUrls;
}

async function refreshWooCommerceImages(input: {
  auditId: number;
  workspaceId: number;
  asin: string;
}): Promise<string[] | null> {
  const slug = woocommerceSlugFromAsin(input.asin);
  if (!slug) return null;

  const connection = await getWooCommerceConnection(input.workspaceId);
  if (!connection?.storeUrl || !connection.consumerKey || !connection.consumerSecret) return null;

  const product = await findWooCommerceProductBySlug({
    storeUrl: connection.storeUrl,
    consumerKey: connection.consumerKey,
    consumerSecret: connection.consumerSecret,
    slug,
  });
  if (!product) return null;

  const imageUrls = normalizeImageUrls((product.images ?? []).map((image) => image.src));
  if (imageUrls.length === 0) return null;

  return persistAuditImageUrls(input.auditId, imageUrls);
}

async function refreshShopifyImages(input: {
  auditId: number;
  workspaceId: number;
  asin: string;
}): Promise<string[] | null> {
  const handle = shopifyHandleFromAsin(input.asin);
  if (!handle) return null;

  const connection = await getShopifyConnection(input.workspaceId);
  if (!connection?.storeUrl || !connection.clientId || !connection.clientSecret) return null;

  const shopHost = parseShopifyShopHost(connection.storeUrl);
  const accessToken = await getShopifyAccessToken({
    shopHost,
    clientId: connection.clientId,
    clientSecret: connection.clientSecret,
  });

  const product = await findShopifyAdminCatalogProductByHandle({
    shopHost,
    accessToken,
    handle,
  });
  if (!product) return null;

  const imageUrls = normalizeImageUrls((product.images ?? []).map((image) => image.src));
  if (imageUrls.length === 0) return null;

  return persistAuditImageUrls(input.auditId, imageUrls);
}

/** Pull store product images into the audit when imageUrls is empty (WooCommerce/Shopify imports). */
export async function maybeRefreshStoreProductImages(input: {
  auditId: number;
  workspaceId: number | null;
  asin: string | null | undefined;
  imageUrls: string[] | null | undefined;
}): Promise<string[] | null> {
  const existing = normalizeImageUrls(input.imageUrls ?? []);
  if (existing.length > 0 || !input.workspaceId || !input.asin?.trim()) return null;

  try {
    if (isWooCommerceImportAsin(input.asin)) {
      return await refreshWooCommerceImages({
        auditId: input.auditId,
        workspaceId: input.workspaceId,
        asin: input.asin,
      });
    }
    if (isShopifyImportAsin(input.asin)) {
      return await refreshShopifyImages({
        auditId: input.auditId,
        workspaceId: input.workspaceId,
        asin: input.asin,
      });
    }
  } catch {
    // Non-fatal: product detail and graphics still load without refreshed images.
  }

  return null;
}
