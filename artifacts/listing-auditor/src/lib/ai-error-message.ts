/** User-facing message for AI/content generation API failures. */
export function formatAiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  }

  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("no credits remaining")
    || lower.includes("insufficient_quota")
    || (lower.includes("billing") && raw.includes("429"))
  ) {
    return "OpenAI billing credits are exhausted. Add funds to your OpenAI account (Admin → AI Settings) or ask your administrator to update billing.";
  }
  if (raw.includes("402") || (lower.includes("insufficient") && lower.includes("credit"))) {
    return "You don't have enough AI credits. Go to Billing to purchase more.";
  }
  if (lower.includes("spend limit") || raw.includes("403")) {
    return "OpenAI API usage limit reached. Check your OpenAI account billing or try again later.";
  }
  if (lower.includes("api key") || raw.includes("401") || lower.includes("authentication")) {
    return "OpenAI API key is invalid or missing. Check AI Settings in the admin panel.";
  }
  if (raw.includes("429") || lower.includes("rate limit")) {
    return "AI provider rate limit reached. Please wait a moment and try again.";
  }

  const httpMatch = /^HTTP \d{3}[^:]*:\s*(.+)$/s.exec(raw);
  if (httpMatch?.[1]) {
    return httpMatch[1].trim();
  }

  return raw.trim() || "Something went wrong. Please try again.";
}
