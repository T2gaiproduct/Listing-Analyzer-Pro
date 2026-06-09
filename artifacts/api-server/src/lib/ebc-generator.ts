import { getOpenAIClient } from "./openai-client";

export interface EbcContent {
  heroHeadline: string;
  heroSubheadline: string;
  heroTagline: string;
  feature1Icon: string;
  feature1Title: string;
  feature1Body: string;
  feature2Icon: string;
  feature2Title: string;
  feature2Body: string;
  feature3Icon: string;
  feature3Title: string;
  feature3Body: string;
  storyHeadline: string;
  storyBody: string;
  gridTitle: string;
  grid1Title: string;
  grid1Desc: string;
  grid2Title: string;
  grid2Desc: string;
  grid3Title: string;
  grid3Desc: string;
  grid4Title: string;
  grid4Desc: string;
  closingHeadline: string;
  closingBody: string;
  closingCta: string;
}

export async function generateEbcContent(data: {
  prompt: string;
  productName: string;
  bulletPoints: string[];
  targetKeywords: string[];
  summary: string;
}): Promise<EbcContent> {
  const systemPrompt = `You are an expert Amazon A+ Enhanced Brand Content (EBC) copywriter. You create compelling, conversion-focused content for Amazon product pages. Your copy is persuasive, benefit-driven, and follows Amazon's A+ content best practices.`;

  const userPrompt = `Create A+ EBC content for this Amazon product based on the user's custom prompt.

Product: ${data.productName}
AI Audit Summary: ${data.summary}
Current Bullet Points: ${data.bulletPoints.slice(0, 5).map((bp, i) => `${i + 1}. ${bp}`).join("\n")}
Target Keywords: ${data.targetKeywords.slice(0, 8).join(", ")}

USER'S CUSTOM PROMPT / REQUIREMENTS:
${data.prompt}

Generate A+ content for 5 modules: Hero Banner, 3-Column Features, Brand Story, 4-cell Feature Grid, and Closing CTA.

Return ONLY this JSON object:
{
  "heroHeadline": "<compelling 6-10 word headline>",
  "heroSubheadline": "<benefit-focused subtitle, 10-15 words>",
  "heroTagline": "<3 keyword tags separated by ' · ', 40 chars max>",
  "feature1Icon": "<single emoji>",
  "feature1Title": "<feature name, 3-5 words>",
  "feature1Body": "<benefit description, 80-110 chars>",
  "feature2Icon": "<single emoji>",
  "feature2Title": "<feature name, 3-5 words>",
  "feature2Body": "<benefit description, 80-110 chars>",
  "feature3Icon": "<single emoji>",
  "feature3Title": "<feature name, 3-5 words>",
  "feature3Body": "<benefit description, 80-110 chars>",
  "storyHeadline": "<brand story headline, 5-8 words>",
  "storyBody": "<brand story paragraph, 200-300 chars>",
  "gridTitle": "<section title, 3-5 words>",
  "grid1Title": "<feature title, 2-4 words>",
  "grid1Desc": "<description, 60-80 chars>",
  "grid2Title": "<feature title, 2-4 words>",
  "grid2Desc": "<description, 60-80 chars>",
  "grid3Title": "<feature title, 2-4 words>",
  "grid3Desc": "<description, 60-80 chars>",
  "grid4Title": "<feature title, 2-4 words>",
  "grid4Desc": "<description, 60-80 chars>",
  "closingHeadline": "<powerful closing line, 4-7 words>",
  "closingBody": "<closing pitch, 100-160 chars>",
  "closingCta": "<button text, 3-6 words>"
}

No markdown, no extra text. Just the JSON.`;

  const openai = await getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      heroHeadline: parsed.heroHeadline ?? data.productName,
      heroSubheadline: parsed.heroSubheadline ?? "Premium Quality · Trusted by Thousands",
      heroTagline: parsed.heroTagline ?? data.targetKeywords.slice(0, 3).join(" · "),
      feature1Icon: parsed.feature1Icon ?? "⚡",
      feature1Title: parsed.feature1Title ?? "Superior Performance",
      feature1Body: parsed.feature1Body ?? "Engineered for peak results every time.",
      feature2Icon: parsed.feature2Icon ?? "🔑",
      feature2Title: parsed.feature2Title ?? "Easy To Use",
      feature2Body: parsed.feature2Body ?? "Intuitive design makes setup effortless.",
      feature3Icon: parsed.feature3Icon ?? "🎯",
      feature3Title: parsed.feature3Title ?? "Proven Results",
      feature3Body: parsed.feature3Body ?? "Backed by thousands of five-star reviews.",
      storyHeadline: parsed.storyHeadline ?? "Our Commitment to Quality",
      storyBody: parsed.storyBody ?? "We believe great products start with understanding what customers truly need.",
      gridTitle: parsed.gridTitle ?? "Key Product Features",
      grid1Title: parsed.grid1Title ?? "Premium Build",
      grid1Desc: parsed.grid1Desc ?? "Crafted with top-tier materials for longevity.",
      grid2Title: parsed.grid2Title ?? "Customer First",
      grid2Desc: parsed.grid2Desc ?? "Our support team is always here for you.",
      grid3Title: parsed.grid3Title ?? "Versatile Use",
      grid3Desc: parsed.grid3Desc ?? "Compatible with a wide range of applications.",
      grid4Title: parsed.grid4Title ?? "Eco Friendly",
      grid4Desc: parsed.grid4Desc ?? "Sustainably made with responsible materials.",
      closingHeadline: parsed.closingHeadline ?? "Experience the Difference",
      closingBody: parsed.closingBody ?? `Join thousands of satisfied customers who chose ${data.productName}.`,
      closingCta: parsed.closingCta ?? "Order Now — Risk Free",
    };
  } catch {
    return {
      heroHeadline: data.productName,
      heroSubheadline: "Premium Quality · Trusted by Thousands",
      heroTagline: data.targetKeywords.slice(0, 3).join(" · "),
      feature1Icon: "⚡", feature1Title: "Superior Performance", feature1Body: "Engineered for peak results.",
      feature2Icon: "🔑", feature2Title: "Easy To Use", feature2Body: "Intuitive design, effortless setup.",
      feature3Icon: "🎯", feature3Title: "Proven Results", feature3Body: "Backed by five-star reviews.",
      storyHeadline: "Our Commitment to Quality",
      storyBody: "We believe great products start with understanding customers.",
      gridTitle: "Key Product Features",
      grid1Title: "Premium Build", grid1Desc: "Top-tier materials for longevity.",
      grid2Title: "Customer First", grid2Desc: "Support team always here for you.",
      grid3Title: "Versatile Use", grid3Desc: "Compatible with many applications.",
      grid4Title: "Eco Friendly", grid4Desc: "Sustainably and responsibly made.",
      closingHeadline: "Experience the Difference",
      closingBody: `Join thousands who chose ${data.productName} for quality they can feel.`,
      closingCta: "Order Now — Risk Free",
    };
  }
}
