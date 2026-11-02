import * as cheerio from "cheerio";

const JUNK_BULLET_PATTERNS = [
  /image not available/i,
  /image unavailable/i,
  /^\s*<\s*img\b/i,
  /\bbrand deals\b/i,
  /make sure this fits/i,
  /^see more/i,
  /^click to open/i,
  /^visit the/i,
  /^sponsored/i,
];

export function decodeHtmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  try {
    return cheerio.load(`<span>${text}</span>`)("span").text();
  } catch {
    return text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
}

export function stripHtmlToPlainText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (!/[<>]/.test(trimmed) && !trimmed.includes("&lt;")) {
    return decodeHtmlEntities(trimmed).replace(/\s+/g, " ").trim();
  }
  const plain = cheerio.load(`<body>${trimmed}</body>`)("body").text();
  return decodeHtmlEntities(plain).replace(/\s+/g, " ").trim();
}

export function cleanAmazonListingLine(text: string, maxLen = 500): string {
  let line = stripHtmlToPlainText(text);
  line = line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (line.length > maxLen) line = `${line.slice(0, maxLen - 1)}…`;
  return line;
}

export function isJunkAmazonBullet(text: string): boolean {
  const line = cleanAmazonListingLine(text, 600);
  if (line.length < 12) return true;
  if (JUNK_BULLET_PATTERNS.some((re) => re.test(line))) return true;
  if (/^colour\s*:?\s*$/i.test(line)) return true;
  if (/^color\s*:?\s*$/i.test(line)) return true;
  const alpha = line.replace(/[^a-zA-Z]/g, "");
  if (alpha.length < 4) return true;
  return false;
}

export function normalizeAmazonBulletPoints(bullets: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of bullets) {
    const line = cleanAmazonListingLine(raw, 400);
    if (!line || isJunkAmazonBullet(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.slice(0, 7);
}

/** Reject Amazon A+ embedded CSS/JS and other non-prose scraped into description fields. */
export function isJunkAmazonDescription(text: string): boolean {
  const line = text.trim();
  if (line.length < 20) return true;
  if (/\.aplus-v2\b|\.premium-aplus-module\b|\.aplus-module\b/i.test(line)) return true;
  if (/function\s*\(\s*\)/i.test(line) || /\bfunction\s+logShoppableMetrics/i.test(line)) return true;
  if (/\bwindow\.(ue|Amazon)\b/i.test(line)) return true;
  if (/\{\s*position\s*:/i.test(line) && /overflow\s*:/i.test(line)) return true;
  const braces = (line.match(/[{}]/g) ?? []).length;
  if (braces >= 6 && braces / Math.max(line.length, 1) > 0.015) return true;
  const semicolons = (line.match(/;/g) ?? []).length;
  const colons = (line.match(/:/g) ?? []).length;
  if (semicolons > 12 && colons > 15 && line.length > 400) return true;
  const words = line.match(/[a-zA-Z]{3,}/g) ?? [];
  if (words.length < 6 && line.length > 250) return true;
  return false;
}

export function normalizeAmazonDescription(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const cleaned = cleanAmazonListingLine(text, 8000);
  if (!cleaned || isJunkAmazonDescription(cleaned)) return null;
  return cleaned;
}

export function normalizeAmazonAttributes(
  rows: Array<{ attribute: string; value: string }>,
): Array<{ attribute: string; value: string }> {
  const out: Array<{ attribute: string; value: string }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const attribute = cleanAmazonListingLine(row.attribute, 120);
    const value = cleanAmazonListingLine(row.value, 500);
    if (!attribute || !value) continue;
    const key = attribute.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ attribute, value });
  }
  return out.slice(0, 40);
}
