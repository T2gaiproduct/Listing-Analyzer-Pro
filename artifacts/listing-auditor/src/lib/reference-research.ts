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

export type ReferenceResearchData = {
  slots: ReferenceResearchSlot[];
  intelligence?: ReferenceIntelligenceRow[];
  analyzedAt?: string;
  fetchErrors?: Array<{ index: number; message: string }>;
};
