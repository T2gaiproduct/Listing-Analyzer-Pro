const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function submitNewsletterSignup(email: string, source: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error("Email is required");
  }

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
