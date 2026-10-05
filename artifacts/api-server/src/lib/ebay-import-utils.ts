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

/** Item ID from sandbox/production listing URL (`.../itm/123` or `.../itm/Title-Slug/123`). */
export function parseEbayItemIdFromListingUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const slugThenId = trimmed.match(/\/itm\/(?:[^/?#]+\/)*(\d{6,})(?:[/?#]|$)/i);
  if (slugThenId?.[1]) return slugThenId[1];
  const direct = trimmed.match(/\/itm\/(\d{6,})(?:[/?#]|$)/i);
  return direct?.[1] ?? null;
}

/** Item ID from SellerLens auto-SKU `SL-{itemId}` or a numeric id. */
export function parseEbayItemIdFromSku(sku: string | null | undefined): string | null {
  const trimmed = sku?.trim();
  if (!trimmed) return null;
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("SL-")) {
    const id = trimmed.slice(3).trim();
    return /^\d+$/.test(id) ? id : null;
  }
  return null;
}
