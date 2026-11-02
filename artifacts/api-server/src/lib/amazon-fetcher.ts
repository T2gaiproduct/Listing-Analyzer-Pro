import * as cheerio from "cheerio";
import { extractKeywordsFromListing } from "./listing-keyword-suggester.js";
import {
  cleanAmazonListingLine,
  normalizeAmazonAttributes,
  normalizeAmazonBulletPoints,
  normalizeAmazonDescription,
  isJunkAmazonBullet,
  isJunkAmazonDescription,
} from "./listing-text-normalize.js";

export type FetchedListingAttribute = {
  attribute: string;
  value: string;
};

export interface FetchedListing {
  productName: string;
  asin: string;
  category: string | null;
  title: string;
  bulletPoints: string[];
  imageUrls: string[];
  targetKeywords: string[];
  description: string | null;
  price: string | null;
  rating: string | null;
  attributes: FetchedListingAttribute[];
}

function extractAsinFromUrl(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:\/|\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function isValidAsin(str: string): boolean {
  return /^[A-Z0-9]{10}$/.test(str.trim().toUpperCase());
}

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "max-age=0",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

function extractMarketplaceDomain(url: string): string {
  try {
    const host = new URL(url).hostname; // e.g. www.amazon.in
    const match = host.match(/amazon\.[a-z.]+$/i);
    return match ? match[0] : "amazon.com";
  } catch {
    return "amazon.com";
  }
}

async function getSessionCookies(domain: string): Promise<string> {
  try {
    const res = await fetch(`https://www.${domain}/`, {
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const cookieHeader = res.headers.get("set-cookie");
    if (!cookieHeader) return "";
    // parse multiple Set-Cookie headers into a single Cookie header string
    const cookies = cookieHeader
      .split(/,(?=[^ ])/g)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    return cookies;
  } catch {
    return "";
  }
}

async function fetchAmazonPage(asin: string, cookies: string, domain = "amazon.com"): Promise<string> {
  const url = `https://www.${domain}/dp/${asin}?th=1&psc=1`;
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    "Accept-Language": domain.endsWith(".in") ? "en-IN,en;q=0.9" : "en-US,en;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    Referer: `https://www.${domain}/`,
  };
  if (cookies) headers["Cookie"] = cookies;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Amazon returned HTTP ${res.status}`);
  }

  const html = await res.text();

  if (isCaptchaPage(html)) {
    throw new Error("CAPTCHA");
  }

  return html;
}

function extractAmazonDescription($: cheerio.CheerioAPI): string | null {
  const parts: string[] = [];
  const seen = new Set<string>();

  const pushPart = (raw: string) => {
    const text = cleanAmazonListingLine(raw, 2000);
    if (text.length < 15 || isJunkAmazonDescription(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(text);
  };

  const proseSelectors = [
    "#productDescription p",
    "#productDescription li",
    "#productDescription_feature_div p",
    "#productDescription_feature_div li",
    "#productDescription .a-expander-content p",
    "#productDescription .a-expander-content li",
  ];
  for (const selector of proseSelectors) {
    $(selector).each((_, el) => pushPart($(el).text()));
  }

  if (parts.length === 0) {
    const block = $("#productDescription, #productDescription_feature_div").first().clone();
    block.find("#aplus, #aplus_feature_div, style, script, noscript, iframe").remove();
    pushPart(block.text());
  }

  if (parts.length === 0) {
    const aplusSelectors = [
      "#aplus .aplus-module p",
      "#aplus .aplus-module li",
      "#aplus .premium-aplus-module p",
      "#aplus .premium-aplus-module li",
      "#aplus_feature_div .aplus-module p",
      "#aplus_feature_div .premium-aplus-module p",
    ];
    for (const selector of aplusSelectors) {
      $(selector).each((_, el) => pushPart($(el).text()));
    }
  }

  if (parts.length === 0) {
    const metaDesc = $('meta[name="description"]').attr("content")?.trim();
    if (metaDesc) pushPart(metaDesc);
  }

  const joined = parts.join("\n\n").slice(0, 8000);
  return normalizeAmazonDescription(joined);
}

function isCaptchaPage(html: string): boolean {
  return (
    html.includes("validateCaptcha") ||
    html.includes("opfcaptcha") ||
    html.includes("Enter the characters you see below") ||
    html.includes("Sorry, we just need to make sure you") ||
    (html.includes("robot") && html.includes("automated"))
  );
}

function parseAmazonHtml(html: string, asin: string): FetchedListing {
  const $ = cheerio.load(html);

  const title =
    $("#productTitle").text().trim() ||
    $("h1.a-size-large").text().trim() ||
    $("h1").first().text().trim() ||
    "";

  const bulletPoints: string[] = [];
  $("#feature-bullets ul li span.a-list-item").each((_, el) => {
    const text = cleanAmazonListingLine($(el).text(), 400);
    if (text && !isJunkAmazonBullet(text)) bulletPoints.push(text);
  });

  if (bulletPoints.length === 0) {
    $("#feature-bullets .a-list-item").each((_, el) => {
      const text = cleanAmazonListingLine($(el).text(), 400);
      if (text && !isJunkAmazonBullet(text)) bulletPoints.push(text);
    });
  }

  if (bulletPoints.length === 0) {
    $("span.a-list-item").each((_, el) => {
      const text = cleanAmazonListingLine($(el).text(), 400);
      if (text && !isJunkAmazonBullet(text)) bulletPoints.push(text);
    });
  }

  const imageUrls: string[] = [];
  const seenUrls = new Set<string>();

  // Try JSON embedded in the page first (most reliable)
  const hiResMatches = html.match(/"hiRes"\s*:\s*"(https:[^"]+)"/g) || [];
  for (const m of hiResMatches.slice(0, 9)) {
    const imgUrl = m.replace(/"hiRes"\s*:\s*"/, "").replace(/"$/, "");
    if (!seenUrls.has(imgUrl)) {
      seenUrls.add(imgUrl);
      imageUrls.push(imgUrl);
    }
  }

  if (imageUrls.length === 0) {
    $("img[data-old-hires]").each((_, el) => {
      const src = $(el).attr("data-old-hires");
      if (src && !seenUrls.has(src)) {
        seenUrls.add(src);
        imageUrls.push(src);
      }
    });
  }

  if (imageUrls.length === 0) {
    $("#altImages img, #imageBlock img").each((_, el) => {
      const src = $(el).attr("data-old-hires") || $(el).attr("src") || "";
      if (src && src.startsWith("https") && !seenUrls.has(src)) {
        seenUrls.add(src);
        imageUrls.push(src);
      }
    });
  }

  const mainImg = $("#landingImage, #imgBlkFront").attr("src");
  if (mainImg && !seenUrls.has(mainImg)) {
    imageUrls.unshift(mainImg);
  }

  const price =
    $(".a-price .a-offscreen").first().text().trim() ||
    $("#priceblock_ourprice").text().trim() ||
    null;

  const rating =
    $("span[data-hook='rating-out-of-text']").text().trim() ||
    $(".a-icon-star .a-icon-alt").first().text().trim() ||
    null;

  const category =
    $("#wayfinding-breadcrumbs_feature_div .a-link-normal").last().text().trim() ||
    null;

  const attributes: FetchedListingAttribute[] = [];
  const pushAttr = (attribute: string, value: string) => {
    const a = attribute.replace(/\s+/g, " ").trim();
    const v = value.replace(/\s+/g, " ").trim();
    if (!a || !v || a.length > 120 || v.length > 500) return;
    if (attributes.some((row) => row.attribute.toLowerCase() === a.toLowerCase())) return;
    attributes.push({ attribute: a, value: v });
  };

  const attributeRowSelectors = [
    "#productDetails_techSpec_section_1 tr",
    "#productDetails_techSpec_section_2 tr",
    "#productDetails_detailBullets_sections1 tr",
    "#productDetails_db_sections tr",
    "#productDetails_db_detailBullets_sections1 tr",
    "#prodDetails table tr",
    "#productOverview_feature_div tr",
  ].join(", ");

  $(attributeRowSelectors).each((_, row) => {
    const cells = $(row).find("th, td");
    if (cells.length >= 2) {
      pushAttr($(cells[0]).text(), $(cells[1]).text());
    }
  });

  $("#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const colon = text.indexOf(":");
    if (colon > 0 && colon < 80) {
      pushAttr(text.slice(0, colon), text.slice(colon + 1));
    }
  });

  const keywords = extractKeywordsFromListing(title, bulletPoints);
  const productName = title.split(",")[0]?.trim() || title.slice(0, 60) || "Product";

  const normalizedBullets = normalizeAmazonBulletPoints(bulletPoints);
  const normalizedAttributes = normalizeAmazonAttributes(attributes);
  const cleanTitle = cleanAmazonListingLine(title, 500);
  const cleanProductName = cleanAmazonListingLine(productName, 120) || cleanTitle.slice(0, 60) || "Product";

  let description = extractAmazonDescription($);
  if (!description && normalizedBullets.length > 0) {
    description = normalizeAmazonDescription(normalizedBullets.join("\n"));
  }

  return {
    productName: cleanProductName,
    asin,
    category: category ? cleanAmazonListingLine(category, 120) : null,
    title: cleanTitle,
    bulletPoints: normalizedBullets,
    imageUrls: imageUrls.slice(0, 9),
    targetKeywords: keywords,
    description,
    price,
    rating,
    attributes: normalizedAttributes,
  };
}

const ASIN_ONLY_MARKETPLACE_FALLBACKS = [
  "amazon.com",
  "amazon.in",
  "amazon.co.uk",
  "amazon.de",
  "amazon.ca",
  "amazon.com.au",
] as const;

async function fetchListingByAsinOnDomain(
  normalizedAsin: string,
  domain: string,
): Promise<FetchedListing> {
  const cookies = await getSessionCookies(domain);

  let html: string;
  try {
    html = await fetchAmazonPage(normalizedAsin, cookies, domain);
  } catch (err) {
    if (err instanceof Error && err.message === "CAPTCHA") {
      throw new Error(
        "Amazon blocked this request (CAPTCHA). This happens when fetching from cloud servers. " +
          "Please use the manual entry option to paste your listing data directly.",
      );
    }
    try {
      html = await fetchAmazonPage(normalizedAsin, "", domain);
    } catch (retryErr) {
      if (retryErr instanceof Error && retryErr.message === "CAPTCHA") {
        throw new Error(
          "Amazon blocked this request (CAPTCHA). Please use the manual entry option to paste your listing data directly.",
        );
      }
      throw retryErr;
    }
  }

  const listing = parseAmazonHtml(html, normalizedAsin);

  if (!listing.title) {
    throw new Error(
      "Could not extract product data from Amazon. The page may have loaded incorrectly. " +
        "Please try again or use the manual entry option.",
    );
  }

  return listing;
}

export async function fetchListingByAsin(asin: string, domain = "amazon.com"): Promise<FetchedListing> {
  const normalizedAsin = asin.trim().toUpperCase();
  if (!isValidAsin(normalizedAsin)) {
    throw new Error(`Invalid ASIN format: ${asin}. Must be 10 alphanumeric characters (e.g. B09G9FPHY6).`);
  }

  const domainsToTry = domain === "amazon.com"
    ? ASIN_ONLY_MARKETPLACE_FALLBACKS
    : [domain];

  let lastError: Error | undefined;
  for (const marketplace of domainsToTry) {
    try {
      return await fetchListingByAsinOnDomain(normalizedAsin, marketplace);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isNotFound = message.includes("404") || message.includes("not found");
      if (isNotFound && marketplace !== domainsToTry[domainsToTry.length - 1]) {
        lastError = err instanceof Error ? err : new Error(message);
        continue;
      }
      if (isNotFound && domain === "amazon.com") {
        throw new Error(
          `Product not found on common Amazon marketplaces. Paste the full product URL from your marketplace (e.g. https://www.amazon.in/dp/${normalizedAsin}).`,
        );
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`Product not found for ASIN ${normalizedAsin}.`);
}

export async function fetchListingByUrl(url: string): Promise<FetchedListing> {
  const asin = extractAsinFromUrl(url);
  if (!asin) {
    throw new Error(
      "Could not find an ASIN in that URL. Please paste a direct Amazon product page URL (e.g. https://amazon.com/dp/B09G9FPHY6).",
    );
  }
  const marketplace = extractMarketplaceDomain(url);
  return fetchListingByAsin(asin, marketplace);
}

export async function fetchListing(input: { asin?: string; url?: string }): Promise<FetchedListing> {
  if (input.asin) return fetchListingByAsin(input.asin);
  if (input.url) return fetchListingByUrl(input.url);
  throw new Error("Either asin or url must be provided");
}
