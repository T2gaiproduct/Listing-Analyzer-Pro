import type { Audit, ReferenceIntelligenceRow, ReferenceResearchSlot } from "@workspace/db";
import { detectListingPlatform } from "./listing-fetcher.js";
import { fetchListing } from "./listing-fetcher.js";
import { generateChatCompletion } from "./ai-provider.js";

const INTELLIGENCE_TEMPLATE: Array<
  Pick<ReferenceIntelligenceRow, "attribute" | "allowedUse" | "decision">
> = [
  {
    attribute: "Product type",
    allowedUse: "Category taxonomy and neutral terminology",
    decision: "safe_research",
  },
  {
    attribute: "Recommended age / audience",
    allowedUse: "Discover relevance only; confirm exact suitability",
    decision: "seller_confirmation",
  },
  {
    attribute: "Material",
    allowedUse: "Never claim unless seller confirms",
    decision: "ask_seller",
  },
  {
    attribute: "Battery / power",
    allowedUse: "Never infer battery requirement or type",
    decision: "product_evidence_required",
  },
  {
    attribute: "Included components",
    allowedUse: "Only confirmed box contents may be used",
    decision: "product_evidence_required",
  },
  {
    attribute: "Dimensions / weight",
    allowedUse: "Do not infer from reference listings",
    decision: "product_evidence_required",
  },
  {
    attribute: "Keywords / use cases",
    allowedUse: "Use as research inspiration; do not copy claims",
    decision: "research_only",
  },
];

function isAmazonUrl(url: string): boolean {
  try {
    return detectListingPlatform(url) === "amazon";
  } catch {
    return false;
  }
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type ReferenceFetchResult = {
  index: number;
  ok: boolean;
  summary?: string;
  error?: string;
};

export async function fetchReferenceListingSummaries(
  slots: ReferenceResearchSlot[],
): Promise<ReferenceFetchResult[]> {
  const results: ReferenceFetchResult[] = [];

  for (let index = 0; index < slots.length; index++) {
    const url = slots[index]?.url?.trim() ?? "";
    if (!url) continue;

    if (!isAmazonUrl(url)) {
      results.push({ index, ok: false, error: "Only Amazon product URLs are supported for fetch." });
      continue;
    }

    try {
      const listing = await fetchListing({ url });
      const summary = [
        `Title: ${truncate(listing.title, 200)}`,
        listing.category ? `Category signal: ${listing.category}` : null,
        listing.bulletPoints.length
          ? `Bullets (excerpt): ${truncate(listing.bulletPoints.slice(0, 3).join(" | "), 400)}`
          : null,
        listing.description
          ? `Description (excerpt): ${truncate(listing.description.replace(/\s+/g, " "), 300)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      results.push({ index, ok: true, summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch listing";
      results.push({ index, ok: false, error: message });
    }
  }

  return results;
}

export async function analyzeReferenceIntelligence(input: {
  audit: Audit;
  slots: ReferenceResearchSlot[];
  fetchResults: ReferenceFetchResult[];
}): Promise<ReferenceIntelligenceRow[]> {
  const sellerNotes = input.slots
    .map((slot, i) => {
      const notes = slot.notes?.trim();
      if (!notes) return null;
      return `Reference ${i + 1} notes: ${notes}`;
    })
    .filter(Boolean)
    .join("\n");

  const fetched = input.fetchResults
    .filter((r) => r.ok && r.summary)
    .map((r) => `Reference ${r.index + 1} (fetched, do not copy verbatim):\n${r.summary}`)
    .join("\n\n");

  const hasInput = Boolean(sellerNotes || fetched || input.audit.category?.trim());

  if (!hasInput) {
    return INTELLIGENCE_TEMPLATE.map((row) => ({
      ...row,
      referencePatternNotes: row.attribute === "Product type"
        ? (input.audit.category?.trim() || "No category selected yet")
        : "Awaiting reference URLs and/or notes",
    }));
  }

  const prompt = `You are a listing research assistant. The seller is researching comparable Amazon listings for their own product. You must NOT copy competitor claims or text. Summarize patterns only.

Seller product: ${input.audit.productName}
Seller brand: ${input.audit.brandName ?? "—"}
Seller category: ${input.audit.category ?? "—"}

${sellerNotes ? `Seller research notes:\n${sellerNotes}\n` : ""}
${fetched ? `Fetched reference signals (summarize patterns; never quote):\n${fetched}\n` : ""}

For each attribute below, write a short "referencePatternNotes" field (1-2 sentences) in neutral product language. Do NOT start with phrases like "Reference suggests" or "The reference indicates". Use "No notes supplied" / "May vary between references" / "Awaiting notes" when appropriate.

Return ONLY JSON:
{
  "rows": [
    { "attribute": "Product type", "referencePatternNotes": "..." },
    { "attribute": "Recommended age / audience", "referencePatternNotes": "..." },
    { "attribute": "Material", "referencePatternNotes": "..." },
    { "attribute": "Battery / power", "referencePatternNotes": "..." },
    { "attribute": "Included components", "referencePatternNotes": "..." },
    { "attribute": "Dimensions / weight", "referencePatternNotes": "..." },
    { "attribute": "Keywords / use cases", "referencePatternNotes": "..." }
  ]
}`;

  const { content } = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { maxTokens: 1200 },
  );

  try {
    const parsed = JSON.parse(content) as {
      rows?: Array<{ attribute?: string; referencePatternNotes?: string }>;
    };
    const byAttribute = new Map(
      (parsed.rows ?? []).map((row) => [row.attribute?.trim(), row.referencePatternNotes?.trim()]),
    );

    return INTELLIGENCE_TEMPLATE.map((template) => ({
      attribute: template.attribute,
      allowedUse: template.allowedUse,
      decision: template.decision,
      referencePatternNotes:
        byAttribute.get(template.attribute)
        || (template.attribute === "Product type"
          ? (input.audit.category?.trim() || "selected category")
          : "Awaiting notes"),
    }));
  } catch {
    return INTELLIGENCE_TEMPLATE.map((row) => ({
      ...row,
      referencePatternNotes: row.attribute === "Product type"
        ? (input.audit.category?.trim() || "selected category")
        : "Analysis unavailable — try again.",
    }));
  }
}
