import { generateChatCompletion } from "./ai-provider";
import type { AuditResult } from "@workspace/db";

export async function analyzeListingWithAI(data: {
  title: string;
  bulletPoints: string[];
  imageUrls: string[];
  targetKeywords: string[];
  category?: string;
}): Promise<AuditResult> {
  const prompt = `You are an expert e-commerce listing optimizer. Analyze this product listing (from any marketplace or online store) and provide a comprehensive audit.

Product Category: ${data.category || "General"}
Title: ${data.title}

Bullet Points (${data.bulletPoints.length}):
${data.bulletPoints.map((bp, i) => `${i + 1}. ${bp}`).join("\n")}

Image URLs provided (${data.imageUrls.length} images):
${data.imageUrls.slice(0, 7).join("\n") || "No images provided"}

Target Keywords: ${data.targetKeywords.join(", ")}

Evaluate each section and return a JSON object with this exact structure:
{
  "titleScore": {
    "score": <0-100>,
    "issues": ["list of specific issues found"],
    "suggestions": ["actionable improvement suggestions"]
  },
  "bulletScore": {
    "score": <0-100>,
    "issues": ["list of specific issues found"],
    "suggestions": ["actionable improvement suggestions"]
  },
  "imageScore": {
    "score": <0-100>,
    "issues": ["list of specific issues with image count and diversity"],
    "suggestions": ["actionable improvement suggestions"]
  },
  "keywordScore": {
    "score": <0-100>,
    "issues": ["list of missing keywords or poor placement"],
    "suggestions": ["actionable improvement suggestions"]
  },
  "overallScore": <weighted average 0-100>,
  "summary": "2-3 sentence overall assessment of the listing quality and top priorities"
}

Scoring criteria (adapt to the marketplace when obvious from the listing; otherwise use general e-commerce best practices):
- Title: Clear, keyword-rich, appropriate length for the channel, strong hook, readable, not stuffed with keywords or promotional spam
- Bullets/description: Benefit-driven, scannable, covers key features and differentiators, appropriate length for the platform
- Images: Sufficient variety (main, lifestyle, detail, infographic where relevant), professional quality
- Keywords: Primary terms in title and body copy, natural placement, good coverage of search intent

Be specific, actionable, and accurate. Return ONLY the JSON object, no markdown.`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 2048 },
  );

  try {
    const parsed = JSON.parse(content);
    return {
      titleScore: {
        score: parsed.titleScore?.score ?? 50,
        issues: parsed.titleScore?.issues ?? [],
        suggestions: parsed.titleScore?.suggestions ?? [],
      },
      bulletScore: {
        score: parsed.bulletScore?.score ?? 50,
        issues: parsed.bulletScore?.issues ?? [],
        suggestions: parsed.bulletScore?.suggestions ?? [],
      },
      imageScore: {
        score: parsed.imageScore?.score ?? 50,
        issues: parsed.imageScore?.issues ?? [],
        suggestions: parsed.imageScore?.suggestions ?? [],
      },
      keywordScore: {
        score: parsed.keywordScore?.score ?? 50,
        issues: parsed.keywordScore?.issues ?? [],
        suggestions: parsed.keywordScore?.suggestions ?? [],
      },
      overallScore: parsed.overallScore ?? 50,
      summary: parsed.summary ?? "Analysis complete.",
    };
  } catch {
    return {
      titleScore: { score: 50, issues: ["Unable to analyze"], suggestions: [] },
      bulletScore: { score: 50, issues: ["Unable to analyze"], suggestions: [] },
      imageScore: { score: 50, issues: ["Unable to analyze"], suggestions: [] },
      keywordScore: { score: 50, issues: ["Unable to analyze"], suggestions: [] },
      overallScore: 50,
      summary: "Analysis could not be completed. Please try again.",
    };
  }
}

export async function analyzeCompetitorWithAI(data: {
  productName: string;
  title: string;
  bulletPoints: string[];
  imageCount: number;
  targetKeywords: string[];
  ourTitle: string;
  ourBullets: string[];
}): Promise<{ overallScore: number; strengths: string[]; weaknesses: string[] }> {
  const prompt = `You are an Amazon listing expert. Analyze this competitor listing compared to our listing.

OUR LISTING:
Title: ${data.ourTitle}
Bullets: ${data.ourBullets.slice(0, 5).join(" | ")}

COMPETITOR: ${data.productName}
Title: ${data.title}
Bullet Points: ${data.bulletPoints.map((bp, i) => `${i + 1}. ${bp}`).join(" | ")}
Image Count: ${data.imageCount}
Target Keywords: ${data.targetKeywords.join(", ")}

Return a JSON object:
{
  "overallScore": <0-100 overall listing quality>,
  "strengths": ["3-5 specific strengths vs our listing"],
  "weaknesses": ["3-5 specific weaknesses vs our listing"]
}

Return ONLY the JSON, no markdown.`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 1024 },
  );

  try {
    const parsed = JSON.parse(content);
    return {
      overallScore: parsed.overallScore ?? 50,
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
    };
  } catch {
    return {
      overallScore: 50,
      strengths: [],
      weaknesses: [],
    };
  }
}
