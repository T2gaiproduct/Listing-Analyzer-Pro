import assert from "node:assert/strict";
import {
  EBAY_OAUTH_CORE_SCOPES,
  ebayOAuthScopeParam,
  resolveEbayOAuthScopes,
} from "./ebay-oauth-scopes.js";

const prevExtra = process.env.EBAY_OAUTH_EXTRA_SCOPES;

function testCoreScopesExcludeFinancesAndAnalytics(): void {
  const scopes = resolveEbayOAuthScopes();
  assert.ok(!scopes.some((s) => s.includes("sell.finances")));
  assert.ok(!scopes.some((s) => s.includes("sell.analytics")));
  assert.ok(!scopes.some((s) => s.includes("commerce.catalog.readonly")));
  assert.equal(scopes.length, EBAY_OAUTH_CORE_SCOPES.length);
}

function testExtraScopesFromEnv(): void {
  process.env.EBAY_OAUTH_EXTRA_SCOPES =
    "https://api.ebay.com/oauth/api_scope/sell.finances https://api.ebay.com/oauth/api_scope/sell.finances";
  const scopes = resolveEbayOAuthScopes();
  assert.equal(
    scopes.filter((s) => s.endsWith("/sell.finances")).length,
    1,
  );
  assert.equal(ebayOAuthScopeParam().split(" ").length, EBAY_OAUTH_CORE_SCOPES.length + 1);
}

testCoreScopesExcludeFinancesAndAnalytics();
testExtraScopesFromEnv();

if (prevExtra === undefined) {
  delete process.env.EBAY_OAUTH_EXTRA_SCOPES;
} else {
  process.env.EBAY_OAUTH_EXTRA_SCOPES = prevExtra;
}

console.log("ebay-oauth-scopes: ok");
