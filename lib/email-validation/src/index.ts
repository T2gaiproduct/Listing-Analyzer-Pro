const EMAIL_MAX_LENGTH = 254;

/** Practical RFC-style check — blocks obvious garbage; not a full RFC 5322 parser. */
const EMAIL_PATTERN = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export const INVALID_EMAIL_MESSAGE =
  "Enter a valid email address (for example, you@company.com).";

export function isValidEmailAddress(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;
  const normalized = trimmed.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return false;
  const at = normalized.indexOf("@");
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain || local.includes("..") || domain.includes("..")) return false;
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) return false;
  return true;
}

/** Returns a user-facing error, or null when the value is a valid email. */
export function getEmailValidationError(
  raw: string,
  options?: { required?: boolean },
): string | null {
  const required = options?.required ?? true;
  const trimmed = raw.trim();
  if (!trimmed) return required ? "Email is required" : null;
  if (!isValidEmailAddress(trimmed)) return INVALID_EMAIL_MESSAGE;
  return null;
}

export function normalizeValidEmail(raw: string): string | null {
  const err = getEmailValidationError(raw);
  if (err) return null;
  return raw.trim().toLowerCase();
}

/** For API handlers — returns normalized email or an error message. */
export function parseEmailForApi(raw: unknown): { email: string } | { error: string } {
  if (typeof raw !== "string") {
    return { error: "Email is required" };
  }
  const err = getEmailValidationError(raw);
  if (err) return { error: err };
  return { email: raw.trim().toLowerCase() };
}
