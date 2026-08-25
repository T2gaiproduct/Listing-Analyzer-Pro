export type SellermateMessagePhase = "clarifying" | "presenting_options" | "response";

export type SellermateResultOption = {
  id: string;
  title: string;
  summary: string;
  content: string;
};

export type SellermateMessageMetadata = {
  phase: SellermateMessagePhase;
  questions?: string[];
  options?: SellermateResultOption[];
  selectedOptionId?: string;
  toolsUsed?: string[];
};

export function parseSellermateMessageMetadata(raw: string | null | undefined): SellermateMessageMetadata | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as SellermateMessageMetadata;
    if (!parsed || typeof parsed !== "object" || !parsed.phase) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeSellermateMessageMetadata(metadata: SellermateMessageMetadata): string {
  return JSON.stringify(metadata);
}
