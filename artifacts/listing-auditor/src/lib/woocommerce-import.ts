export const WOOCOMMERCE_IMPORT_ASIN_PREFIX = "woocommerce:";

export function isWooCommerceImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith(WOOCOMMERCE_IMPORT_ASIN_PREFIX);
}

export function woocommerceSlugFromAsin(asin: string | null | undefined): string | null {
  if (!isWooCommerceImportAsin(asin)) return null;
  const slug = asin!.slice(WOOCOMMERCE_IMPORT_ASIN_PREFIX.length).trim();
  return slug || null;
}

export function isMarketplaceImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && (
    asin.startsWith("shopify:") || asin.startsWith(WOOCOMMERCE_IMPORT_ASIN_PREFIX)
  );
}
