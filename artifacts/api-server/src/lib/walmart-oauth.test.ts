import assert from "node:assert/strict";
import {
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

testProductionIsDefault();
testTokenUrls();
await testRefreshTokenPostsBasicAuthAndGrant();
await testRefreshTokenSurfacesWalmartError();
console.log("walmart-oauth: ok");
