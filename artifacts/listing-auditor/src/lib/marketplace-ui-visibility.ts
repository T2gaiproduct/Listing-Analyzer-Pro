/**
 * Temporary UI hide for marketplace branding (icons + labels).
 *
 * Set a platform to `false` (or set MARKETPLACES_NAV_UI_COMMENTED_OUT to false)
 * to restore that UI — integration/API code is unchanged.
 *
 * Original intent: comment-out visibility without deleting connect/publish logic.
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

/** Sidebar "Marketplaces" link and Product Explorer "MARKETPLACES" workflow step. */
export const MARKETPLACES_NAV_UI_COMMENTED_OUT = true;

const ALIASES: Record<string, keyof typeof MARKETPLACE_UI_COMMENTED_OUT> = {
  amazon: "Amazon",
  ebay: "eBay",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  walmart: "Walmart",
};

export function normalizeMarketplaceUiName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? raw.trim();
}

export function isMarketplaceUiCommentedOut(marketplace: string): boolean {
  const normalized = normalizeMarketplaceUiName(marketplace);
  const flagged = MARKETPLACE_UI_COMMENTED_OUT[normalized as keyof typeof MARKETPLACE_UI_COMMENTED_OUT];
  return flagged === true;
}

export function filterMarketplacesVisibleInUi<T extends string>(names: readonly T[]): T[] {
  return names.filter((name) => !isMarketplaceUiCommentedOut(name));
}

export function shouldShowMarketplaceLogoStrip(): boolean {
  return filterMarketplacesVisibleInUi(["Amazon", "Shopify", "WooCommerce"] as const).length > 0;
}

export function shouldShowProductMarketplacesWorkflowStep(): boolean {
  if (MARKETPLACES_NAV_UI_COMMENTED_OUT) return false;
  return filterMarketplacesVisibleInUi(["Amazon", "Shopify", "WooCommerce", "eBay"] as const).length > 0;
}
