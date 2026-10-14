export function sessionEmailFromClaims(sessionClaims: Record<string, unknown> | null | undefined): string | null {
  if (!sessionClaims) return null;
  const candidates = [
    sessionClaims.email,
    sessionClaims.primary_email_address,
    sessionClaims.primary_email,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}
