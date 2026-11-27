import type { FetchedListing, FetchedListingAttribute } from "./amazon-fetcher";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import {
  ebayOAuthEndpoints,
  getEbayClientCredentials,
} from "./ebay-oauth-config.js";
import { getEbayApplicationToken } from "./ebay-oauth.js";
import { parseEbayItemIdFromListingUrl } from "./ebay-import-utils.js";
import { extractKeywordsFromListing } from "./listing-keyword-suggester.js";
import { parseEbayRestError } from "./ebay-rest-fetch.js";

type EbayBrowseImage = { imageUrl?: string };
type EbayBrowseAspect = { name?: string; value?: string };
type EbayBrowsePrice = { value?: string; currency?: string };

export type EbayBrowseItem = {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  brand?: string;
  categoryPath?: string;
  image?: EbayBrowseImage;
  additionalImages?: EbayBrowseImage[];
  price?: EbayBrowsePrice;
  localizedAspects?: EbayBrowseAspect[];
};

const MARKETPLACE_BY_HOST: Array<{ match: RegExp; id: string }> = [
  { match: /\.co\.uk$/i, id: "EBAY_GB" },
  { match: /\.com\.au$/i, id: "EBAY_AU" },
  { match: /\.ca$/i, id: "EBAY_CA" },
  { match: /\.de$/i, id: "EBAY_DE" },
  { match: /\.fr$/i, id: "EBAY_FR" },
  { match: /\.it$/i, id: "EBAY_IT" },
  { match: /\.es$/i, id: "EBAY_ES" },
  { match: /\.ie$/i, id: "EBAY_IE" },
  { match: /\.nl$/i, id: "EBAY_NL" },
  { match: /\.at$/i, id: "EBAY_AT" },
  { match: /\.ch$/i, id: "EBAY_CH" },
  { match: /\.pl$/i, id: "EBAY_PL" },
  { match: /\.com\.hk$/i, id: "EBAY_HK" },
  { match: /\.com\.sg$/i, id: "EBAY_SG" },
  { match: /\.com\.my$/i, id: "EBAY_MY" },
  { match: /\.co\.jp$/i, id: "EBAY_JP" },
  { match: /\.com\.tw$/i, id: "EBAY_TW" },
  { match: /\.ph$/i, id: "EBAY_PH" },
  { match: /\.com$/i, id: "EBAY_US" },
];

export function ebayEnvironmentFromListingUrl(url: string): EbayOAuthEnvironment {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("sandbox")) return "sandbox";
  } catch {
    // fall through
  }
  return "production";
}

export function marketplaceIdFromEbayUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const row of MARKETPLACE_BY_HOST) {
      if (row.match.test(host)) return row.id;
    }
  } catch {
    // fall through
  }
  return "EBAY_US";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function formatBrowsePrice(price: EbayBrowsePrice | undefined): string | null {
  const value = price?.value?.trim();
  if (!value) return null;
  const currency = price?.currency?.trim().toUpperCase() || "USD";
  if (currency === "USD") return value.startsWith("$") ? value : `$${value}`;
  return `${currency} ${value}`;
}

export function mapEbayBrowseItemToFetchedListing(
  item: EbayBrowseItem,
  pageUrl: string,
  legacyItemId: string,
): FetchedListing {
  const title = item.title?.trim() ?? "";
  if (!title) {
    throw new Error("eBay Browse API returned a listing without a title.");
  }

  const attributes: FetchedListingAttribute[] = [];
  const bulletPoints: string[] = [];
  for (const aspect of item.localizedAspects ?? []) {
    const name = aspect.name?.trim();
    const value = aspect.value?.trim();
    if (!name || !value) continue;
    if (!attributes.some((row) => row.attribute.toLowerCase() === name.toLowerCase())) {
      attributes.push({ attribute: name, value });
    }
    const line = `${name}: ${value}`;
    if (line.length > 8 && line.length < 300) bulletPoints.push(line);
  }

  if (item.brand?.trim() && !attributes.some((row) => row.attribute.toLowerCase() === "brand")) {
    attributes.push({ attribute: "Brand", value: item.brand.trim() });
  }

  const imageUrls: string[] = [];
  const pushImage = (raw?: string) => {
    const url = raw?.trim();
    if (!url || imageUrls.includes(url)) return;
    imageUrls.push(url);
  };
  pushImage(item.image?.imageUrl);
  for (const img of item.additionalImages ?? []) pushImage(img.imageUrl);

  const descriptionRaw = item.description?.trim() || item.shortDescription?.trim() || "";
  const description = descriptionRaw
    ? (descriptionRaw.includes("<") ? stripHtml(descriptionRaw) : descriptionRaw).slice(0, 4000)
    : null;

  if (bulletPoints.length === 0 && description) {
    const sentences = description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);
    bulletPoints.push(...sentences.slice(0, 5));
  }

  const productName = title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60);
  const asin = `ebay:${legacyItemId}`;

  return {
    productName,
    asin,
    category: item.categoryPath?.trim() || item.brand?.trim() || null,
    title,
    bulletPoints: bulletPoints.slice(0, 7),
    imageUrls: imageUrls.slice(0, 9),
    targetKeywords: extractKeywordsFromListing(title, bulletPoints.slice(0, 7)),
    description,
    price: formatBrowsePrice(item.price),
    rating: null,
    attributes: attributes.slice(0, 40),
  };
}

export async function fetchEbayBrowseItemByLegacyId(input: {
  environment: EbayOAuthEnvironment;
  legacyItemId: string;
  marketplaceId: string;
}): Promise<EbayBrowseItem> {
  const creds = getEbayClientCredentials(input.environment);
  if (!creds) {
    throw new Error(
      `eBay ${input.environment} Browse API credentials are not configured (need EBAY_${
        input.environment === "sandbox" ? "SANDBOX" : "PRODUCTION"
      }_CLIENT_ID and CLIENT_SECRET).`,
    );
  }

  const token = await getEbayApplicationToken(input.environment);
  const { apiBaseUrl } = ebayOAuthEndpoints(input.environment);
  const url =
    `${apiBaseUrl}/buy/browse/v1/item/get_item_by_legacy_id`
    + `?legacy_item_id=${encodeURIComponent(input.legacyItemId)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": input.marketplaceId,
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      parseEbayRestError(text, `eBay Browse API failed (${res.status})`),
    );
  }
  return JSON.parse(text) as EbayBrowseItem;
}

/**
 * Fetch a public eBay listing by URL via Browse API (application token).
 * Returns null when client credentials are not configured for that environment.
 */
export async function tryFetchEbayListingViaBrowseApi(
  pageUrl: string,
): Promise<FetchedListing | null> {
  const legacyItemId = parseEbayItemIdFromListingUrl(pageUrl);
  if (!legacyItemId) return null;

  const environment = ebayEnvironmentFromListingUrl(pageUrl);
  if (!getEbayClientCredentials(environment)) return null;

  const item = await fetchEbayBrowseItemByLegacyId({
    environment,
    legacyItemId,
    marketplaceId: marketplaceIdFromEbayUrl(pageUrl),
  });
  return mapEbayBrowseItemToFetchedListing(item, pageUrl, legacyItemId);
}
