import { getEmailValidationError, normalizeValidEmail } from "@/lib/email-validation";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function submitNewsletterSignup(email: string, source: string): Promise<void> {
  const validationError = getEmailValidationError(email);
  if (validationError) {
    throw new Error(validationError);
  }
  const trimmed = normalizeValidEmail(email)!;

  const res = await fetch(`${basePath}/api/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formType: "newsletter",
      email: trimmed,
      data: { source },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : "Failed to subscribe");
  }
}
