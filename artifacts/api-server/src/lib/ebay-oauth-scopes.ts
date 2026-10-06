/**
 * OAuth scopes requested when a seller connects eBay (platform-wide, not per seller).
 *
 * Only scopes that SellerLens actually uses are included by default. Optional scopes
 * (e.g. sell.finances) often require separate eBay approval; requesting them when
 * they are not enabled on the production keyset causes `invalid_scope` on authorize.
 */
export const EBAY_OAUTH_CORE_SCOPES: readonly string[] = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

/** @deprecated Use {@link resolveEbayOAuthScopes} — kept for callers expecting a static list of core scopes. */
export const EBAY_OAUTH_SCOPES: readonly string[] = EBAY_OAUTH_CORE_SCOPES;

function parseExtraScopesFromEnv(): string[] {
  const raw = process.env.EBAY_OAUTH_EXTRA_SCOPES?.trim();
  if (!raw) return [];
  return raw.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Core scopes plus optional `EBAY_OAUTH_EXTRA_SCOPES` (space-separated full scope URLs). */
export function resolveEbayOAuthScopes(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const scope of [...EBAY_OAUTH_CORE_SCOPES, ...parseExtraScopesFromEnv()]) {
    if (seen.has(scope)) continue;
    seen.add(scope);
    out.push(scope);
  }
  return out;
}

export function ebayOAuthScopeParam(): string {
  return resolveEbayOAuthScopes().join(" ");
}
