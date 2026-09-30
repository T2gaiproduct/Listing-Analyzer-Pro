export const EBAY_IMPORT_ASIN_PREFIX = "ebay:";

export function isEbayImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith(EBAY_IMPORT_ASIN_PREFIX);
}

export function ebaySkuFromAsin(asin: string | null | undefined): string | null {
  if (!isEbayImportAsin(asin)) return null;
  const encoded = asin!.slice(EBAY_IMPORT_ASIN_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function ebayAsin(sku: string): string {
  return `${EBAY_IMPORT_ASIN_PREFIX}${encodeURIComponent(sku.trim())}`;
}
