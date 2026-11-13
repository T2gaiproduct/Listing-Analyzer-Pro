import assert from "node:assert/strict";
import {
  DROPBOX_EXPORT_REQUIRED_SCOPES,
  DROPBOX_OAUTH_TOKEN_URL,
  DropboxOAuthError,
  __setDropboxAccessTokenCacheForTests,
  getDropboxBearerTokenForExport,
  hasDropboxRefreshTokenConfig,
  isDropboxExcelExportEnabled,
  resetDropboxOAuthStateForTests,
  sanitizeDropboxErrorMessage,
  validateDropboxExportScopes,
} from "./dropbox-oauth.js";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): void | Promise<void> {
  const prior: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prior[key] = process.env[key];
    const val = vars[key];
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  resetDropboxOAuthStateForTests();
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      const val = prior[key];
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    resetDropboxOAuthStateForTests();
  }
}

function testSanitizeRedactsTokens(): void {
  const raw = 'error sl.ABC123SECRET and Bearer sl.u.xyz token refresh_token=abc';
  const out = sanitizeDropboxErrorMessage(raw);
  assert.match(out, /\[redacted\]/);
  assert.doesNotMatch(out, /sl\.u\.xyz/);
}

function testValidateScopes(): void {
  validateDropboxExportScopes("files.content.write sharing.write account_info.read");
  assert.throws(
    () => validateDropboxExportScopes("account_info.read"),
    (err: unknown) => {
      assert.ok(err instanceof DropboxOAuthError);
      assert.match(err.message, /files\.content\.write/);
      return true;
    },
  );
  assert.throws(() => validateDropboxExportScopes(undefined));
}

function testIsEnabledWithRefreshConfig(): void {
  withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "refresh-token",
      DROPBOX_ACCESS_TOKEN: undefined,
    },
    () => {
      assert.equal(hasDropboxRefreshTokenConfig(), true);
      assert.equal(isDropboxExcelExportEnabled(), true);
    },
  );
}

function testCachedTokenUsedBeforeExpiry(): void {
  withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "refresh-token",
    },
    async () => {
      __setDropboxAccessTokenCacheForTests("cached_token", Date.now() + 3600_000);
      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        throw new Error("fetch should not run when cache is warm");
      }) as typeof fetch;
      try {
        const token = await getDropboxBearerTokenForExport();
        assert.equal(token, "cached_token");
        assert.equal(fetchCalls, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
}

async function testRefreshPostsToDropboxTokenEndpoint(): Promise<void> {
  await withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "refresh-token",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = "";
      let capturedBody = "";
      globalThis.fetch = (async (input, init) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            access_token: "short_lived_token",
            expires_in: 3600,
            scope: "files.content.write sharing.write",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;
      try {
        const token = await getDropboxBearerTokenForExport();
        assert.equal(token, "short_lived_token");
        assert.equal(capturedUrl, DROPBOX_OAUTH_TOKEN_URL);
        assert.match(capturedBody, /grant_type=refresh_token/);
        assert.match(capturedBody, /refresh_token=refresh-token/);
        assert.match(capturedBody, /client_id=app-key/);
        assert.doesNotMatch(capturedBody, /refresh-token=short_lived/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
}

async function testConcurrentRefreshSingleFlight(): Promise<void> {
  await withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "refresh-token",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      let refreshCalls = 0;
      globalThis.fetch = (async () => {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 50));
        return new Response(
          JSON.stringify({
            access_token: "tok_concurrent",
            expires_in: 3600,
            scope: DROPBOX_EXPORT_REQUIRED_SCOPES.join(" "),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;
      try {
        const tokens = await Promise.all([
          getDropboxBearerTokenForExport(),
          getDropboxBearerTokenForExport(),
          getDropboxBearerTokenForExport(),
        ]);
        assert.deepEqual(tokens, ["tok_concurrent", "tok_concurrent", "tok_concurrent"]);
        assert.equal(refreshCalls, 1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
}

async function testExpiredCacheTriggersNewRefresh(): Promise<void> {
  await withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "refresh-token",
    },
    async () => {
      __setDropboxAccessTokenCacheForTests("stale", Date.now() + 30_000);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response(
        JSON.stringify({
          access_token: "fresh_token",
          expires_in: 7200,
          scope: "files.content.write sharing.write",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
      try {
        const token = await getDropboxBearerTokenForExport();
        assert.equal(token, "fresh_token");
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
}

async function testRefreshErrorIsSanitized(): Promise<void> {
  await withEnv(
    {
      DROPBOX_APP_KEY: "app-key",
      DROPBOX_APP_SECRET: "app-secret",
      DROPBOX_REFRESH_TOKEN: "bad-refresh",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "refresh token is invalid sl.u.LEAKED",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
      try {
        await assert.rejects(
          () => getDropboxBearerTokenForExport(),
          (err: unknown) => {
            assert.ok(err instanceof DropboxOAuthError);
            assert.doesNotMatch(err.message, /sl\.u\.LEAKED/);
            assert.match(err.message, /\[redacted\]|invalid/i);
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
}

testSanitizeRedactsTokens();
testValidateScopes();
testIsEnabledWithRefreshConfig();
testCachedTokenUsedBeforeExpiry();
await testRefreshPostsToDropboxTokenEndpoint();
await testConcurrentRefreshSingleFlight();
await testExpiredCacheTriggersNewRefresh();
await testRefreshErrorIsSanitized();
console.log("dropbox-oauth.test.ts: ok");
