import { randomBytes, randomUUID } from "node:crypto";
import {
  getWalmartAppCredentials,
  normalizeWalmartAuthorizeEndpoint,
  walmartOAuthAuthorizeUrl,
} from "./walmart-oauth-config.js";

export type WalmartEnvironment = "sandbox" | "production";

/** Stored workspace link — OAuth omits clientSecret (server app credentials). */
export type WalmartTokenConnection = {
  partnerId: string;
  refreshToken: string;
  environment: WalmartEnvironment;
  clientId?: string;
  clientSecret?: string;
};

export function parseWalmartEnvironment(raw: unknown): WalmartEnvironment {
  return raw === "sandbox" ? "sandbox" : "production";
}

export function walmartApiBaseUrl(environment: WalmartEnvironment): string {
  return environment === "sandbox"
    ? "https://sandbox.walmartapis.com"
    : "https://marketplace.walmartapis.com";
}

export function walmartTokenUrl(environment: WalmartEnvironment): string {
  return `${walmartApiBaseUrl(environment)}/v3/token`;
}

export function walmartMarketplaceHeaders(input: {
  accessToken: string;
  partnerId: string;
  clientId: string;
}): Record<string, string> {
  return {
    Authorization: `Bearer ${input.accessToken}`,
    Accept: "application/json",
    "WM_SVC.NAME": "Walmart Marketplace",
    "WM_QOS.CORRELATION_ID": randomUUID(),
    "WM_PARTNER.ID": input.partnerId.trim(),
    "WM_CONSUMER.ID": input.clientId.trim(),
  };
}

export class WalmartOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WalmartOAuthError";
  }
}

export function parseWalmartErrorBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string;
      error_description?: string;
      message?: string;
      errors?: Array<{ description?: string; info?: string; message?: string }>;
    };
    const first = parsed.errors?.[0];
    return (
      parsed.error_description
      || parsed.message
      || first?.description
      || first?.info
      || first?.message
      || parsed.error
      || null
    );
  } catch {
    return trimmed.slice(0, 240);
  }
}

export type WalmartResolvedCredentials = {
  partnerId: string;
  clientId: string;
  clientSecret: string;
};

/** OAuth connections use server app credentials; legacy manual connects store per-workspace keys. */
export function resolveWalmartConnectionCredentials(
  connection: WalmartTokenConnection,
): WalmartResolvedCredentials {
  const partnerId = connection.partnerId.trim();
  const refreshToken = connection.refreshToken.trim();
  if (!partnerId || !refreshToken) {
    throw new WalmartOAuthError("Walmart seller connection is incomplete.");
  }

  const storedClientId = connection.clientId?.trim() ?? "";
  const storedClientSecret = connection.clientSecret?.trim() ?? "";
  if (storedClientId && storedClientSecret) {
    return { partnerId, clientId: storedClientId, clientSecret: storedClientSecret };
  }

  const app = getWalmartAppCredentials(connection.environment);
  if (!app) {
    throw new WalmartOAuthError("Walmart OAuth is not configured on the server.");
  }
  return { partnerId, clientId: app.clientId, clientSecret: app.clientSecret };
}

export function walmartConsumerIdForConnection(connection: WalmartTokenConnection): string {
  return resolveWalmartConnectionCredentials(connection).clientId;
}

function randomOAuthNonce(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

function walmartOAuthAuthorizeScope(): string {
  return process.env.WALMART_OAUTH_SCOPE?.trim() || "openId";
}

export function buildWalmartAuthorizeUrl(input: {
  environment: WalmartEnvironment;
  redirectUri: string;
  state: string;
  clientType?: string;
  /** From Walmart App Login URL query `walmartCallbackUri` when seller starts in Seller Center. */
  authorizeEndpoint?: string;
}): string {
  const creds = getWalmartAppCredentials(input.environment);
  if (!creds) {
    throw new WalmartOAuthError(`Walmart ${input.environment} OAuth is not configured on the server.`);
  }
  const authorizeBase =
    (input.authorizeEndpoint ? normalizeWalmartAuthorizeEndpoint(input.authorizeEndpoint) : null)
    ?? walmartOAuthAuthorizeUrl(input.environment);

  const params = new URLSearchParams({
    responseType: "code",
    clientId: creds.clientId,
    redirectUri: input.redirectUri,
    scope: walmartOAuthAuthorizeScope(),
    nonce: randomOAuthNonce(),
    state: input.state,
    clientType: input.clientType?.trim() || "seller",
  });
  return `${authorizeBase}?${params.toString()}`;
}

async function postWalmartToken(input: {
  environment: WalmartEnvironment;
  partnerId: string;
  clientId: string;
  clientSecret: string;
  body: URLSearchParams;
}): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number }> {
  const partnerId = input.partnerId.trim();
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!partnerId || !clientId || !clientSecret) {
    throw new WalmartOAuthError("Walmart Partner ID and app credentials are required.");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const res = await fetch(walmartTokenUrl(input.environment), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "WM_SVC.NAME": "Walmart Marketplace",
      "WM_QOS.CORRELATION_ID": randomUUID(),
      "WM_PARTNER.ID": partnerId,
      "WM_CONSUMER.ID": clientId,
    },
    body: input.body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    const detail = parseWalmartErrorBody(text);
    throw new WalmartOAuthError(
      detail
        ? `Walmart token request failed (${res.status}): ${detail}`
        : `Walmart token request failed (${res.status}).`,
      res.status,
    );
  }

  try {
    return JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number };
  } catch {
    throw new WalmartOAuthError("Walmart token response was not JSON.");
  }
}

export async function exchangeWalmartAuthorizationCode(input: {
  environment: WalmartEnvironment;
  code: string;
  redirectUri: string;
  sellerId: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const app = getWalmartAppCredentials(input.environment);
  if (!app) {
    throw new WalmartOAuthError(`Walmart ${input.environment} OAuth is not configured on the server.`);
  }
  const code = input.code.trim();
  const sellerId = input.sellerId.trim();
  if (!code || !sellerId) {
    throw new WalmartOAuthError("Walmart authorization code and seller ID are required.");
  }

  const parsed = await postWalmartToken({
    environment: input.environment,
    partnerId: sellerId,
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: input.redirectUri,
    }),
  });

  const accessToken = parsed.access_token?.trim();
  const refreshToken = parsed.refresh_token?.trim();
  if (!accessToken || !refreshToken) {
    throw new WalmartOAuthError("Walmart token response did not include access and refresh tokens.");
  }
  return {
    accessToken,
    refreshToken,
    expiresIn: Number(parsed.expires_in ?? 900),
  };
}

export async function refreshWalmartAccessToken(input: {
  partnerId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  environment: WalmartEnvironment;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const refreshToken = input.refreshToken.trim();
  if (!refreshToken) {
    throw new WalmartOAuthError("Walmart refresh token is required.");
  }

  const parsed = await postWalmartToken({
    environment: input.environment,
    partnerId: input.partnerId,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const accessToken = parsed.access_token?.trim();
  if (!accessToken) {
    throw new WalmartOAuthError("Walmart token response did not include an access token.");
  }
  return {
    accessToken,
    expiresIn: Number(parsed.expires_in ?? 900),
  };
}

export async function refreshWalmartAccessTokenForConnection(
  connection: WalmartTokenConnection,
): Promise<{ accessToken: string; expiresIn: number }> {
  const creds = resolveWalmartConnectionCredentials(connection);
  return refreshWalmartAccessToken({
    ...creds,
    refreshToken: connection.refreshToken,
    environment: connection.environment,
  });
}
