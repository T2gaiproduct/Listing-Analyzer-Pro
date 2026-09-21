import { inArray } from "drizzle-orm";
import { db, productProfilesTable } from "@workspace/db";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export type AuditProductSourceType = "listing" | "audit";

export function isStorePlatformAsin(asin: string | null | undefined): boolean {
  return isShopifyImportAsin(asin) || isWooCommerceImportAsin(asin);
}

/** Catalog sync from Shopify/Woo admin (has product_profiles), not Audit Listing fetch of a store URL. */
export function isSyncedStoreImport(opts: {
  asin: string | null | undefined;
  hasProductProfile: boolean;
}): { isShopifyImport: boolean; isWooCommerceImport: boolean } {
  if (!opts.hasProductProfile) {
    return { isShopifyImport: false, isWooCommerceImport: false };
  }
  return {
    isShopifyImport: isShopifyImportAsin(opts.asin),
    isWooCommerceImport: isWooCommerceImportAsin(opts.asin),
  };
}

/** True for Amazon ASIN audits and store-URL audits created via Audit Listing (no sync profile). */
export function isAuditListingProduct(opts: {
  asin: string | null | undefined;
  hasProductProfile: boolean;
}): boolean {
  const trimmed = opts.asin?.trim();
  if (!trimmed) return false;
  if (!isStorePlatformAsin(trimmed)) return true;
  return !opts.hasProductProfile;
}

export function classifyAuditProductSource(opts: {
  asin: string | null | undefined;
  hasProductProfile: boolean;
}): {
  sourceType: AuditProductSourceType;
  isShopifyImport: boolean;
  isWooCommerceImport: boolean;
  isAuditListing: boolean;
} {
  const store = isSyncedStoreImport(opts);
  const isAuditListing = isAuditListingProduct(opts);
  const sourceType: AuditProductSourceType = isAuditListing ? "audit" : "listing";
  return {
    sourceType,
    isShopifyImport: store.isShopifyImport,
    isWooCommerceImport: store.isWooCommerceImport,
    isAuditListing,
  };
}

export async function loadAuditIdsWithProductProfiles(auditIds: number[]): Promise<Set<number>> {
  const unique = [...new Set(auditIds.filter((id) => id > 0))];
  if (unique.length === 0) return new Set();
  const rows = await db
    .select({ auditId: productProfilesTable.auditId })
    .from(productProfilesTable)
    .where(inArray(productProfilesTable.auditId, unique));
  return new Set(rows.map((row) => row.auditId));
}
