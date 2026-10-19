/**
 * Temporary hide marketplace **logos and brand names** in the UI only.
 * Connect, import, publish, nav, and workflow features stay enabled.
 *
 * Set a platform to `false` to show its logo and name again.
 */

export const MARKETPLACE_UI_COMMENTED_OUT: Record<
  "Amazon" | "eBay" | "Shopify" | "WooCommerce" | "Walmart",
  boolean
> = {
  Amazon: true,
  eBay: true,
  Shopify: true,
  WooCommerce: true,
  Walmart: true,
};

const ALIASES: Record<string, keyof typeof MARKETPLACE_UI_COMMENTED_OUT> = {
  amazon: "Amazon",
  ebay: "eBay",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  walmart: "Walmart",
};

const BRAND_NAMES = Object.keys(MARKETPLACE_UI_COMMENTED_OUT) as Array<
  keyof typeof MARKETPLACE_UI_COMMENTED_OUT
>;

export function normalizeMarketplaceUiName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? raw.trim();
}

export function isMarketplaceUiCommentedOut(marketplace: string): boolean {
  const normalized = normalizeMarketplaceUiName(marketplace);
  const flagged = MARKETPLACE_UI_COMMENTED_OUT[normalized as keyof typeof MARKETPLACE_UI_COMMENTED_OUT];
  return flagged === true;
}

/** User-visible marketplace name; generic when branding is commented out. */
export function marketplaceUiPublicName(
  marketplace: string,
  genericLabel = "Sales channel",
): string {
  if (isMarketplaceUiCommentedOut(marketplace)) return genericLabel;
  return normalizeMarketplaceUiName(marketplace);
}

/** Replace commented-out brand names in marketing/helper copy (features unchanged). */
export function marketplaceUiScrubBranding(text: string): string {
  let out = text;
  for (const brand of BRAND_NAMES) {
    if (!MARKETPLACE_UI_COMMENTED_OUT[brand]) continue;
    out = out.replace(new RegExp(brand, "gi"), "your sales channel");
    if (brand === "eBay") out = out.replace(/\beBay’s\b/gi, "your channel's");
  }
  return out;
}

export function shouldShowMarketplaceLogoStrip(): boolean {
  return !BRAND_NAMES.every((brand) => MARKETPLACE_UI_COMMENTED_OUT[brand]);
}
