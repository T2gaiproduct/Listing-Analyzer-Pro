/** Normalize 6-digit codes from JSON (string or number) or pasted input. */
export function normalizeSixDigitCode(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw)).replace(/\D/g, "").padStart(6, "0").slice(-6);
  }
  if (typeof raw === "string") {
    return raw.replace(/\D/g, "").trim();
  }
  return "";
}
