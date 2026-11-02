import { normalizeBulletPoint } from "@/lib/listing-content-format";

/** Plain text safe for Overview bullets and titles (no raw HTML / entities). */
export function isJunkListingDescription(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/\.aplus-v2\b|\.premium-aplus-module\b/i.test(t)) return true;
  if (/\bfunction\s+logShoppableMetrics/i.test(t) || /\bwindow\.ue\b/i.test(t)) return true;
  if (/\{\s*position\s*:/i.test(t) && /overflow\s*:/i.test(t)) return true;
  const braces = (t.match(/[{}]/g) ?? []).length;
  return braces >= 6 && braces / Math.max(t.length, 1) > 0.015;
}

export function displayListingDescription(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed || isJunkListingDescription(trimmed)) return null;
  return cleanListingDisplayText(trimmed);
}

export function cleanListingDisplayText(text: string): string {
  const decoded = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  const withoutTags = decoded.replace(/<[^>]*>/g, " ");
  return normalizeBulletPoint(withoutTags.replace(/\s+/g, " "));
}
