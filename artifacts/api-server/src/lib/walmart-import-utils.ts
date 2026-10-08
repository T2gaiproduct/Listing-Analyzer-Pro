export const WALMART_IMPORT_ASIN_PREFIX = "walmart:";

export function isWalmartImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith(WALMART_IMPORT_ASIN_PREFIX);
}

export function walmartSkuFromAsin(asin: string | null | undefined): string | null {
  if (!isWalmartImportAsin(asin)) return null;
  const encoded = asin!.slice(WALMART_IMPORT_ASIN_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function walmartAsin(sku: string): string {
  return `${WALMART_IMPORT_ASIN_PREFIX}${encodeURIComponent(sku.trim())}`;
}

export function walmartListingUrl(wpid: string | null | undefined): string | null {
  const id = wpid?.trim();
  if (!id) return null;
  return `https://www.walmart.com/ip/${encodeURIComponent(id)}`;
}
