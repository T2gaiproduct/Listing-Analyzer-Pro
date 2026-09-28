/** ISO 4217 codes supported in Product Explorer listing editor (matches store-currency normalization). */
export const LISTING_CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "INR", label: "INR" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "CAD", label: "CAD" },
  { code: "AUD", label: "AUD" },
  { code: "AED", label: "AED" },
  { code: "SGD", label: "SGD" },
  { code: "JPY", label: "JPY" },
];

export function normalizeListingCurrency(code: string | null | undefined): string {
  const trimmed = code?.trim().toUpperCase();
  if (trimmed && /^[A-Z]{3}$/.test(trimmed)) return trimmed;
  return "USD";
}
