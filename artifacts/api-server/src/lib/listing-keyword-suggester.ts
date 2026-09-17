import { generateChatCompletion } from "./ai-provider.js";

/** Rule-based fallback when AI is unavailable or fails. */
export function extractKeywordsFromListing(title: string, bulletPoints: string[]): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "will",
    "are", "not", "but", "all", "can", "your", "our", "has", "use",
    "more", "also", "each", "its", "any", "was", "one", "new", "high",
    "great", "best", "top", "free", "easy", "made", "help", "make",
    "get", "set", "kit", "pro", "pack", "quality", "product", "features",
  ]);

  const combined = [title, ...bulletPoints].join(" ").toLowerCase();
  const words = combined.match(/\b[a-z]{3,}\b/g) || [];
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }

  const phrases: string[] = [];
  const titleWords = title.toLowerCase().split(/\s+/);
  for (let i = 0; i < titleWords.length - 1; i++) {
    const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
    if (!bigram.split(" ").some((w) => stopWords.has(w))) phrases.push(bigram);
  }

  const singles = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w]) => w);

  return [...new Set([...phrases.slice(0, 4), ...singles])].slice(0, 10);
}

function parseKeywordsJson(content: string): string[] {
  const trimmed = content.trim();
  const jsonSlice = trimmed.match(/\{[\s\S]*\}/) ?? trimmed.match(/\[[\s\S]*\]/);
  const raw = jsonSlice ? jsonSlice[0] : trimmed;
  const parsed = JSON.parse(raw) as { keywords?: unknown } | unknown[];
  const list = Array.isArray(parsed) ? parsed : parsed.keywords;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === "string" ? item : (item as { keyword?: string })?.keyword))
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim().replace(/\s+/g, " "))
    .slice(0, 10);
}

function normalizeKeywordList(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of keywords) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out.slice(0, 10);
}

export async function suggestListingTargetKeywordsWithAI(input: {
  title: string;
  bulletPoints: string[];
  category?: string | null;
  productName?: string | null;
  brandName?: string | null;
}): Promise<string[]> {
  const title = input.title.trim();
  if (!title) return [];

  const bullets = input.bulletPoints.filter(Boolean).slice(0, 7);
  const prompt = `You are a senior Amazon/e-commerce performance marketing specialist. Suggest high-quality **search keywords** a shopper would type to find this product.

Product name: ${input.productName?.trim() || title.split(/[|\-–—,]/)[0]?.trim() || "Unknown"}
${input.brandName?.trim() ? `Brand: ${input.brandName.trim()}` : ""}
${input.category?.trim() ? `Category: ${input.category.trim()}` : ""}
Title: ${title}

Bullet points:
${bullets.length ? bullets.map((b, i) => `${i + 1}. ${b}`).join("\n") : "(none)"}

Rules:
- Return exactly 10 keywords as a JSON array of strings, OR {"keywords":["...", ...]}.
- Prefer 2–4 word phrases with clear purchase intent (product type + material/fit/use case).
- Include compatibility/model phrases when the listing mentions "for …" or a vehicle/model.
- NO random title word pairs, NO single generic words alone (e.g. "key", "car", "premium").
- NO promotional fluff ("best seller", "top rated", "#1").
- Mix head terms and long-tail; natural language shoppers use on Amazon.
- Do not repeat the same stem unnecessarily.

Return ONLY JSON, no markdown.`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 800, temperature: 0.35 },
  );

  try {
    const keywords = normalizeKeywordList(parseKeywordsJson(content));
    if (keywords.length >= 5) return keywords;
    return [];
  } catch {
    return [];
  }
}

/** AI-first target keywords for fetched listings; falls back to heuristics. */
export async function resolveTargetKeywordsForListing(input: {
  title: string;
  bulletPoints: string[];
  category?: string | null;
  productName?: string | null;
  brandName?: string | null;
}): Promise<string[]> {
  const fallback = extractKeywordsFromListing(input.title, input.bulletPoints);
  try {
    const ai = await suggestListingTargetKeywordsWithAI(input);
    if (ai.length >= 5) return ai;
  } catch (err) {
    console.warn("[listing-keywords] AI suggestion failed, using heuristics", err);
  }
  return fallback;
}
