/** Normalize a store/API currency code to a supported ISO code. */
export function normalizeStoreCurrency(raw: string | null | undefined, fallback = "USD"): string {
  const code = raw?.trim().toUpperCase();
  if (!code) return fallback;
  if (/^[A-Z]{3}$/.test(code)) return code;
  return fallback;
}

export function storeCurrencyFromHostname(hostname: string): string {
  const host = hostname.toLowerCase();
  if (/\.co\.in\b/.test(host) || /\.in$/.test(host)) return "INR";
  if (/\.co\.uk\b/.test(host) || /\.uk$/.test(host)) return "GBP";
  if (/\.com\.au\b/.test(host) || /\.au$/.test(host)) return "AUD";
  if (/\.ca$/.test(host)) return "CAD";
  if (/\.de$/.test(host) || /\.fr$/.test(host) || /\.eu$/.test(host)) return "EUR";
  return "USD";
}
