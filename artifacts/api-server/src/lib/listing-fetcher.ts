import * as cheerio from "cheerio";
import type { Request } from "express";
import {
  fetchListingByAsin,
  fetchListingByUrl,
  type FetchedListing,
  type FetchedListingAttribute,
} from "./amazon-fetcher";
import {
  enrichAmazonListingFromCatalog,
  resolveMarketplaceCodeForAmazonListing,
} from "./amazon-catalog-listing.js";
import { resolveAmazonConnectionForWorkspace } from "./resolve-amazon-settings.js";

export type { FetchedListing, FetchedListingAttribute };
import { normalizeShopifyTags } from "./shopify-product-sync.js";
import {
  extractKeywordsFromListing,
  resolveTargetKeywordsForListing,
} from "./listing-keyword-suggester.js";


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
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    return "generic";
  }

  if (host.includes("amazon.")) return "amazon";
  if (host.includes("myshopify.com") || host.includes("shopify.com") || host.endsWith(".shop")) return "shopify";
  if (path.includes("/products/")) return "shopify";
  if (host.includes("walmart.com")) return "walmart";
  if (host.includes("target.com")) return "generic";
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

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

function getShopifyProductJsonUrl(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl);
    const match = parsed.pathname.match(/^(.*\/products\/[^/?#]+)/i);
    if (!match) return null;
    return `${parsed.origin}${match[1]}.json`;
  } catch {
    return null;
  }
}

interface ShopifyProductResponse {
  product?: {
    title?: string;
    body_html?: string;
    product_type?: string;
    tags?: string | string[];
    images?: Array<{ src?: string }>;
    variants?: Array<{ price?: string }>;
  };
}

async function fetchShopifyProductJson(url: string): Promise<FetchedListing | null> {
  const jsonUrl = getShopifyProductJsonUrl(url);
  if (!jsonUrl) return null;

  try {
    const res = await fetch(jsonUrl, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const data = await res.json() as ShopifyProductResponse;
    const product = data.product;
    if (!product?.title?.trim()) return null;

    const description = product.body_html ? stripHtml(product.body_html) : null;
    const bulletPoints: string[] = [];

    if (description) {
      const sentences = description
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && s.length < 300);
      bulletPoints.push(...sentences.slice(0, 5));
    }

    for (const tag of normalizeShopifyTags(product.tags).slice(0, 3)) {
      if (tag.length > 3) bulletPoints.push(tag);
    }

    const imageUrls = (product.images ?? [])
      .map((img) => img.src?.trim())
      .filter((src): src is string => !!src)
      .slice(0, 9);

    const title = product.title.trim();
    const price = product.variants?.[0]?.price ? `$${product.variants[0].price}` : null;

    const attributes: FetchedListingAttribute[] = [];
    if (product.product_type?.trim()) {
      attributes.push({ attribute: "Product type", value: product.product_type.trim() });
    }
    const tags = normalizeShopifyTags(product.tags).slice(0, 12);
    if (tags.length) {
      attributes.push({ attribute: "Tags", value: tags.join(", ") });
    }

    return {
      productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      asin: extractPlatformProductId("shopify", url),
      category: product.product_type?.trim() || null,
      title,
      bulletPoints: bulletPoints.slice(0, 7),
      imageUrls,
      targetKeywords: extractKeywordsFromListing(title, bulletPoints),
      description,
      price,
      rating: null,
      attributes,
    };
  } catch {
    return null;
  }
}

async function fetchPageHtml(url: string, platform: ListingPlatform): Promise<string> {
  const origin = new URL(url).origin;
  const res = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: origin,
      Origin: origin,
    },
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

function attributesFromJsonLd(product: JsonLdNode): FetchedListingAttribute[] {
  const rows: FetchedListingAttribute[] = [];
  const push = (attribute: string, value: string) => {
    const a = attribute.trim();
    const v = value.trim();
    if (!a || !v) return;
    if (rows.some((r) => r.attribute.toLowerCase() === a.toLowerCase())) return;
    rows.push({ attribute: a, value: v });
  };

  const props = product.additionalProperty;
  const list = Array.isArray(props) ? props : props ? [props] : [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const node = entry as JsonLdNode;
    const name = asString(node.name) ?? asString(node.propertyID);
    const value = asString(node.value) ?? asString(node.description);
    if (name && value) push(name, value);
  }

  const brand = typeof product.brand === "object"
    ? asString((product.brand as JsonLdNode).name)
    : asString(product.brand);
  if (brand) push("Brand", brand);

  const sku = asString(product.sku);
  if (sku) push("SKU", sku);

  return rows.slice(0, 40);
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
    attributes: attributesFromJsonLd(product),
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
    const ebayAttrs: FetchedListingAttribute[] = [...(partial.attributes ?? [])];
    $(".ux-labels-values__labels-content, .ux-layout-section-evo__item").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 8 && text.length < 240) {
        partial.bulletPoints = [...(partial.bulletPoints ?? []), text];
      }
    });
    $(".ux-labels-values__labels-content").each((_, labelEl) => {
      const label = $(labelEl).text().replace(/\s+/g, " ").trim();
      const value = $(labelEl).closest(".ux-labels-values").find(".ux-labels-values__values-content").first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (label && value && label.length < 80) {
        ebayAttrs.push({ attribute: label, value });
      }
    });
    partial.attributes = ebayAttrs.slice(0, 40);
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

function mergeAttributes(partials: Array<Partial<FetchedListing>>): FetchedListingAttribute[] {
  const rows: FetchedListingAttribute[] = [];
  for (const partial of partials) {
    for (const row of partial.attributes ?? []) {
      if (!row.attribute?.trim() || !row.value?.trim()) continue;
      if (rows.some((r) => r.attribute.toLowerCase() === row.attribute.toLowerCase())) continue;
      rows.push({ attribute: row.attribute.trim(), value: row.value.trim() });
    }
  }
  return rows.slice(0, 40);
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
  const attributes = mergeAttributes(partials);

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
    targetKeywords: extractKeywordsFromListing(title, bulletPoints),
    description: merged.description ?? null,
    price: merged.price ?? null,
    rating: merged.rating ?? null,
    attributes,
  };
}

async function fetchNonAmazonListing(url: string, platform: ListingPlatform): Promise<FetchedListing> {
  if (platform === "shopify" || url.includes("/products/")) {
    const shopifyListing = await fetchShopifyProductJson(url);
    if (shopifyListing) return shopifyListing;
  }

  const html = await fetchPageHtml(url, platform);
  const $ = cheerio.load(html);

  const jsonLdProducts = readJsonLdProducts(html);
  const jsonLdPartial = jsonLdProducts.length > 0
    ? parseFromJsonLd(jsonLdProducts[0], url)
    : {};

  const ogPartial = parseOpenGraph($, url);
  const platformPartial = parsePlatformSpecific($, html, url, platform);

  return mergeListing(platform, url, ogPartial, jsonLdPartial, platformPartial);
}

async function enrichListingTargetKeywords(listing: FetchedListing): Promise<FetchedListing> {
  const targetKeywords = await resolveTargetKeywordsForListing({
    title: listing.title,
    bulletPoints: listing.bulletPoints,
    category: listing.category,
    productName: listing.productName,
  });
  return { ...listing, targetKeywords };
}

export type FetchListingSpApiContext = {
  workspaceId: number;
  userId: string;
  req?: Request;
};

async function enrichAmazonListingIfConnected(
  listing: FetchedListing,
  opts: { url?: string; spApi?: FetchListingSpApiContext },
): Promise<FetchedListing> {
  if (!opts.spApi?.workspaceId) return listing;

  const connection = await resolveAmazonConnectionForWorkspace({
    workspaceId: opts.spApi.workspaceId,
    userId: opts.spApi.userId,
    req: opts.spApi.req,
  });
  if (!connection) return listing;

  const marketplaceCode = resolveMarketplaceCodeForAmazonListing({
    url: opts.url,
    connection,
  });

  try {
    return await enrichAmazonListingFromCatalog({
      listing,
      marketplaceCode,
      connection,
    });
  } catch {
    return listing;
  }
}

export async function fetchListing(input: {
  asin?: string;
  url?: string;
  spApi?: FetchListingSpApiContext;
}): Promise<FetchedListing> {
  if (input.asin?.trim()) {
    if (isAmazonAsin(input.asin)) {
      const listing = await fetchListingByAsin(input.asin.trim());
      const enriched = await enrichAmazonListingIfConnected(listing, {
        url: input.url,
        spApi: input.spApi,
      });
      return enrichListingTargetKeywords(enriched);
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

  const { assertAllowedOutboundUrl } = await import("./ssrf-guard");
  await assertAllowedOutboundUrl(normalizedUrl);

  const platform = detectListingPlatform(normalizedUrl);
  if (platform === "amazon") {
    const listing = await fetchListingByUrl(normalizedUrl);
    const enriched = await enrichAmazonListingIfConnected(listing, {
      url: normalizedUrl,
      spApi: input.spApi,
    });
    return enrichListingTargetKeywords(enriched);
  }

  return enrichListingTargetKeywords(await fetchNonAmazonListing(normalizedUrl, platform));
}
