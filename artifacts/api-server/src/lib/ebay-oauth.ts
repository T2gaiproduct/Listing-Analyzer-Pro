import type { EbayAppCredentials, EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints, getEbayAppCredentials } from "./ebay-oauth-config.js";
import { ebayOAuthScopeParam } from "./ebay-oauth-scopes.js";

export type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
};

function basicAuthHeader(creds: EbayAppCredentials): string {
  const encoded = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
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
