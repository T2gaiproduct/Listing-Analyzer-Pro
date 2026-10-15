import assert from "node:assert/strict";
import {
  buildWalmartAuthorizeUrl,
  exchangeWalmartAuthorizationCode,
  parseWalmartEnvironment,
  refreshWalmartAccessToken,
  walmartApiBaseUrl,
  walmartTokenUrl,
  WalmartOAuthError,
} from "./walmart-oauth.js";

function testProductionIsDefault(): void {
  assert.equal(parseWalmartEnvironment(undefined), "production");
  assert.equal(parseWalmartEnvironment("production"), "production");
  assert.equal(parseWalmartEnvironment("sandbox"), "sandbox");
}

function testTokenUrls(): void {
  assert.equal(walmartApiBaseUrl("production"), "https://marketplace.walmartapis.com");
  assert.equal(walmartTokenUrl("production"), "https://marketplace.walmartapis.com/v3/token");
  assert.equal(walmartTokenUrl("sandbox"), "https://sandbox.walmartapis.com/v3/token");
}

async function testRefreshTokenPostsBasicAuthAndGrant(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ access_token: "tok_abc", expires_in: 900 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await refreshWalmartAccessToken({
      partnerId: "  partner-1  ",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      environment: "production",
    });
    assert.equal(result.accessToken, "tok_abc");
    assert.equal(result.expiresIn, 900);
    assert.equal(capturedUrl, "https://marketplace.walmartapis.com/v3/token");
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${Buffer.from("client-id:client-secret", "utf8").toString("base64")}`);
    assert.equal(headers["WM_SVC.NAME"], "Walmart Marketplace");
    assert.equal(headers["WM_PARTNER.ID"], "partner-1");
    assert.equal(headers["WM_CONSUMER.ID"], "client-id");
    assert.equal(capturedInit?.body, "grant_type=refresh_token&refresh_token=refresh-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testRefreshTokenSurfacesWalmartError(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ error_description: "Invalid refresh token" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  )) as typeof fetch;

  try {
    await assert.rejects(
      () => refreshWalmartAccessToken({
        partnerId: "partner-1",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "bad-token",
        environment: "sandbox",
      }),
      (err: unknown) => {
        assert.ok(err instanceof WalmartOAuthError);
        assert.match(err.message, /Invalid refresh token/);
        assert.equal(err.status, 401);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testBuildAuthorizeUrlRewritesSandboxAuthorizeHost(): void {
  const prevId = process.env.WALMART_SANDBOX_CLIENT_ID;
  const prevSecret = process.env.WALMART_SANDBOX_CLIENT_SECRET;
  const prevOverride = process.env.WALMART_SANDBOX_OAUTH_AUTHORIZE_URL;
  delete process.env.WALMART_SANDBOX_OAUTH_AUTHORIZE_URL;
  process.env.WALMART_SANDBOX_CLIENT_ID = "app-client-id";
  process.env.WALMART_SANDBOX_CLIENT_SECRET = "app-client-secret";
  try {
    const url = buildWalmartAuthorizeUrl({
      environment: "sandbox",
      redirectUri: "https://test.sellerlens.io/api/walmart/oauth/callback",
      state: "state-abc",
      authorizeEndpoint: "https://login.sandbox.account.wal-mart.com/authorize&clientType=seller",
    });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "login.account.wal-mart.com");
    assert.equal(parsed.searchParams.get("clientType"), "seller");
    assert.equal(parsed.searchParams.get("responseType"), "code");
  } finally {
    if (prevId === undefined) delete process.env.WALMART_SANDBOX_CLIENT_ID;
    else process.env.WALMART_SANDBOX_CLIENT_ID = prevId;
    if (prevSecret === undefined) delete process.env.WALMART_SANDBOX_CLIENT_SECRET;
    else process.env.WALMART_SANDBOX_CLIENT_SECRET = prevSecret;
    if (prevOverride === undefined) delete process.env.WALMART_SANDBOX_OAUTH_AUTHORIZE_URL;
    else process.env.WALMART_SANDBOX_OAUTH_AUTHORIZE_URL = prevOverride;
  }
}

function testBuildAuthorizeUrlMergesAppLoginEndpoint(): void {
  const prevId = process.env.WALMART_SANDBOX_CLIENT_ID;
  const prevSecret = process.env.WALMART_SANDBOX_CLIENT_SECRET;
  process.env.WALMART_SANDBOX_CLIENT_ID = "app-client-id";
  process.env.WALMART_SANDBOX_CLIENT_SECRET = "app-client-secret";
  try {
    const url = buildWalmartAuthorizeUrl({
      environment: "sandbox",
      redirectUri: "https://test.sellerlens.io/api/walmart/oauth/callback",
      state: "state-abc",
      authorizeEndpoint: "https://login.account.wal-mart.com/authorize&clientType=seller",
    });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "login.account.wal-mart.com");
    assert.equal(parsed.searchParams.get("clientType"), "seller");
    assert.equal(parsed.searchParams.get("clientId"), "app-client-id");
    assert.equal(parsed.searchParams.get("scope"), "openId");
  } finally {
    if (prevId === undefined) delete process.env.WALMART_SANDBOX_CLIENT_ID;
    else process.env.WALMART_SANDBOX_CLIENT_ID = prevId;
    if (prevSecret === undefined) delete process.env.WALMART_SANDBOX_CLIENT_SECRET;
    else process.env.WALMART_SANDBOX_CLIENT_SECRET = prevSecret;
  }
}

function testBuildAuthorizeUrlIncludesParams(): void {
  const prevId = process.env.WALMART_PRODUCTION_CLIENT_ID;
  const prevSecret = process.env.WALMART_PRODUCTION_CLIENT_SECRET;
  process.env.WALMART_PRODUCTION_CLIENT_ID = "app-client-id";
  process.env.WALMART_PRODUCTION_CLIENT_SECRET = "app-client-secret";
  try {
    const url = buildWalmartAuthorizeUrl({
      environment: "production",
      redirectUri: "https://sellerlens.io/api/walmart/oauth/callback",
      state: "state-abc",
    });
    assert.match(url, /^https:\/\/login\.account\.wal-mart\.com\/authorize\?/);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("responseType"), "code");
    assert.equal(parsed.searchParams.get("clientId"), "app-client-id");
    assert.equal(parsed.searchParams.get("redirectUri"), "https://sellerlens.io/api/walmart/oauth/callback");
    assert.equal(parsed.searchParams.get("state"), "state-abc");
    assert.equal(parsed.searchParams.get("clientType"), "seller");
    assert.equal(parsed.searchParams.get("scope"), "openId");
    assert.ok(parsed.searchParams.get("nonce"));
  } finally {
    if (prevId === undefined) delete process.env.WALMART_PRODUCTION_CLIENT_ID;
    else process.env.WALMART_PRODUCTION_CLIENT_ID = prevId;
    if (prevSecret === undefined) delete process.env.WALMART_PRODUCTION_CLIENT_SECRET;
    else process.env.WALMART_PRODUCTION_CLIENT_SECRET = prevSecret;
  }
}

async function testExchangeAuthorizationCode(): Promise<void> {
  const prevId = process.env.WALMART_PRODUCTION_CLIENT_ID;
  const prevSecret = process.env.WALMART_PRODUCTION_CLIENT_SECRET;
  process.env.WALMART_PRODUCTION_CLIENT_ID = "app-client-id";
  process.env.WALMART_PRODUCTION_CLIENT_SECRET = "app-client-secret";
  const originalFetch = globalThis.fetch;
  let capturedBody = "";
  globalThis.fetch = (async (_input, init) => {
    capturedBody = String(init?.body ?? "");
    return new Response(JSON.stringify({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 900,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await exchangeWalmartAuthorizationCode({
      environment: "production",
      code: "auth-code-1",
      redirectUri: "https://sellerlens.io/api/walmart/oauth/callback",
      sellerId: "seller-99",
    });
    assert.equal(result.accessToken, "access-1");
    assert.equal(result.refreshToken, "refresh-1");
    assert.match(capturedBody, /grant_type=authorization_code/);
    assert.match(capturedBody, /code=auth-code-1/);
    assert.match(capturedBody, /redirect_uri=/);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevId === undefined) delete process.env.WALMART_PRODUCTION_CLIENT_ID;
    else process.env.WALMART_PRODUCTION_CLIENT_ID = prevId;
    if (prevSecret === undefined) delete process.env.WALMART_PRODUCTION_CLIENT_SECRET;
    else process.env.WALMART_PRODUCTION_CLIENT_SECRET = prevSecret;
  }
}

testProductionIsDefault();
testTokenUrls();
testBuildAuthorizeUrlRewritesSandboxAuthorizeHost();
testBuildAuthorizeUrlMergesAppLoginEndpoint();
testBuildAuthorizeUrlIncludesParams();
await testRefreshTokenPostsBasicAuthAndGrant();
await testRefreshTokenSurfacesWalmartError();
await testExchangeAuthorizationCode();
console.log("walmart-oauth: ok");
