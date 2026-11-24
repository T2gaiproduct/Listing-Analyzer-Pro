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
import {
  extractGenerationInstructionsFromSkillText,
  resolveMarketplaceListingInstructions,
} from "./content-marketplace-skill-sync.js";
import {
  clampBulletsToMaxChars,
  clampTitleToMaxChars,
  formatHardCharacterLimitsForPrompt,
  mergeListingContentRules,
  resolveLimitsFromSkillInstructionsText,
} from "./content-skill-limits.js";

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
  "htmlDescription": "<p>Opening paragraph...</p><h3>Feature 1</h3><p>Details...</p>...",
  "attributes": [
    { "attribute": "Brand", "value": "<brand or Generic>" },
    { "attribute": "Material", "value": "<material>" }
  ]
}

Include "attributes": 8–16 marketplace-relevant product specification rows (attribute name + value), e.g. Brand, Color, Material, Size, Dimensions, MPN, Department, Style — use facts from product context only; do not invent compliance certifications.

Return ONLY the JSON object, no markdown, no explanation.`;

const GENERATED_ATTRIBUTE_MAX = 24;

function normalizeGeneratedAttributes(raw: unknown): Array<{ attribute: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ attribute: string; value: string }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { attribute?: unknown; value?: unknown };
    const attribute = String(row.attribute ?? "").trim();
    const value = String(row.value ?? "").trim();
    if (!attribute || !value) continue;
    const key = attribute.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ attribute, value });
    if (out.length >= GENERATED_ATTRIBUTE_MAX) break;
  }
  return out;
}

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
  uploadReferenceContext?: string;
  marketplaceName: string;
}): string {
  return `Product: ${data.productName}
${data.brandName ? `Brand: ${data.brandName}` : ""}
${data.asin ? `ASIN: ${data.asin}` : ""}
${data.category ? `Category: ${data.category}` : ""}
${data.productDescription?.trim() ? `Product Description (from seller — use as factual source for benefits, materials, and use cases):\n${data.productDescription.trim()}` : ""}
${data.uploadReferenceContext?.trim() ? `\n--- UPLOAD STEP REFERENCE (attributes & competitor research) ---\n${data.uploadReferenceContext.trim()}` : ""}
${data.imageUrls && data.imageUrls.length > 0 ? `Product Images: ${data.imageUrls.length} product photo(s) uploaded on the Upload step` : ""}
${data.customPrompt?.trim() ? `\nSeller creative direction (incorporate where appropriate without violating ${data.marketplaceName} rules):\n${data.customPrompt.trim()}` : ""}

Current Title: ${data.currentTitle}
Current Bullet Points:
${data.currentBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}
Target Keywords: ${data.currentKeywords.join(", ")}
${data.auditSummary ? `Audit Summary: ${data.auditSummary}` : ""}`;
}

export type GenerateListingContentOptions = {
  /** Admin skill test: skill markdown body (or full file; see marketplaceSkillFullText). */
  marketplaceInstructionsOverride?: string | null;
  /** Full uploaded skill file (YAML header + --- + body) for limits when testing unsaved editor text. */
  marketplaceSkillFullText?: string | null;
};

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
  uploadReferenceContext?: string;
  contentMarketplaceId?: number | null;
  contentMarketplaceSlug?: string | null;
}, options: GenerateListingContentOptions = {}): Promise<GeneratedContent> {
  const marketplace = await resolveContentMarketplaceForGeneration({
    contentMarketplaceId: data.contentMarketplaceId,
    contentMarketplaceSlug: data.contentMarketplaceSlug,
  });

  const override = options.marketplaceInstructionsOverride?.trim();
  const overrideFull =
    options.marketplaceSkillFullText?.trim()
    || (override && override.length >= 20 ? override : "");

  let instructionPack: Awaited<ReturnType<typeof resolveMarketplaceListingInstructions>>;
  if (overrideFull.length >= 20) {
    instructionPack = {
      body:
        extractGenerationInstructionsFromSkillText(overrideFull).trim()
        || override
        || overrideFull,
      fullSkillText: overrideFull,
      fromAdminSkillFile: true,
    };
  } else {
    instructionPack = await resolveMarketplaceListingInstructions(marketplace, data.category);
  }

  const marketplaceInstructions = instructionPack.body;
  const useSkillFileOnly = instructionPack.fromAdminSkillFile;

  const effectiveRules = useSkillFileOnly && instructionPack.fullSkillText
    ? mergeListingContentRules({}, resolveLimitsFromSkillInstructionsText(instructionPack.fullSkillText))
    : mergeListingContentRules(marketplace.rules);

  const rulesBlock = useSkillFileOnly ? "" : formatContentMarketplaceRulesForPrompt(effectiveRules);
  const hardLimitsBlock = formatHardCharacterLimitsForPrompt(effectiveRules);
  const productBlock = buildProductContextBlock({ ...data, marketplaceName: marketplace.name });

  const titleMaxNote =
    effectiveRules?.titleMaxChars != null
      ? `\nThe JSON "title" string must be ≤ ${effectiveRules.titleMaxChars} characters (spaces count).`
      : "";

  const prompt = `You are an expert ${marketplace.name} listing copywriter and SEO specialist. Create optimized, compliant listing content for the following product on ${marketplace.name}. You MUST follow every rule below exactly.

--- MARKETPLACE-SPECIFIC INSTRUCTIONS (admin skill) ---
${marketplaceInstructions}

${hardLimitsBlock}${rulesBlock}
--- PRODUCT CONTEXT ---
${productBlock}

Generate optimized listing content for ${marketplace.name}. ${LISTING_JSON_OUTPUT_SPEC}${titleMaxNote}`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 3600, useCase: "content_generation" },
  );

  try {
    const parsed = JSON.parse(content);
    const rawDescription = stripWhyYoullLoveItSection(
      parsed.htmlDescription ?? "<p>Description not available.</p>",
    );
    const normalizedDescription = stripInlineStrongFromParagraphs(
      normalizeListingHtmlDescription(rawDescription),
    );
    const attributes = normalizeGeneratedAttributes(parsed.attributes);
    const titleMax = effectiveRules?.titleMaxChars;
    const bulletMax = effectiveRules?.bulletMaxChars;
    const rawTitle = String(parsed.title ?? data.currentTitle);
    const rawBullets = normalizeBulletPoints(parsed.bulletPoints ?? data.currentBullets);
    return {
      title: clampTitleToMaxChars(rawTitle, titleMax),
      bulletPoints: clampBulletsToMaxChars(rawBullets, bulletMax),
      keywords: parsed.keywords ?? data.currentKeywords,
      htmlDescription: sanitizeHtmlDescription(normalizedDescription),
      ...(attributes.length > 0 ? { attributes } : {}),
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
