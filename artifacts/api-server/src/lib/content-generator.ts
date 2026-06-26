import { generateChatCompletion } from "./ai-provider";
import type { GeneratedContent } from "@workspace/db";

export async function generateListingContent(data: {
  productName: string;
  asin?: string | null;
  category?: string | null;
  brandName?: string | null;
  imageUrls?: string[];
  currentTitle: string;
  currentBullets: string[];
  currentKeywords: string[];
  auditSummary?: string;
}): Promise<GeneratedContent> {
  const prompt = `You are an expert Amazon listing copywriter and SEO specialist. Create Amazon-ready, optimized listing content for the following product.

Product: ${data.productName}
${data.brandName ? `Brand: ${data.brandName}` : ""}
${data.asin ? `ASIN: ${data.asin}` : ""}
${data.category ? `Category: ${data.category}` : ""}
${data.imageUrls && data.imageUrls.length > 0 ? `Product Images: ${data.imageUrls.length} image(s) provided for reference` : ""}

Current Title: ${data.currentTitle}
Current Bullet Points:
${data.currentBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}
Target Keywords: ${data.currentKeywords.join(", ")}
${data.auditSummary ? `Audit Summary: ${data.auditSummary}` : ""}

Generate optimized, Amazon-compliant listing content. Return ONLY a JSON object:
{
  "title": "<optimized title, max 200 chars, primary keyword near front, no ALL CAPS, no promotional phrases like 'best', no price/quantity, includes top 3-5 keywords naturally>",
  "bulletPoints": [
    "<bullet 1: START WITH CAPITAL KEYWORD PHRASE - then explain benefit. Max 250 chars. Focus on a key feature/benefit.>",
    "<bullet 2: same format>",
    "<bullet 3: same format>",
    "<bullet 4: same format>",
    "<bullet 5: same format>"
  ],
  "keywords": [
    "<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>",
    "<keyword 6>", "<keyword 7>", "<keyword 8>", "<keyword 9>", "<keyword 10>"
  ],
  "htmlDescription": "<p>Opening paragraph with primary keyword and compelling hook.</p><h3>Feature 1</h3><p>Details about feature 1 and how it benefits the customer.</p><h3>Feature 2</h3><p>Details about feature 2.</p><h3>Feature 3</h3><p>Details about feature 3.</p><p>Closing CTA paragraph.</p>"
}

Requirements:
- Title: max 200 chars, natural language, primary keyword first, brand name if known, includes size/count/color if relevant
- 5 bullet points: each starts with an ALL CAPS key benefit phrase, then a dash, then description. Max 250 chars each. Benefits-focused, not just features. Include secondary keywords naturally.
- 10 backend search keywords: short, relevant terms customers would search. No brand names, no repeat words from title. Mix of short and long-tail.
- HTML description: 400-600 words. Amazon-legal HTML only (p, h3, ul, li, br). No promotional language. Include primary and secondary keywords naturally. End with a strong call to action.

Return ONLY the JSON, no markdown, no explanation.`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 3000 },
  );

  try {
    const parsed = JSON.parse(content);
    return {
      title: parsed.title ?? data.currentTitle,
      bulletPoints: parsed.bulletPoints ?? data.currentBullets,
      keywords: parsed.keywords ?? data.currentKeywords,
      htmlDescription: parsed.htmlDescription ?? "<p>Description not available.</p>",
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
