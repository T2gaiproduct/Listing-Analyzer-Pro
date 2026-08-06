export const SHOPIFY_IMPORT_ASIN_PREFIX = "shopify:";

export function isShopifyImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith(SHOPIFY_IMPORT_ASIN_PREFIX);
}

export function shopifyHandleFromAsin(asin: string | null | undefined): string | null {
  if (!isShopifyImportAsin(asin)) return null;
  const handle = asin!.slice(SHOPIFY_IMPORT_ASIN_PREFIX.length).trim();
  return handle || null;
}

export function isBrokenShopifyAmazonUrl(url: string): boolean {
  return url.includes("amazon.") && url.includes("/dp/shopify:");
}
