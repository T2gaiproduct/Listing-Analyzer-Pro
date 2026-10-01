import { bulletsToHtmlDescription } from "./resolve-listing-content.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** eBay listing HTML: description, bullet features, keywords/tags, and category label from Product Explorer. */
export function buildEbayListingDescriptionHtml(input: {
  htmlDescription: string;
  bulletPoints: string[];
  keywords: string[];
  category?: string | null;
}): string {
  const parts: string[] = [];
  const baseHtml = input.htmlDescription.trim();
  if (baseHtml) parts.push(baseHtml);

  const bullets = input.bulletPoints.map((b) => b.trim()).filter(Boolean);
  if (bullets.length > 0) {
    const bulletHtml = bulletsToHtmlDescription(bullets);
    const alreadyHasList = baseHtml.includes("<li>");
    if (!alreadyHasList) {
      parts.push(`<h3>Features</h3>\n${bulletHtml}`);
    }
  }

  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  if (keywords.length > 0) {
    parts.push(`<p><strong>Tags:</strong> ${escapeHtml(keywords.join(", "))}</p>`);
  }

  const category = input.category?.trim();
  if (category) {
    parts.push(`<p><strong>Category:</strong> ${escapeHtml(category)}</p>`);
  }

  return parts.join("\n").trim();
}
