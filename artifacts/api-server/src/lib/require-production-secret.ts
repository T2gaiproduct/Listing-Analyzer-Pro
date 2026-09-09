/** Resolve a signing secret; refuse dev fallbacks when NODE_ENV=production. */
export function requireSigningSecret(
  envKeys: string[],
  devFallback: string,
  label: string,
): string {
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${label} must be set in production (${envKeys.join(" or ")})`);
  }
  return devFallback;
}
