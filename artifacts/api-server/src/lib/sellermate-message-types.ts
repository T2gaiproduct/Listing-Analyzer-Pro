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

export type SellermateOrchestratorResponse = {
  phase: SellermateMessagePhase;
  message: string;
  questions?: string[];
  options?: SellermateResultOption[];
  requestTools?: string[];
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

/** Strip markdown emphasis so chat messages display cleanly as plain text. */
export function stripChatMarkdown(text: string): string {
  if (!text) return text;
  let result = text;
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
  result = result.replace(/\*{2,}/g, "");
  return result;
}

export function parseOrchestratorResponse(raw: string): SellermateOrchestratorResponse | null {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  try {
    const parsed = JSON.parse(jsonText) as SellermateOrchestratorResponse;
    if (!parsed?.phase || !parsed.message) return null;
    return parsed;
  } catch {
    return null;
  }
}
