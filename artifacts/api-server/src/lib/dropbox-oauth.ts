/** Dropbox OAuth access token for Excel export uploads (refresh-token flow). */

export const DROPBOX_OAUTH_TOKEN_URL = "https://api.dropbox.com/oauth2/token";

export const DROPBOX_EXPORT_REQUIRED_SCOPES = [
  "files.content.write",
  "sharing.write",
] as const;

const TOKEN_REFRESH_LEEWAY_MS = 60_000;
const DEFAULT_ACCESS_TOKEN_TTL_SEC = 14_400;

export class DropboxOAuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DropboxOAuthError";
    this.status = status;
  }
}

type DropboxTokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

type TokenRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

let accessTokenCache: DropboxTokenCache | null = null;
let refreshInFlight: Promise<string> | null = null;
let scopesValidated = false;

export function readDropboxClientId(): string | null {
  return (
    process.env.DROPBOX_APP_KEY?.trim()
    || process.env.DROPBOX_CLIENT_ID?.trim()
    || null
  );
}

export function readDropboxClientSecret(): string | null {
  return (
    process.env.DROPBOX_APP_SECRET?.trim()
    || process.env.DROPBOX_CLIENT_SECRET?.trim()
    || null
  );
}

export function readDropboxRefreshToken(): string | null {
  return process.env.DROPBOX_REFRESH_TOKEN?.trim() || null;
}

/** @deprecated Console tokens expire in hours — use refresh token env vars. */
export function readDropboxAccessToken(): string | null {
  return process.env.DROPBOX_ACCESS_TOKEN?.trim() || null;
}

export function hasDropboxRefreshTokenConfig(): boolean {
  return Boolean(
    readDropboxRefreshToken()
    && readDropboxClientId()
    && readDropboxClientSecret(),
  );
}

export function isDropboxExcelExportEnabled(): boolean {
  if (hasDropboxRefreshTokenConfig()) return true;
  return readDropboxAccessToken() != null;
}

export function assertDropboxRefreshEnvConfigured(): void {
  const missing: string[] = [];
  if (!readDropboxClientId()) missing.push("DROPBOX_APP_KEY");
  if (!readDropboxClientSecret()) missing.push("DROPBOX_APP_SECRET");
  if (!readDropboxRefreshToken()) missing.push("DROPBOX_REFRESH_TOKEN");
  if (missing.length > 0) {
    throw new DropboxOAuthError(
      `Dropbox export is missing: ${missing.join(", ")}. See DEPLOY.md or scripts/dropbox-oauth-offline.mjs.`,
    );
  }
}

/** Redact bearer tokens and long secrets from Dropbox error text. */
export function sanitizeDropboxErrorMessage(raw: string): string {
  return raw
    .replace(/\bsl\.[A-Za-z0-9_.-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/refresh_token=\S+/gi, "refresh_token=[redacted]")
    .replace(/access_token["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "access_token=[redacted]")
    .slice(0, 400);
}

export function validateDropboxExportScopes(scopeField: string): void {
  const granted = new Set(scopeField.trim().split(/\s+/));
  const missing = DROPBOX_EXPORT_REQUIRED_SCOPES.filter((s) => !granted.has(s));
  if (missing.length > 0) {
    throw new DropboxOAuthError(
      `Dropbox app is missing required scopes: ${missing.join(", ")}. Enable them in the Dropbox App Console and re-run offline OAuth.`,
    );
  }
}

function dropboxExportPrefixForProbe(): string {
  const raw = process.env.DROPBOX_EXPORT_PREFIX?.trim() || "/ecommerce-guru/exports";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

/** Dropbox refresh responses often omit `scope` — verify write + sharing with a one-time probe. */
async function verifyDropboxExportScopesWithProbe(accessToken: string): Promise<void> {
  const probePath = `${dropboxExportPrefixForProbe()}/.export-scope-probe.txt`;
  const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: probePath,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: Buffer.from("scope-check", "utf8"),
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    const safe = sanitizeDropboxErrorMessage(errText);
    if (/insufficient_scope|missing_scope/i.test(safe)) {
      throw new DropboxOAuthError(
        `Dropbox token cannot upload files. Enable app permissions ${DROPBOX_EXPORT_REQUIRED_SCOPES.join(", ")} and re-run scripts/dropbox-oauth-offline.mjs.`,
      );
    }
    throw new DropboxOAuthError(safe || `Dropbox scope probe upload failed (${uploadRes.status})`);
  }

  try {
    const shareRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: probePath, direct_only: true }),
    });
    if (!shareRes.ok) {
      const errText = await shareRes.text();
      const safe = sanitizeDropboxErrorMessage(errText);
      if (/insufficient_scope|missing_scope|not authorized/i.test(safe)) {
        throw new DropboxOAuthError(
          `Dropbox token cannot manage shared links (needs sharing.write). Re-run offline OAuth with that scope enabled.`,
        );
      }
    }
  } finally {
    await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: probePath }),
    }).catch(() => undefined);
  }
}

async function ensureDropboxExportScopesValidated(
  accessToken: string,
  scopeField: string | undefined,
): Promise<void> {
  if (scopesValidated) return;
  if (scopeField?.trim()) {
    validateDropboxExportScopes(scopeField);
    scopesValidated = true;
    return;
  }
  await verifyDropboxExportScopesWithProbe(accessToken);
  scopesValidated = true;
}

function readCachedAccessToken(): string | null {
  if (!accessTokenCache) return null;
  if (Date.now() >= accessTokenCache.expiresAtMs - TOKEN_REFRESH_LEEWAY_MS) {
    return null;
  }
  return accessTokenCache.accessToken;
}

function storeAccessToken(accessToken: string, expiresInSec: number): string {
  const ttl = Number.isFinite(expiresInSec) && expiresInSec > 0
    ? expiresInSec
    : DEFAULT_ACCESS_TOKEN_TTL_SEC;
  accessTokenCache = {
    accessToken,
    expiresAtMs: Date.now() + ttl * 1000,
  };
  return accessToken;
}

async function requestRefreshedAccessToken(): Promise<string> {
  assertDropboxRefreshEnvConfigured();
  const refreshToken = readDropboxRefreshToken()!;
  const clientId = readDropboxClientId()!;
  const clientSecret = readDropboxClientSecret()!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(DROPBOX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  let data: TokenRefreshResponse = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new DropboxOAuthError(
      sanitizeDropboxErrorMessage(text) || `Dropbox token refresh HTTP ${res.status}`,
      res.status,
    );
  }

  if (!res.ok || !data.access_token) {
    const detail = sanitizeDropboxErrorMessage(
      data.error_description || data.error || text,
    );
    throw new DropboxOAuthError(
      detail || `Dropbox token refresh failed (${res.status}). Re-run scripts/dropbox-oauth-offline.mjs.`,
      res.status,
    );
  }

  await ensureDropboxExportScopesValidated(data.access_token, data.scope);

  return storeAccessToken(data.access_token, Number(data.expires_in));
}

async function resolveRefreshAccessToken(): Promise<string> {
  const cached = readCachedAccessToken();
  if (cached) return cached;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = requestRefreshedAccessToken().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Bearer token for Dropbox export API calls. */
export async function getDropboxBearerTokenForExport(): Promise<string> {
  if (hasDropboxRefreshTokenConfig()) {
    return resolveRefreshAccessToken();
  }
  const staticToken = readDropboxAccessToken();
  if (staticToken) return staticToken;
  throw new DropboxOAuthError("Dropbox export is not configured.");
}

export function invalidateDropboxAccessTokenCache(): void {
  accessTokenCache = null;
  scopesValidated = false;
}

/** Tests / dev — reset in-memory OAuth state. */
export function resetDropboxOAuthStateForTests(): void {
  accessTokenCache = null;
  refreshInFlight = null;
  scopesValidated = false;
}

/** @internal Tests with a fixed cache without calling Dropbox. */
export function __setDropboxAccessTokenCacheForTests(
  accessToken: string,
  expiresAtMs: number,
): void {
  accessTokenCache = { accessToken, expiresAtMs };
}
