import type { EbayAppCredentials, EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import {
  ebayOAuthEndpoints,
  getEbayAppCredentials,
  getEbayClientCredentials,
} from "./ebay-oauth-config.js";
import { ebayOAuthScopeParam } from "./ebay-oauth-scopes.js";

export type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
};

const APPLICATION_TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";

type CachedApplicationToken = {
  accessToken: string;
  expiresAtMs: number;
};

const applicationTokenCache = new Map<EbayOAuthEnvironment, CachedApplicationToken>();

function basicAuthHeader(creds: Pick<EbayAppCredentials, "clientId" | "clientSecret">): string {
  const encoded = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

/** Application (client_credentials) token for public Browse API calls. */
export async function getEbayApplicationToken(
  environment: EbayOAuthEnvironment,
): Promise<string> {
  const cached = applicationTokenCache.get(environment);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const creds = getEbayClientCredentials(environment);
  if (!creds) {
    throw new Error(`eBay ${environment} client credentials are not configured.`);
  }

  const { tokenUrl } = ebayOAuthEndpoints(environment);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: APPLICATION_TOKEN_SCOPE,
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay application token request failed (${res.status})`);
  }
  const data = JSON.parse(text) as EbayTokenResponse;
  const accessToken = data.access_token?.trim();
  if (!accessToken) {
    throw new Error("eBay application token response missing access_token.");
  }
  const expiresInSec = typeof data.expires_in === "number" && data.expires_in > 0
    ? data.expires_in
    : 7200;
  applicationTokenCache.set(environment, {
    accessToken,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  });
  return accessToken;
}

export function buildEbayAuthorizeUrl(
  environment: EbayOAuthEnvironment,
  state: string,
): string {
  const creds = getEbayAppCredentials(environment);
  if (!creds) {
    throw new Error(`eBay ${environment} OAuth is not configured on the server.`);
  }
  const { authorizeUrl } = ebayOAuthEndpoints(environment);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: creds.ruName,
    response_type: "code",
    scope: ebayOAuthScopeParam(),
    state,
  });
  return `${authorizeUrl}?${params.toString()}`;
}

async function postToken(
  environment: EbayOAuthEnvironment,
  body: URLSearchParams,
): Promise<EbayTokenResponse> {
  const creds = getEbayAppCredentials(environment);
  if (!creds) {
    throw new Error(`eBay ${environment} OAuth is not configured on the server.`);
  }
  const { tokenUrl } = ebayOAuthEndpoints(environment);
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay token request failed (${res.status})`);
  }
  return JSON.parse(text) as EbayTokenResponse;
}

export async function exchangeEbayAuthorizationCode(
  environment: EbayOAuthEnvironment,
  code: string,
): Promise<EbayTokenResponse> {
  const creds = getEbayAppCredentials(environment);
  if (!creds) {
    throw new Error(`eBay ${environment} OAuth is not configured on the server.`);
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: creds.ruName,
  });
  return postToken(environment, body);
}

export async function refreshEbayAccessToken(
  environment: EbayOAuthEnvironment,
  refreshToken: string,
): Promise<EbayTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: ebayOAuthScopeParam(),
  });
  return postToken(environment, body);
}

export type EbayIdentityUser = {
  userId?: string;
  username?: string;
};

export async function fetchEbayIdentityUser(
  environment: EbayOAuthEnvironment,
  accessToken: string,
): Promise<EbayIdentityUser> {
  const { apiBaseUrl } = ebayOAuthEndpoints(environment);
  const res = await fetch(`${apiBaseUrl}/commerce/identity/v1/user/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay identity request failed (${res.status})`);
  }
  const data = JSON.parse(text) as { userId?: string; username?: string };
  return {
    userId: data.userId,
    username: data.username,
  };
}
