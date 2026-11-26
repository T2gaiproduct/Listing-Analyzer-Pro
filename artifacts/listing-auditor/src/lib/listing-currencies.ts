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

const LISTING_CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU",
  AED: "en-AE",
  SGD: "en-SG",
  JPY: "ja-JP",
};

export function normalizeListingCurrency(code: string | null | undefined): string {
  const trimmed = code?.trim().toUpperCase();
  if (trimmed && /^[A-Z]{3}$/.test(trimmed)) return trimmed;
  return "USD";
}

/** Currencies whose locale symbol is a bare `$` — show ISO code so they are not mistaken for USD. */
const DOLLAR_SYMBOL_CURRENCIES = new Set(["CAD", "AUD", "SGD", "HKD", "NZD", "MXN"]);

/** Format money for any ISO 4217 listing currency (not US/$ only). */
export function formatListingMoney(
  value: number,
  currency: string | null | undefined,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
): string {
  const code = normalizeListingCurrency(currency);
  const locale = LISTING_CURRENCY_LOCALES[code] ?? "en-US";
  const maximumFractionDigits = options?.maximumFractionDigits
    ?? (code === "JPY" ? 0 : 2);
  const minimumFractionDigits = options?.minimumFractionDigits
    ?? (code === "JPY" ? 0 : 0);
  const currencyDisplay = DOLLAR_SYMBOL_CURRENCIES.has(code) ? "code" : "symbol";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    })}`;
  }
}
