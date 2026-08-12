export function mapAiProviderError(err: unknown): { httpStatus: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("no credits remaining")
    || lower.includes("insufficient_quota")
    || (lower.includes("billing") && (raw.includes("429") || lower.includes("exceeded")))
  ) {
    return {
      httpStatus: 503,
      message:
        "OpenAI billing credits are exhausted. Add funds to your OpenAI account (Admin → AI Settings) or ask your administrator to update billing.",
    };
  }

  if (raw.includes("429") || lower.includes("rate limit")) {
    return {
      httpStatus: 429,
      message: "AI provider rate limit reached. Please wait a moment and try again.",
    };
  }

  if (lower.includes("api key") || raw.includes("401") || lower.includes("authentication")) {
    return {
      httpStatus: 503,
      message: "OpenAI API key is invalid or missing. Check Admin → AI Settings.",
    };
  }

  if (lower.includes("spend limit") || raw.includes("403")) {
    return {
      httpStatus: 503,
      message: "OpenAI API usage limit reached. Check your OpenAI account billing or try again later.",
    };
  }

  return {
    httpStatus: 500,
    message: raw.trim() || "Content generation failed. Please try again.",
  };
}
