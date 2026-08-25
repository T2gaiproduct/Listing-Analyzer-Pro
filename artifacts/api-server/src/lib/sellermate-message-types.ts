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

const VALID_PHASES = new Set<SellermateMessagePhase>(["clarifying", "presenting_options", "response"]);

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }

  return null;
}

function normalizePhase(value: unknown): SellermateMessagePhase {
  if (typeof value === "string" && VALID_PHASES.has(value as SellermateMessagePhase)) {
    return value as SellermateMessagePhase;
  }
  return "response";
}

function coerceOrchestratorResponse(parsed: Record<string, unknown>): SellermateOrchestratorResponse | null {
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  if (!message) return null;

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : undefined;

  const options = Array.isArray(parsed.options)
    ? parsed.options
        .filter((opt): opt is Record<string, unknown> => Boolean(opt) && typeof opt === "object")
        .map((opt, index) => ({
          id: typeof opt.id === "string" ? opt.id : `ex${index + 1}`,
          title: typeof opt.title === "string" ? opt.title : `Example ${index + 1}`,
          summary: typeof opt.summary === "string" ? opt.summary : "",
          content: typeof opt.content === "string" ? opt.content : typeof opt.summary === "string" ? opt.summary : "",
        }))
    : undefined;

  const requestTools = Array.isArray(parsed.requestTools)
    ? parsed.requestTools.filter((tool): tool is string => typeof tool === "string")
    : undefined;

  return {
    phase: normalizePhase(parsed.phase),
    message,
    questions,
    options,
    requestTools,
  };
}

export function parseOrchestratorResponse(raw: string): SellermateOrchestratorResponse | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    const plain = raw.trim();
    if (!plain) return null;
    return { phase: "response", message: plain };
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    return coerceOrchestratorResponse(parsed);
  } catch {
    const plain = raw.trim();
    if (!plain) return null;
    return { phase: "response", message: plain };
  }
}
