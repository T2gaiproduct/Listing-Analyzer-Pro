import * as cheerio from "cheerio";

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

async function getSessionCookies(): Promise<string> {
  try {
    const res = await fetch("https://www.amazon.com/", {
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

async function fetchAmazonPage(asin: string, cookies: string): Promise<string> {
  const url = `https://www.amazon.com/dp/${asin}?th=1&psc=1`;
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    "Sec-Fetch-Site": "same-origin",
    Referer: "https://www.amazon.com/",
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
    const text = $(el).text().trim();
    if (text && !text.toLowerCase().includes("make sure this fits")) {
      bulletPoints.push(text);
    }
  });

  if (bulletPoints.length === 0) {
    $(".a-unordered-list .a-list-item").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20 && text.length < 500) {
        bulletPoints.push(text);
      }
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

  const description =
    $("#productDescription p").text().trim() ||
    $("#aplus p").first().text().trim() ||
    null;

  const keywords = extractKeywords(title, bulletPoints);
  const productName = title.split(",")[0]?.trim() || title.slice(0, 60) || "Product";

  return {
    productName,
    asin,
    category,
    title,
    bulletPoints: bulletPoints.slice(0, 7),
    imageUrls: imageUrls.slice(0, 9),
    targetKeywords: keywords,
    description,
    price,
    rating,
  };
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
    if (!bigram.split(" ").some((w) => stopWords.has(w))) {
      phrases.push(bigram);
    }
  }

  const singles = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w]) => w);

  return [...new Set([...phrases.slice(0, 4), ...singles])].slice(0, 10);
}

export async function fetchListingByAsin(asin: string): Promise<FetchedListing> {
  const normalizedAsin = asin.trim().toUpperCase();
  if (!isValidAsin(normalizedAsin)) {
    throw new Error(`Invalid ASIN format: ${asin}. Must be 10 alphanumeric characters (e.g. B09G9FPHY6).`);
  }

  // Fetch session cookies first to bypass basic bot detection
  const cookies = await getSessionCookies();

  let html: string;
  try {
    html = await fetchAmazonPage(normalizedAsin, cookies);
  } catch (err) {
    if (err instanceof Error && err.message === "CAPTCHA") {
      throw new Error(
        "Amazon blocked this request (CAPTCHA). This happens when fetching from cloud servers. " +
          "Please use the manual entry option to paste your listing data directly.",
      );
    }
    // Retry once without cookies
    try {
      html = await fetchAmazonPage(normalizedAsin, "");
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

export async function fetchListingByUrl(url: string): Promise<FetchedListing> {
  const asin = extractAsinFromUrl(url);
  if (!asin) {
    throw new Error(
      "Could not find an ASIN in that URL. Please paste a direct Amazon product page URL (e.g. https://amazon.com/dp/B09G9FPHY6).",
    );
  }
  return fetchListingByAsin(asin);
}

export async function fetchListing(input: { asin?: string; url?: string }): Promise<FetchedListing> {
  if (input.asin) return fetchListingByAsin(input.asin);
  if (input.url) return fetchListingByUrl(input.url);
  throw new Error("Either asin or url must be provided");
}
