import { generateChatCompletion } from "./ai-provider";
import type { GeneratedContent } from "@workspace/db";
import { sanitizeHtmlDescription } from "./sanitize-html.js";
import {
  normalizeBulletPoints,
  normalizeListingHtmlDescription,
  stripInlineStrongFromParagraphs,
} from "./listing-content-format.js";
import {
  formatContentMarketplaceRulesForPrompt,
  resolveContentMarketplaceForGeneration,
} from "./content-marketplace-service.js";

/** Remove "Why You'll Love It" (and common variants) from generated HTML descriptions. */
export function stripWhyYoullLoveItSection(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;

  const sectionPattern = /<h3[^>]*>\s*(?:<strong>)?\s*why\s+you(?:'|&#39;|&apos;)ll\s+love\s+it\s*(?:<\/strong>)?\s*<\/h3>[\s\S]*?(?=<h3[^>]*>|$)/gi;
  let result = trimmed.replace(sectionPattern, "");
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result;
}

const LISTING_JSON_OUTPUT_SPEC = `Return ONLY a JSON object:
{
  "title": "<optimized title>",
  "bulletPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>", "<bullet 5>"],
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>", "<keyword 6>", "<keyword 7>", "<keyword 8>", "<keyword 9>", "<keyword 10>"],
  "htmlDescription": "<p>Opening paragraph...</p><h3>Feature 1</h3><p>Details...</p>..."
}

Return ONLY the JSON object, no markdown, no explanation.`;

function buildProductContextBlock(data: {
  productName: string;
  asin?: string | null;
  brandName?: string | null;
  category?: string | null;
  productDescription?: string | null;
  imageUrls?: string[];
  currentTitle: string;
  currentBullets: string[];
  currentKeywords: string[];
  auditSummary?: string;
  customPrompt?: string;
  marketplaceName: string;
}): string {
  return `Product: ${data.productName}
${data.brandName ? `Brand: ${data.brandName}` : ""}
${data.asin ? `ASIN: ${data.asin}` : ""}
${data.category ? `Category: ${data.category}` : ""}
${data.productDescription?.trim() ? `Product Description (from seller — use as factual source for benefits, materials, and use cases):\n${data.productDescription.trim()}` : ""}
${data.imageUrls && data.imageUrls.length > 0 ? `Product Images: ${data.imageUrls.length} image(s) provided for reference` : ""}
${data.customPrompt?.trim() ? `\nSeller creative direction (incorporate where appropriate without violating ${data.marketplaceName} rules):\n${data.customPrompt.trim()}` : ""}

Current Title: ${data.currentTitle}
Current Bullet Points:
${data.currentBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}
Target Keywords: ${data.currentKeywords.join(", ")}
${data.auditSummary ? `Audit Summary: ${data.auditSummary}` : ""}`;
}

export async function generateListingContent(data: {
  productName: string;
  asin?: string | null;
  category?: string | null;
  brandName?: string | null;
  productDescription?: string | null;
  imageUrls?: string[];
  currentTitle: string;
  currentBullets: string[];
  currentKeywords: string[];
  auditSummary?: string;
  customPrompt?: string;
  contentMarketplaceId?: number | null;
  contentMarketplaceSlug?: string | null;
}): Promise<GeneratedContent> {
  const marketplace = await resolveContentMarketplaceForGeneration({
    contentMarketplaceId: data.contentMarketplaceId,
    contentMarketplaceSlug: data.contentMarketplaceSlug,
  });

  const rulesBlock = formatContentMarketplaceRulesForPrompt(marketplace.rules);
  const productBlock = buildProductContextBlock({ ...data, marketplaceName: marketplace.name });

  const prompt = `You are an expert ${marketplace.name} listing copywriter and SEO specialist. Create optimized, compliant listing content for the following product on ${marketplace.name}. You MUST follow every rule below exactly.

--- MARKETPLACE-SPECIFIC INSTRUCTIONS ---
${marketplace.aiInstructions}

${rulesBlock}
--- PRODUCT CONTEXT ---
${productBlock}

Generate optimized listing content for ${marketplace.name}. ${LISTING_JSON_OUTPUT_SPEC}`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 3000 },
  );

  try {
    const parsed = JSON.parse(content);
    const rawDescription = stripWhyYoullLoveItSection(
      parsed.htmlDescription ?? "<p>Description not available.</p>",
    );
    const normalizedDescription = stripInlineStrongFromParagraphs(
      normalizeListingHtmlDescription(rawDescription),
    );
    return {
      title: parsed.title ?? data.currentTitle,
      bulletPoints: normalizeBulletPoints(parsed.bulletPoints ?? data.currentBullets),
      keywords: parsed.keywords ?? data.currentKeywords,
      htmlDescription: sanitizeHtmlDescription(normalizedDescription),
    };
  } catch {
    return {
      title: data.currentTitle,
      bulletPoints: data.currentBullets,
      keywords: data.currentKeywords,
      htmlDescription: "<p>Content generation failed. Please try again.</p>",
    };
  }
}
