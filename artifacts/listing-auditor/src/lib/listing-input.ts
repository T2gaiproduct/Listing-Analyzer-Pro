/** Amazon ASIN: 10 alphanumeric characters */
const AMAZON_ASIN_RE = /^[A-Z0-9]{10}$/i;

const HAS_PROTOCOL_RE = /^https?:\/\//i;

/** Hostname with TLD, optional www — e.g. walmart.com, shop.example.co.uk */
const DOMAIN_LIKE_RE = /^(www\.)?[a-z0-9][-a-z0-9]*(\.[a-z0-9][-a-z0-9]*)+([/?#]|$)/i;

export type ListingFetchInput = { asin?: string; url?: string };

/**
 * Normalize user input into either an Amazon ASIN or a product page URL.
 * Accepts full URLs, bare domains (https:// added), and Amazon ASINs.
 */
export function parseListingFetchInput(raw: string): ListingFetchInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a product page URL or Amazon ASIN.");
  }

  if (HAS_PROTOCOL_RE.test(trimmed) || DOMAIN_LIKE_RE.test(trimmed)) {
    const url = HAS_PROTOCOL_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
    return { url };
  }

  const asinCandidate = trimmed.replace(/^(asin:?\s*)/i, "").trim().toUpperCase();
  if (AMAZON_ASIN_RE.test(asinCandidate)) {
    return { asin: asinCandidate };
  }

  // Slugs/paths without a clear domain — still try as URL
  if (trimmed.includes("/")) {
    return { url: `https://${trimmed}` };
  }

  throw new Error(
    "Enter a valid product page URL (Amazon, Shopify, Walmart, eBay, Etsy, etc.) or a 10-character Amazon ASIN.",
  );
}

export function isLikelyProductUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (HAS_PROTOCOL_RE.test(trimmed) || DOMAIN_LIKE_RE.test(trimmed)) return true;
  if (trimmed.includes("/")) return true;
  return false;
}
