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
  const prompt = `You are an expert Amazon listing copywriter and SEO specialist. Create Amazon-compliant, optimized listing content for the following product. You MUST follow every Amazon rule below exactly — non-compliant content may be suppressed by Amazon.

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
  "title": "<optimized title>",
  "bulletPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>", "<bullet 5>"],
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>", "<keyword 6>", "<keyword 7>", "<keyword 8>", "<keyword 9>", "<keyword 10>"],
  "htmlDescription": "<p>Opening paragraph...</p><h3>Feature 1</h3><p>Details...</p>..."
}

--- STRICT AMAZON TITLE REQUIREMENTS ---
1. MAX 200 characters including spaces (ideally 80 or fewer). Count carefully.
2. NO promotional phrases: "free shipping", "100% quality guaranteed", "best seller", "hot item", "best", "top rated", "#1", "premium quality", etc.
3. NO special characters: !, $, ?, _, {, }, ^, ¬, ¦. Decorative usage of ~, #, <, >, * is prohibited. Only use hyphens (-), forward slashes (/), commas (,), ampersands (&), and periods (.) where necessary.
4. NO restricted phrases: "FSA/HSA eligible", "guarantee", "warranty", "refund", "money back", "unconditional", "risk-free".
5. NO word repeated more than twice (except prepositions, articles, conjunctions). Brand names count toward this limit.
6. Capitalize first letter of each word EXCEPT prepositions (in, on, over, with), conjunctions (and, or, for), and articles (the, a, an).
7. Use numerals for all numbers ("2" not "two").
8. Use standard abbreviations for measurements (cm, oz, in, kg, lb, ml).
9. Information order: Brand Name → Flavour/Style → Product Type → Key Attribute → Color → Size/Pack Count → Model Number.
10. If no brand name, do NOT add "generic" to the title. Just omit the brand.

--- STRICT AMAZON BULLET POINT REQUIREMENTS ---
1. EXACTLY 5 bullet points.
2. Each bullet 10-255 characters.
3. Begin with a capital letter.
4. Format as a sentence fragment — NO end punctuation (no periods, no exclamation marks, no question marks).
5. Use header-with-colon structure: "Feature: description" (e.g., "Cotton fabric: Made from 100% cotton for softness and breathability").
6. Write numbers 1-9 in full ("three" not "3"), EXCEPT names, model numbers, and measurements.
7. Include a space between digit and unit ("60 ml" not "60ml").
8. Highlight product features, benefits, and how it meets customer needs. NO brand marketing stories.
9. NO subjective/performance/comparative claims unless verifiable on packaging.
10. NO comparison to competitor brands or other products.
11. NO special characters: ™, ®, €, …, †, ‡, ¢, £, ¥, ©, ±, ~, â, Æ, Š, Œ, Ÿ, Ž.
12. NO emojis.
13. NO prohibited claims: "eco-friendly", "environmentally friendly", "anti-microbial", "anti-bacterial", "made from bamboo", "contains bamboo", "made from soy", "contains soy".
14. NO guarantee language: "Full refund", "If not satisfied, send it back", "Unconditional guarantee".
15. NO external information: company info, website links, contact info.
16. Each bullet must mention UNIQUE product information — no repetition across bullets.
17. Minimize duplication with title and description.

--- AMAZON KEYWORD REQUIREMENTS (generic_keywords) ---
1. Search Terms (generic_keywords) should be less than 250 bytes total.
2. Provide 10 backend search terms.
3. Short, relevant terms customers would search. Mix of short and long-tail.
4. NO brand names in backend keywords.
5. NO words repeated from the title.
6. NO unnecessary or irrelevant keywords.
7. Separate terms with spaces (do not use commas, semicolons, or pipes in the backend field — but return as an array of individual terms here).

--- AMAZON HTML DESCRIPTION REQUIREMENTS ---
Generate a premium, conversion-focused Amazon product description in clean HTML format following these rules to maximize readability, engagement, and conversion.

HTML STRUCTURE:
- Generate clean, lightweight HTML only.
- Do not use CSS, JavaScript, tables, or external styling.
- Use only Amazon-supported HTML tags: <h2>, <h3>, <p>, <strong>, <ul>, <li>, <br>.

CONTENT LAYOUT (follow this exact 6-section structure inside the htmlDescription string):

1. Compelling Heading
   - Start with a clear, benefit-driven heading inside an <h2> tag.
   - Example: <h2>Experience Superior Performance & Everyday Convenience</h2>

2. Opening Summary
   - Write a short paragraph (2-4 sentences) explaining: what the product is, who it is for, the primary benefit, and why it stands out.

3. Key Features
   - Use heading: <h3><strong>Key Features</strong></h3>
   - Present features using bullet points (<ul><li>).
   - Each bullet must start with the feature name in <strong>, then explain the customer benefit focusing on value rather than specs alone.
   - Example: <li><strong>Premium Material</strong> – Built with durable, high-quality materials for long-lasting performance.</li>

4. Benefits Section
   - Use heading: <h3><strong>Why You'll Love It</strong></h3>
   - Bullet points explaining how the product improves the customer's life or solves common problems.

5. Usage / Application
   - Use heading: <h3><strong>Perfect For</strong></h3>
   - Bullet points listing ideal users, occasions, or environments.

6. Pitch Summary (Mandatory)
   - Use heading: <h3><strong>Why Choose This Product?</strong></h3>
   - Write a concise sales-oriented paragraph that reinforces the biggest benefits, builds confidence, and encourages purchase naturally.
   - Avoid exaggerated or misleading claims.

FORMATTING RULES:
- Every section heading must be bold.
- Use headings to break content into easy-to-scan sections.
- Use bullet points wherever possible instead of long paragraphs.
- Keep paragraphs short (2-3 sentences maximum).
- Highlight important keywords using <strong>.
- Write naturally for humans while incorporating relevant SEO keywords.
- Maintain a premium, professional, and trustworthy tone.
- Avoid keyword stuffing, emojis, and ALL CAPS (except brand names if required).
- Never repeat the same information across multiple sections.
- 400-600 words total.
- Include primary and secondary keywords naturally (no keyword stuffing).
- NO promotional language: "free shipping", "100% guaranteed", "best seller", "hot deal", "limited time", "act now", "buy now", "risk-free", "no questions asked".
- NO guarantee/warranty/refund language.
- NO external links or references to other products.

Return ONLY the JSON object, no markdown, no explanation.`;

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
