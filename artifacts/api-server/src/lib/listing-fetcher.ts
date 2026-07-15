import * as cheerio from "cheerio";
import {
  fetchListingByAsin,
  fetchListingByUrl,
  type FetchedListing,
} from "./amazon-fetcher";

export type { FetchedListing };

export type ListingPlatform = "amazon" | "shopify" | "walmart" | "ebay" | "etsy" | "generic";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function detectListingPlatform(url: string): ListingPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "generic";
  }

  if (host.includes("amazon.")) return "amazon";
  if (host.includes("myshopify.com") || host.includes("shopify.com")) return "shopify";
  if (host.includes("walmart.com")) return "walmart";
  if (host.includes("ebay.")) return "ebay";
  if (host.includes("etsy.com")) return "etsy";
  return "generic";
}

function isAmazonAsin(value: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(value.trim());
}

function extractPlatformProductId(platform: ListingPlatform, url: string): string {
  const path = new URL(url).pathname;

  if (platform === "walmart") {
    const match = path.match(/\/ip\/[^/]+\/(\d+)/i) ?? path.match(/\/ip\/(\d+)/i);
    if (match?.[1]) return `walmart:${match[1]}`;
  }
  if (platform === "ebay") {
    const match = path.match(/\/itm\/(?:[^/]+\/)?(\d+)/i) ?? url.match(/[?&]item=(\d+)/i);
    if (match?.[1]) return `ebay:${match[1]}`;
  }
  if (platform === "etsy") {
    const match = path.match(/\/listing\/(\d+)/i);
    if (match?.[1]) return `etsy:${match[1]}`;
  }
  if (platform === "shopify" || path.includes("/products/")) {
    const match = path.match(/\/products\/([^/?#]+)/i);
    if (match?.[1]) return `shopify:${decodeURIComponent(match[1])}`;
  }

  const slug = path.split("/").filter(Boolean).pop();
  if (slug) return `${platform}:${decodeURIComponent(slug).slice(0, 80)}`;

  return `${platform}:${Buffer.from(url).toString("base64url").slice(0, 24)}`;
}

async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`The store returned HTTP ${res.status}. Check the URL and try again.`);
  }

  const html = await res.text();
  const lower = html.toLowerCase();
  if (
    lower.includes("access denied")
    || lower.includes("captcha")
    || lower.includes("robot check")
    || (lower.includes("blocked") && lower.includes("automated"))
  ) {
    throw new Error(
      "This store blocked automated fetching. Try again later or enter listing details manually.",
    );
  }

  return html;
}

type JsonLdNode = Record<string, unknown>;

function collectJsonLdNodes(data: unknown, out: JsonLdNode[]): void {
  if (!data) return;
  if (Array.isArray(data)) {
    for (const item of data) collectJsonLdNodes(item, out);
    return;
  }
  if (typeof data !== "object") return;

  const node = data as JsonLdNode;
  if (node["@graph"]) {
    collectJsonLdNodes(node["@graph"], out);
    return;
  }

  out.push(node);
  for (const value of Object.values(node)) {
    if (typeof value === "object") collectJsonLdNodes(value, out);
  }
}

function readJsonLdProducts(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  const products: JsonLdNode[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes: JsonLdNode[] = [];
      collectJsonLdNodes(parsed, nodes);
      for (const node of nodes) {
        const type = node["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && t.toLowerCase().includes("product"))) {
          products.push(node);
        }
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  });

  return products;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function normalizeImageUrl(raw: string, baseUrl: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function extractKeywords(title: string, bullets: string[]): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "will",
    "are", "not", "but", "all", "can", "your", "our", "has", "use",
    "more", "also", "each", "its", "any", "was", "one", "new", "high",
    "great", "best", "top", "free", "easy", "made", "help", "make",
    "get", "set", "kit", "pro", "pack", "quality", "product", "features",
  ]);

  const combined = [title, ...bullets].join(" ").toLowerCase();
  const words = combined.match(/\b[a-z]{3,}\b/g) || [];
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }

  const phrases: string[] = [];
  const titleWords = title.toLowerCase().split(/\s+/);
  for (let i = 0; i < titleWords.length - 1; i++) {
    const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
    if (!bigram.split(" ").some((w) => stopWords.has(w))) phrases.push(bigram);
  }

  const singles = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w]) => w);

  return [...new Set([...phrases.slice(0, 4), ...singles])].slice(0, 10);
}

function parseFromJsonLd(product: JsonLdNode, pageUrl: string): Partial<FetchedListing> {
  const title = asString(product.name) ?? "";
  const description = asString(product.description);

  const images: string[] = [];
  for (const candidate of asStringArray(product.image)) {
    const normalized = normalizeImageUrl(candidate, pageUrl);
    if (normalized) images.push(normalized);
  }

  const offers = product.offers;
  const offerNode = Array.isArray(offers) ? offers[0] : offers;
  const price = offerNode && typeof offerNode === "object"
    ? asString((offerNode as JsonLdNode).price) ?? asString((offerNode as JsonLdNode).lowPrice)
    : null;

  const ratingNode = product.aggregateRating;
  const rating = ratingNode && typeof ratingNode === "object"
    ? asString((ratingNode as JsonLdNode).ratingValue)
    : null;

  const category = asString(product.category)
    ?? (typeof product.brand === "object" ? asString((product.brand as JsonLdNode).name) : asString(product.brand));

  return {
    title,
    description,
    imageUrls: uniqueUrls(images),
    price: price ? (price.startsWith("$") ? price : `$${price}`) : null,
    rating,
    category,
  };
}

function parseOpenGraph($: cheerio.CheerioAPI, pageUrl: string): Partial<FetchedListing> {
  const og = (prop: string) => $(`meta[property="og:${prop}"]`).attr("content")?.trim() ?? "";
  const title = og("title");
  const description = og("description") || $('meta[name="description"]').attr("content")?.trim() || "";
  const image = og("image");
  const imageUrls = image ? [normalizeImageUrl(image, pageUrl)].filter((u): u is string => !!u) : [];

  return {
    title,
    description: description || null,
    imageUrls,
  };
}

function parsePlatformSpecific(
  $: cheerio.CheerioAPI,
  html: string,
  pageUrl: string,
  platform: ListingPlatform,
): Partial<FetchedListing> {
  const partial: Partial<FetchedListing> = {};

  if (platform === "walmart") {
    partial.title = $("h1").first().text().trim()
      || $('[itemprop="name"]').first().text().trim()
      || partial.title;
    partial.price = $('[itemprop="price"]').attr("content")
      || $('[data-testid="price-wrap"] [aria-hidden="true"]').first().text().trim()
      || partial.price;
    $("ul.wm-product-features li, [data-testid='product-description-content'] li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10) partial.bulletPoints = [...(partial.bulletPoints ?? []), text];
    });
  }

  if (platform === "ebay") {
    partial.title = $("h1.x-item-title__mainTitle").text().trim()
      || $("h1").first().text().trim()
      || partial.title;
    partial.price = $(".x-price-primary span").first().text().trim() || partial.price;
    $(".ux-labels-values__labels-content, .ux-layout-section-evo__item").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 8 && text.length < 240) {
        partial.bulletPoints = [...(partial.bulletPoints ?? []), text];
      }
    });
  }

  if (platform === "etsy") {
    partial.title = $("h1[data-buy-box-listing-title]").text().trim()
      || $("h1").first().text().trim()
      || partial.title;
    partial.price = $('[data-buy-box-region] .currency-value').first().text().trim() || partial.price;
    $("#listing-page-cart ul li, [data-product-details-description-text-content] li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 8) partial.bulletPoints = [...(partial.bulletPoints ?? []), text];
    });
  }

  if (platform === "shopify" || platform === "generic") {
    partial.title = $("h1.product__title, h1.product-single__title, h1").first().text().trim() || partial.title;
    $(".product__description li, .product-single__description li, .rte li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 8) partial.bulletPoints = [...(partial.bulletPoints ?? []), text];
    });
  }

  if ((partial.imageUrls?.length ?? 0) === 0) {
    const ogImages = parseOpenGraph($, pageUrl).imageUrls ?? [];
    const galleryImages: string[] = [];
    $("img[src], img[data-src]").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      const normalized = normalizeImageUrl(src, pageUrl);
      if (
        normalized
        && !normalized.includes("sprite")
        && !normalized.includes("icon")
        && (normalized.includes("product") || normalized.includes("listing") || normalized.includes("image"))
      ) {
        galleryImages.push(normalized);
      }
    });
    partial.imageUrls = uniqueUrls([...ogImages, ...galleryImages]).slice(0, 9);
  }

  if (!partial.description) {
    partial.description = $("#product-description, .product__description, [data-product-details-description-text-content]")
      .first()
      .text()
      .trim()
      .slice(0, 2000) || null;
  }

  if (!partial.title && html.includes("Shopify")) {
    const shopifyProduct = html.match(/"title"\s*:\s*"([^"]+)"/);
    if (shopifyProduct?.[1]) partial.title = shopifyProduct[1].replace(/\\u0026/g, "&");
  }

  return partial;
}

function mergeListing(
  platform: ListingPlatform,
  pageUrl: string,
  ...partials: Array<Partial<FetchedListing>>
): FetchedListing {
  const merged: Partial<FetchedListing> = {};
  for (const partial of partials) {
    if (partial.title && !merged.title) merged.title = partial.title;
    if (partial.description && !merged.description) merged.description = partial.description;
    if (partial.category && !merged.category) merged.category = partial.category;
    if (partial.price && !merged.price) merged.price = partial.price;
    if (partial.rating && !merged.rating) merged.rating = partial.rating;
    merged.imageUrls = uniqueUrls([...(merged.imageUrls ?? []), ...(partial.imageUrls ?? [])]).slice(0, 9);
    merged.bulletPoints = [...(merged.bulletPoints ?? []), ...(partial.bulletPoints ?? [])]
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 7);
  }

  const title = merged.title?.trim() ?? "";
  if (!title) {
    throw new Error(
      "Could not extract product data from that page. The store may block automated access or require JavaScript.",
    );
  }

  let bulletPoints = merged.bulletPoints ?? [];
  if (bulletPoints.length === 0 && merged.description) {
    const sentences = merged.description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);
    bulletPoints = sentences.slice(0, 5);
  }

  const productName = title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60);

  return {
    productName,
    asin: extractPlatformProductId(platform, pageUrl),
    category: merged.category ?? null,
    title,
    bulletPoints,
    imageUrls: merged.imageUrls ?? [],
    targetKeywords: extractKeywords(title, bulletPoints),
    description: merged.description ?? null,
    price: merged.price ?? null,
    rating: merged.rating ?? null,
  };
}

async function fetchNonAmazonListing(url: string, platform: ListingPlatform): Promise<FetchedListing> {
  const html = await fetchPageHtml(url);
  const $ = cheerio.load(html);

  const jsonLdProducts = readJsonLdProducts(html);
  const jsonLdPartial = jsonLdProducts.length > 0
    ? parseFromJsonLd(jsonLdProducts[0], url)
    : {};

  const ogPartial = parseOpenGraph($, url);
  const platformPartial = parsePlatformSpecific($, html, url, platform);

  return mergeListing(platform, url, ogPartial, jsonLdPartial, platformPartial);
}

export async function fetchListing(input: { asin?: string; url?: string }): Promise<FetchedListing> {
  if (input.asin?.trim()) {
    if (isAmazonAsin(input.asin)) {
      return fetchListingByAsin(input.asin.trim());
    }
    throw new Error(
      "That value is not a valid Amazon ASIN. Paste a full product URL from Amazon, Shopify, Walmart, eBay, Etsy, or another store.",
    );
  }

  if (!input.url?.trim()) {
    throw new Error("Either a product URL or Amazon ASIN must be provided.");
  }

  const normalizedUrl = normalizeInputUrl(input.url);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("Invalid URL. Paste a full product page link starting with https://");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http and https product URLs are supported.");
  }

  const platform = detectListingPlatform(normalizedUrl);
  if (platform === "amazon") {
    return fetchListingByUrl(normalizedUrl);
  }

  return fetchNonAmazonListing(normalizedUrl, platform);
}
