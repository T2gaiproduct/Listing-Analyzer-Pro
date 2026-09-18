import { z } from "zod/v4";

export const REFERENCE_RESEARCH_SLOT_COUNT = 6;

export const referenceIntelligenceDecisionSchema = z.enum([
  "safe_research",
  "seller_confirmation",
  "ask_seller",
  "product_evidence_required",
  "research_only",
]);

export type ReferenceIntelligenceDecision = z.infer<typeof referenceIntelligenceDecisionSchema>;

export const referenceIntelligenceRowSchema = z.object({
  attribute: z.string(),
  referencePatternNotes: z.string(),
  allowedUse: z.string(),
  decision: referenceIntelligenceDecisionSchema,
});

export type ReferenceIntelligenceRow = z.infer<typeof referenceIntelligenceRowSchema>;

export const referenceResearchSlotSchema = z.object({
  url: z.string(),
  notes: z.string(),
});

export type ReferenceResearchSlot = z.infer<typeof referenceResearchSlotSchema>;

export const sellerProductDetailSchema = z.object({
  attribute: z.string(),
  value: z.string(),
});

export type SellerProductDetail = z.infer<typeof sellerProductDetailSchema>;

export const SELLER_PRODUCT_DETAIL_MAX = 24;

export const referenceResearchDataSchema = z.object({
  slots: z.array(referenceResearchSlotSchema).max(REFERENCE_RESEARCH_SLOT_COUNT),
  intelligence: z.array(referenceIntelligenceRowSchema).optional(),
  /** Seller-confirmed specs (material, dimensions, etc.) — shown as-is on listing preview. */
  productDetails: z.array(sellerProductDetailSchema).max(SELLER_PRODUCT_DETAIL_MAX).optional(),
  analyzedAt: z.string().optional(),
  fetchErrors: z
    .array(z.object({ index: z.number().int(), message: z.string() }))
    .optional(),
});

export type ReferenceResearchData = z.infer<typeof referenceResearchDataSchema>;

export function emptyReferenceResearchSlots(): ReferenceResearchSlot[] {
  return Array.from({ length: REFERENCE_RESEARCH_SLOT_COUNT }, () => ({ url: "", notes: "" }));
}

export function normalizeReferenceResearchData(
  raw: ReferenceResearchData | null | undefined,
): ReferenceResearchData {
  const slots = emptyReferenceResearchSlots();
  for (let i = 0; i < REFERENCE_RESEARCH_SLOT_COUNT; i++) {
    const slot = raw?.slots?.[i];
    slots[i] = {
      url: slot?.url?.trim() ?? "",
      notes: slot?.notes?.trim() ?? "",
    };
  }
  const productDetails = (raw?.productDetails ?? [])
    .slice(0, SELLER_PRODUCT_DETAIL_MAX)
    .map((row) => ({
      attribute: row.attribute?.trim() ?? "",
      value: row.value?.trim() ?? "",
    }));

  return {
    slots,
    intelligence: raw?.intelligence,
    productDetails: productDetails.length > 0 ? productDetails : undefined,
    analyzedAt: raw?.analyzedAt,
    fetchErrors: raw?.fetchErrors,
  };
}
