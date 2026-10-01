/** OAuth scopes requested when a seller connects eBay (configured by the platform, not per seller). */
export const EBAY_OAUTH_SCOPES: readonly string[] = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.finances",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

export function ebayOAuthScopeParam(): string {
  return EBAY_OAUTH_SCOPES.join(" ");
}
