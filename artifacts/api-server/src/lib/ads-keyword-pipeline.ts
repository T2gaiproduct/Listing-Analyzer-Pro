import type { AdsKeywordEntry, AdsKeywordMatchType, AdsSourcesSnapshot } from "@workspace/db";
import { generateChatCompletion } from "./ai-provider.js";
import type {
  AmazonExistingKeyword,
  AmazonKeywordRecommendation,
  AmazonSearchTermRow,
} from "./amazon-ads-api.js";

export type ListingContext = {
  title?: string;
  bullets?: string[];
  targetKeywords?: string[];
  generatedKeywords?: string[];
};

function normalizeKeyword(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function defaultMatchType(keyword: string, sources: string[]): AdsKeywordMatchType {
  if (sources.includes("search_term_report") || sources.includes("existing_campaign")) {
    return "EXACT";
  }
  if (keyword.split(/\s+/).length >= 3) return "PHRASE";
  return "BROAD";
}

export function mergeKeywordSources(input: {
  recommendations: AmazonKeywordRecommendation[];
  existingKeywords: AmazonExistingKeyword[];
  searchTerms: AmazonSearchTermRow[];
  listing: ListingContext;
}): AdsSourcesSnapshot {
  const warnings: string[] = [];
  if (!input.recommendations.length) warnings.push("No Amazon keyword recommendations returned.");
  if (!input.searchTerms.length) warnings.push("Search term report empty or still processing.");

  return {
    amazonRecommendations: input.recommendations.map((r) => ({
      keyword: r.keyword,
      suggestedBidCents: r.suggestedBidCents,
      rank: r.rank,
    })),
    existingCampaignKeywords: input.existingKeywords.map((k) => ({
      keyword: k.keyword,
      matchType: k.matchType,
      campaignId: k.campaignId,
      adGroupId: k.adGroupId,
      impressions: k.impressions,
      clicks: k.clicks,
    })),
    searchTermReport: input.searchTerms.map((r) => ({
      searchTerm: r.searchTerm,
      impressions: r.impressions,
      clicks: r.clicks,
      orders: r.orders,
      costCents: r.costCents,
    })),
    listingKeywords: [
      ...(input.listing.targetKeywords ?? []),
      ...(input.listing.generatedKeywords ?? []),
    ],
    productTitle: input.listing.title,
    productBullets: input.listing.bullets,
    gatheredAt: new Date().toISOString(),
    warnings,
  };
}

export async function expandKeywordsWithAi(
  snapshot: AdsSourcesSnapshot,
  asin: string,
): Promise<Array<{ keyword: string; matchType: AdsKeywordMatchType; note?: string }>> {
  const seed = new Set<string>();
  for (const r of snapshot.amazonRecommendations ?? []) seed.add(r.keyword);
  for (const r of snapshot.existingCampaignKeywords ?? []) seed.add(r.keyword);
  for (const r of snapshot.searchTermReport ?? []) seed.add(r.searchTerm);
  for (const r of snapshot.listingKeywords ?? []) seed.add(r);

  const prompt = `You are an Amazon Sponsored Products PPC strategist for SellerLens.

Product ASIN: ${asin}
Title: ${snapshot.productTitle ?? "Unknown"}
Bullets: ${(snapshot.productBullets ?? []).join(" | ")}
Seed keywords (${seed.size}): ${[...seed].slice(0, 80).join(", ")}

Expand this into additional high-intent PPC keyword targets. Include:
- synonyms and long-tail variants
- 3-5 negative keyword suggestions as separate entries with matchType "NEGATIVE" (we will filter those out of positives)
- assign matchType EXACT, PHRASE, or BROAD for positive keywords

Return ONLY valid JSON:
{
  "keywords": [
    { "keyword": "wireless earbuds", "matchType": "PHRASE", "note": "optional short reason" }
  ]
}`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 2500, temperature: 0.4 },
  );

  try {
    const parsed = JSON.parse(content) as {
      keywords?: Array<{ keyword?: string; matchType?: string; note?: string }>;
    };
    return (parsed.keywords ?? [])
      .filter((row) => row.matchType?.toUpperCase() !== "NEGATIVE")
      .map((row) => ({
        keyword: row.keyword?.trim() ?? "",
        matchType: (row.matchType?.toUpperCase() === "EXACT"
          || row.matchType?.toUpperCase() === "PHRASE"
          || row.matchType?.toUpperCase() === "BROAD")
          ? row.matchType!.toUpperCase() as AdsKeywordMatchType
          : "BROAD",
        note: row.note?.trim() || undefined,
      }))
      .filter((row) => row.keyword.length > 0);
  } catch {
    return [];
  }
}

export function scoreAndRankKeywords(
  snapshot: AdsSourcesSnapshot,
  aiKeywords: Array<{ keyword: string; matchType: AdsKeywordMatchType; note?: string }>,
): AdsKeywordEntry[] {
  const map = new Map<string, AdsKeywordEntry>();

  const listingSet = new Set(
    (snapshot.listingKeywords ?? []).map(normalizeKeyword),
  );
  const titleTokens = new Set(
    (snapshot.productTitle ?? "").toLowerCase().split(/\W+/).filter(Boolean),
  );

  function upsert(
    keyword: string,
    source: string,
    partial: Partial<AdsKeywordEntry> = {},
  ): void {
    const key = normalizeKeyword(keyword);
    if (!key) return;
    const existing = map.get(key);
    const sources = existing ? [...new Set([...existing.sources, source])] : [source];
    map.set(key, {
      keyword: keyword.trim(),
      matchType: partial.matchType ?? existing?.matchType ?? defaultMatchType(keyword, sources),
      score: existing?.score ?? 0,
      sources,
      suggestedBidCents: partial.suggestedBidCents ?? existing?.suggestedBidCents,
      impressions: partial.impressions ?? existing?.impressions,
      clicks: partial.clicks ?? existing?.clicks,
      orders: partial.orders ?? existing?.orders,
      costCents: partial.costCents ?? existing?.costCents,
      selected: existing?.selected ?? true,
      aiNote: partial.aiNote ?? existing?.aiNote,
    });
  }

  for (const rec of snapshot.amazonRecommendations ?? []) {
    upsert(rec.keyword, "amazon_recommendation", {
      suggestedBidCents: rec.suggestedBidCents,
    });
  }

  for (const row of snapshot.existingCampaignKeywords ?? []) {
    upsert(row.keyword, "existing_campaign", {
      matchType: row.matchType?.toUpperCase() as AdsKeywordMatchType | undefined,
      impressions: row.impressions,
      clicks: row.clicks,
    });
  }

  for (const row of snapshot.searchTermReport ?? []) {
    upsert(row.searchTerm, "search_term_report", {
      impressions: row.impressions,
      clicks: row.clicks,
      orders: row.orders,
      costCents: row.costCents,
    });
  }

  for (const kw of snapshot.listingKeywords ?? []) {
    upsert(kw, "listing");
  }

  for (const row of aiKeywords) {
    upsert(row.keyword, "ai_expansion", {
      matchType: row.matchType,
      aiNote: row.note,
    });
  }

  const scored = [...map.values()].map((entry) => {
    let score = 0;
    if (entry.sources.includes("search_term_report")) score += 35;
    if (entry.sources.includes("existing_campaign")) score += 25;
    if (entry.sources.includes("amazon_recommendation")) score += 20;
    if (entry.sources.includes("listing")) score += 15;
    if (entry.sources.includes("ai_expansion")) score += 10;

    const norm = normalizeKeyword(entry.keyword);
    if (listingSet.has(norm)) score += 12;
    const tokens = norm.split(/\s+/);
    const titleOverlap = tokens.filter((t) => titleTokens.has(t)).length;
    score += Math.min(titleOverlap * 4, 16);

    if (entry.orders && entry.orders > 0) score += Math.min(entry.orders * 5, 25);
    if (entry.clicks && entry.clicks > 0) score += Math.min(entry.clicks, 15);
    if (entry.impressions && entry.impressions > 100) score += 5;

    if (entry.sources.includes("amazon_recommendation") && entry.suggestedBidCents) {
      score += 5;
    }

    return { ...entry, score: Math.min(Math.round(score), 100) };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 150);
}
