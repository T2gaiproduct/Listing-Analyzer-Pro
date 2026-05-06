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

async function fetchAmazonPage(asin: string): Promise<string> {
  const url = `https://www.amazon.com/dp/${asin}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Amazon returned status ${response.status}`);
  }
  return response.text();
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

  $("img[data-old-hires]").each((_, el) => {
    const src = $(el).attr("data-old-hires");
    if (src && !seenUrls.has(src)) {
      seenUrls.add(src);
      imageUrls.push(src);
    }
  });

  if (imageUrls.length === 0) {
    const scriptContent = html.match(/"hiRes":"(https:[^"]+)"/g) || [];
    for (const match of scriptContent.slice(0, 9)) {
      const url = match.replace(/"hiRes":"/, "").replace(/"$/, "");
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        imageUrls.push(url);
      }
    }
  }

  if (imageUrls.length === 0) {
    $("#altImages img, #imageBlock img").each((_, el) => {
      const src =
        $(el).attr("data-old-hires") ||
        $(el).attr("src") ||
        "";
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

  const rating = $("span[data-hook='rating-out-of-text']").text().trim() ||
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
    if (!bigram.split(" ").some(w => stopWords.has(w))) {
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
    throw new Error(`Invalid ASIN format: ${asin}`);
  }
  const html = await fetchAmazonPage(normalizedAsin);
  return parseAmazonHtml(html, normalizedAsin);
}

export async function fetchListingByUrl(url: string): Promise<FetchedListing> {
  const asin = extractAsinFromUrl(url);
  if (!asin) {
    throw new Error("Could not extract ASIN from URL. Please provide a direct Amazon product URL.");
  }
  return fetchListingByAsin(asin);
}

export async function fetchListing(input: { asin?: string; url?: string }): Promise<FetchedListing> {
  if (input.asin) return fetchListingByAsin(input.asin);
  if (input.url) return fetchListingByUrl(input.url);
  throw new Error("Either asin or url must be provided");
}
