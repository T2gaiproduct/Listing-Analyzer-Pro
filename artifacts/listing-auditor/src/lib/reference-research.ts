export const REFERENCE_RESEARCH_SLOT_COUNT = 6;

export type ReferenceIntelligenceDecision =
  | "safe_research"
  | "seller_confirmation"
  | "ask_seller"
  | "product_evidence_required"
  | "research_only";

export type ReferenceIntelligenceRow = {
  attribute: string;
  referencePatternNotes: string;
  allowedUse: string;
  decision: ReferenceIntelligenceDecision;
};

export type ReferenceResearchSlot = {
  url: string;
  notes: string;
};

export type SellerProductDetail = {
  attribute: string;
  value: string;
};

export const SELLER_PRODUCT_DETAIL_MAX = 24;

export type ReferenceResearchData = {
  slots: ReferenceResearchSlot[];
  intelligence?: ReferenceIntelligenceRow[];
  /** Confirmed specs shown on listing preview (material, dimensions, etc.). */
  productDetails?: SellerProductDetail[];
  analyzedAt?: string;
  fetchErrors?: Array<{ index: number; message: string }>;
};

export type ListingPreviewProductDetailRow = {
  attribute: string;
  referencePatternNotes: string;
};

/** Strip research phrasing from AI notes on customer-facing listing preview only. */
export function sanitizeReferenceNotesForListingPreview(notes: string): string {
  let text = notes.trim();
  if (!text) return text;

  const leadIns = [
    /^(the\s+)?references?\s+suggest(s)?\s+(that\s+)?/i,
    /^(the\s+)?references?\s+indicate(s)?\s+(that\s+)?/i,
    /^(the\s+)?references?\s+point(s)?\s+to\s+(the\s+fact\s+that\s+)?/i,
    /^(the\s+)?reference\s+suggest(s)?\s+(that\s+)?/i,
    /^(the\s+)?reference\s+indicates?\s+(that\s+)?/i,
    /^(the\s+)?reference\s+points?\s+to\s+/i,
    /^references?\s+(commonly|often|typically)\s+/i,
  ];

  for (const pattern of leadIns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "");
      break;
    }
  }

  const cleaned = text.trim();
  if (cleaned.length > 0) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return notes.trim();
}

/** AI reference intelligence + seller overrides for listing preview Product details. */
export function mergeListingPreviewProductDetails(
  intelligence: ReferenceIntelligenceRow[] | null | undefined,
  sellerDetails: SellerProductDetail[] | null | undefined,
): ListingPreviewProductDetailRow[] {
  const sellerByKey = new Map<string, { attribute: string; value: string }>();
  for (const row of sellerDetails ?? []) {
    const attribute = row.attribute?.trim() ?? "";
    const value = row.value?.trim() ?? "";
    if (!attribute || !value) continue;
    sellerByKey.set(attribute.toLowerCase(), { attribute, value });
  }

  const seen = new Set<string>();
  const merged: ListingPreviewProductDetailRow[] = [];

  for (const row of intelligence ?? []) {
    const attribute = row.attribute?.trim() ?? "";
    if (!attribute) continue;
    const key = attribute.toLowerCase();
    seen.add(key);
    const seller = sellerByKey.get(key);
    const rawNotes = seller?.value ?? row.referencePatternNotes?.trim() ?? "";
    if (!rawNotes) continue;
    const notes = seller ? rawNotes : sanitizeReferenceNotesForListingPreview(rawNotes);
    merged.push({
      attribute: seller?.attribute ?? attribute,
      referencePatternNotes: notes,
    });
  }

  for (const { attribute, value } of sellerByKey.values()) {
    const key = attribute.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ attribute, referencePatternNotes: value });
  }

  return merged;
}
