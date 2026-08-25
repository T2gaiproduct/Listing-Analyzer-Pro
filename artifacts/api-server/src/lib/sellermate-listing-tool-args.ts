const AMAZON_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?amazon\.[a-z.]+\/(?:[^\s]*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[^\s]*)?/i;

const AMAZON_ASIN_RE = /\b([A-Z0-9]{10})\b/i;

/** Pull ASIN or Amazon product URL from chat text for get_amazon_listing tool calls. */
export function extractAmazonListingToolArgs(text: string): { asin?: string; url?: string } {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const urlMatch = trimmed.match(AMAZON_URL_RE);
  if (urlMatch?.[0]) {
    const raw = urlMatch[0].replace(/[),.;!?]+$/, "");
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return { url };
  }

  const asinMatch = trimmed.match(AMAZON_ASIN_RE);
  if (asinMatch?.[1]) {
    return { asin: asinMatch[1].toUpperCase() };
  }

  return {};
}
