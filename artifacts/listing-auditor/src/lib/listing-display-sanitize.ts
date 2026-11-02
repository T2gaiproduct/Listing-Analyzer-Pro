import { normalizeBulletPoint } from "@/lib/listing-content-format";

/** Plain text safe for Overview bullets and titles (no raw HTML / entities). */
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
