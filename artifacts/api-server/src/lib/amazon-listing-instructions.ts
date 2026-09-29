/** Default Amazon marketplace AI instructions (seeded into content_marketplaces). */
export const AMAZON_LISTING_AI_INSTRUCTIONS = `--- AMAZON TITLE REQUIREMENTS ---
Generate a high-converting, SEO-optimized, Amazon-compliant product title following these rules.

OUTPUT REQUIREMENTS:
- Generate exactly 1 optimized Amazon title.
- Keep the title between 150–200 characters (including spaces).
- Return only the final title without explanations, headings, quotation marks, or Markdown.

TITLE STRUCTURE (follow this order whenever applicable):
Brand | Main Product | Primary Keyword | Key Feature | Material | Size/Capacity | Color | Quantity | Compatibility/Use Case | Additional Benefit

Example Structure:
Brand + Product Type + Main Keyword + Material + Capacity + Key Feature + Color + Pack Size + Ideal Use

WRITING GUIDELINES:
1. Start with the Brand Name — Always begin with the brand name (if provided). If no brand is provided, start directly with the product name.
2. Use the Most Important Keywords First — Include the highest-value keywords naturally near the beginning. Avoid keyword stuffing.
3. Include Only Relevant Features — Include only meaningful selling points such as: Leakproof, BPA Free, Vacuum Insulated, Waterproof, Foldable, Heavy Duty, Rechargeable, Fast Charging, Non-Slip. Do not list unnecessary specifications.
4. Include Product Attributes — Where applicable include: Material, Capacity, Dimensions, Size, Color, Quantity, Pack Size, Model, Compatibility.
5. Add Use Cases Naturally — Include who or where the product is ideal for: Office, Gym, Travel, Home, Camping, Hiking, Kitchen, School.
6. Readability — Use separators like commas or hyphens naturally. Avoid excessive punctuation.
   Example: Brand Stainless Steel Water Bottle, Vacuum Insulated, Leakproof, BPA Free, 750ml, Black, for Gym, Office & Travel
7. Amazon Compliance — NO promotional phrases ("Best", "#1", "Guaranteed", "Cheapest", "Free Shipping", "Hot Sale", "Limited Offer"). NO ALL CAPS (except brand abbreviations if required). NO emojis or special characters. NO repeated keywords unnecessarily. NO subjective or unverifiable claims.

SEO BEST PRACTICES:
- Naturally include: primary keyword, secondary keyword, feature keyword, material, size, use case.
- Every keyword should fit naturally into the title.
- Prioritize clarity over stuffing keywords.

WRITING STYLE:
- Read naturally like a sentence.
- Look similar to premium Amazon brands.
- Instantly communicate what the product is and why customers should click.

--- AMAZON BULLET POINT REQUIREMENTS ---
Generate exactly 5 high-converting, SEO-friendly, Amazon-ready bullet points following these rules.

OUTPUT REQUIREMENTS:
- Exactly 5 bullet points in the JSON array.
- Each bullet approximately 180–250 characters.
- Plain text only: NO bullet symbols (•), NO numbering (1. 2.), NO Markdown (**bold**), NO HTML.

BULLET POINT STRUCTURE:
Each bullet must follow this exact format:
FEATURE TITLE IN ALL CAPS – Customer benefit, supporting details, and practical value in one flowing sentence.

Example:
PREMIUM MATERIAL – Crafted from food-grade stainless steel that delivers exceptional durability, resists rust, and provides reliable everyday performance for long-lasting use.

WRITING GUIDELINES:
1. Feature Title — Start with a concise FEATURE TITLE IN ALL CAPS, then an en-dash (–), then the benefit copy. Do not use a colon after the title.
2. Sell Benefits, Not Just Features — Every bullet must explain why the feature matters, how it improves the customer's experience, and what problem it solves. Avoid listing specs alone.
3. Naturally Include SEO Keywords — Include relevant keywords naturally without stuffing. Keywords should read naturally within sentences.
4. Make Every Bullet Unique — Cover a different selling point in each bullet (e.g., Premium Material, Performance, Ease of Use, Comfort & Design, Versatility, Safety, Durability, Convenience, Compatibility, Purchase Confidence). Avoid repeating benefits or keywords.
5. Customer-Focused Language — Write from the customer's perspective using phrases like "Designed to...", "Helps you...", "Keeps your...", "Enjoy...", "Perfect for...", "Built for...", "Makes it easy to..."
6. Readability — Use one concise paragraph per bullet. Keep sentences clear and easy to scan. Maintain a professional, premium, and trustworthy tone.
7. Amazon Compliance — NO emojis. NO exaggerated or unverifiable claims. NO phrases like "Best", "#1", "Guaranteed", or "Cheapest". NO keyword overuse. NO repeated information. NO guarantee/warranty/refund language. NO external information (company info, website links, contact info).

PREFERRED BULLET ORDER:
1. Premium Quality / Material
2. Main Performance Benefit
3. Convenience / Ease of Use
4. Versatility / Applications
5. Durability / Value / Purchase Confidence

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
- Use <h2> for the main heading (not <h1>). Use <ul> for lists (not <ol>). Do not put numbers or bullet characters inside <li> text.

CONTENT LAYOUT (follow this exact 5-section structure inside the htmlDescription string):

1. Compelling Heading
   - Start with a clear, benefit-driven heading inside an <h2> tag.
   - Example: <h2>Experience Superior Performance & Everyday Convenience</h2>

2. Opening Summary
   - Write a short paragraph (2-4 sentences) explaining: what the product is, who it is for, the primary benefit, and why it stands out.
   - Use plain text inside <p> tags only — no <strong>, no bold, no emphasized words mid-sentence.

3. Key Features
   - Use heading: <h3><strong>Key Features</strong></h3>
   - Present features using bullet points (<ul><li>).
   - Each bullet must start with the feature name in <strong>, then explain the customer benefit focusing on value rather than specs alone.
   - Example: <li><strong>Premium Material</strong> – Built with durable, high-quality materials for long-lasting performance.</li>

4. Usage / Application
   - Use heading: <h3><strong>Perfect For</strong></h3>
   - Bullet points listing ideal users, occasions, or environments.

5. Pitch Summary (Mandatory)
   - Use heading: <h3><strong>Why Choose This Product?</strong></h3>
   - Write a concise sales-oriented paragraph that reinforces the biggest benefits, builds confidence, and encourages purchase naturally.
   - Plain text only in the paragraph — no <strong> inside <p>.
   - Avoid exaggerated or misleading claims.

DO NOT include a "Why You'll Love It" section or any separate benefits section — customer benefits belong in the bullet points and Key Features only.

FORMATTING RULES:
- Section headings may use <strong> inside <h2>/<h3> only.
- Use headings to break content into easy-to-scan sections.
- Use bullet points wherever possible instead of long paragraphs.
- Keep paragraphs short (2-3 sentences maximum).
- Never use <strong> inside <p> tags — no bold words in body paragraphs (e.g. do not bold product category, "premium", or random keywords).
- Key Features list items may use <strong> only for the feature label at the start of each <li>.
- Write naturally for humans while incorporating relevant SEO keywords.
- Maintain a premium, professional, and trustworthy tone.
- Avoid keyword stuffing, emojis, and ALL CAPS (except brand names if required).
- Never repeat the same information across multiple sections.
- 400-600 words total.
- Include primary and secondary keywords naturally (no keyword stuffing).
- NO promotional language: "free shipping", "100% guaranteed", "best seller", "hot deal", "limited time", "act now", "buy now", "risk-free", "no questions asked".
- NO guarantee/warranty/refund language.
- NO external links or references to other products.`;
