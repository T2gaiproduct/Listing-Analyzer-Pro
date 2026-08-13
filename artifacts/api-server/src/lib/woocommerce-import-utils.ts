export const WOOCOMMERCE_IMPORT_ASIN_PREFIX = "woocommerce:";

export function isWooCommerceImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith(WOOCOMMERCE_IMPORT_ASIN_PREFIX);
}

export function woocommerceSlugFromAsin(asin: string | null | undefined): string | null {
  if (!isWooCommerceImportAsin(asin)) return null;
  const slug = asin!.slice(WOOCOMMERCE_IMPORT_ASIN_PREFIX.length).trim();
  return slug || null;
}

export function woocommerceAsin(slug: string): string {
  return `${WOOCOMMERCE_IMPORT_ASIN_PREFIX}${slug}`;
}

/** Drop keywords that look like description text split into single words (legacy import bug). */
export function filterTokenizedWooCommerceKeywords(
  keywords: string[],
  descriptionHtml: string,
): string[] {
  if (keywords.length < 6) return keywords;
  const haystack = descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!haystack) return keywords;
  const matched = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  return matched.length / keywords.length >= 0.7 ? [] : keywords;
}
