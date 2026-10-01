/** eBay Trading API: most categories cap each Item Specific value at 65 characters. */
export const EBAY_ITEM_SPECIFIC_MAX_VALUE_LENGTH = 65;
export const EBAY_TITLE_MAX_LENGTH = 80;

export function truncateEbayListingTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= EBAY_TITLE_MAX_LENGTH) return trimmed;
  const slice = trimmed.slice(0, EBAY_TITLE_MAX_LENGTH);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 50) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function truncateEbayItemSpecificValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= EBAY_ITEM_SPECIFIC_MAX_VALUE_LENGTH) return trimmed;
  const slice = trimmed.slice(0, EBAY_ITEM_SPECIFIC_MAX_VALUE_LENGTH);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 40) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

export function sanitizeEbayItemSpecificValues(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = truncateEbayItemSpecificValue(raw);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}
