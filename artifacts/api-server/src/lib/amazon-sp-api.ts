import crypto from "node:crypto";
import type { AmazonSpSettings } from "./amazon-sp-settings.js";
import { resolveSpMarketplaceId, spApiHost } from "./amazon-sp-settings.js";

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

export interface LwaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export function oauthStateSecret(): string {
  return process.env.AMAZON_OAUTH_STATE_SECRET
    ?? process.env.CLERK_SECRET_KEY
    ?? "amazon-oauth-dev-secret";
}

export function createOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseOAuthState(state: string): { userId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; ts?: number };
    if (!data.userId || !data.ts) return null;
    if (Date.now() - data.ts > 30 * 60 * 1000) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export function buildAmazonAuthorizeUrl(settings: AmazonSpSettings, state: string): string {
  const applicationId = settings.applicationId.trim() || settings.clientId.trim();
  const params = new URLSearchParams({
    application_id: applicationId,
    state,
    redirect_uri: settings.redirectUri,
    version: "beta",
  });
  const base = settings.sandbox
    ? "https://sellercentral.amazon.com/apps/authorize/consent"
    : "https://sellercentral.amazon.com/apps/authorize/consent";
  return `${base}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  settings: AmazonSpSettings,
  code: string,
): Promise<LwaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    redirect_uri: settings.redirectUri,
  });
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({})) as LwaTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Token exchange failed (${res.status})`);
  }
  if (!json.refresh_token) {
    throw new Error("Amazon did not return a refresh token. Re-authorize with consent.");
  }
  return json;
}

export async function refreshAccessToken(
  settings: AmazonSpSettings,
  refreshToken: string,
): Promise<LwaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
  });
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({})) as LwaTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Token refresh failed (${res.status})`);
  }
  return json;
}

function normalizeLwaClientId(clientId: string): string {
  return clientId.trim();
}

export function normalizeLwaClientSecret(clientSecret: string): string {
  return clientSecret.trim().replace(/^secret\s+/i, "");
}

function formatLwaAuthError(error: string, description?: string): string {
  if (error === "invalid_client" || description === "Client authentication failed") {
    return [
      "Amazon rejected the LWA Client ID or Client Secret.",
      "Paste only the secret value (amzn1.oa2-cs.v1.…), not the word \"Secret\" before it.",
      "Use the Client identifier (amzn1.application-oa2-client.…), not the SP-API Application ID.",
      "Copy the current Client secret from Seller Central → Apps & Services → Develop Apps → LWA credentials.",
    ].join(" ");
  }
  return description ?? error;
}

export async function testAmazonSpConnection(settings: AmazonSpSettings): Promise<{ ok: boolean; message: string }> {
  const clientId = normalizeLwaClientId(settings.clientId);
  const clientSecret = normalizeLwaClientSecret(settings.clientSecret);
  const redirectUri = settings.redirectUri.trim();

  if (!clientId || !clientSecret) {
    const missing = [
      !clientId ? "Client ID" : null,
      !clientSecret ? "Client Secret" : null,
    ].filter(Boolean).join(" and ");
    return {
      ok: false,
      message: `${missing} required. Enter your LWA credentials and click Save settings before testing.`,
    };
  }
  if (!clientId.startsWith("amzn1.application-oa2-client.")) {
    return {
      ok: false,
      message: "Client ID must be the LWA Client identifier (starts with amzn1.application-oa2-client.), not the SP-API App ID.",
    };
  }
  if (!redirectUri) {
    return { ok: false, message: "OAuth redirect URI is required." };
  }
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "sellingpartnerapi::notifications",
    });
    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
    if (res.ok) {
      return {
        ok: true,
        message: settings.sandbox
          ? "LWA credentials accepted (sandbox mode). Connect a seller account to publish."
          : "LWA credentials accepted.",
      };
    }
    const err = await res.json().catch(() => ({})) as { error_description?: string; error?: string };
    const scopeRejected = err.error === "invalid_scope"
      || err.error_description?.toLowerCase().includes("scope");
    if (scopeRejected) {
      return {
        ok: true,
        message: settings.sandbox
          ? "LWA Client ID and Secret are valid (sandbox mode). Add AWS IAM keys to enable publishing."
          : "LWA Client ID and Secret are valid. Add AWS IAM keys to enable publishing.",
      };
    }
    const message = formatLwaAuthError(err.error ?? "error", err.error_description);
    return { ok: false, message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection test failed" };
  }
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function signAwsRequest(opts: {
  method: string;
  host: string;
  path: string;
  query?: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}): Record<string, string> {
  const region = opts.region ?? "us-east-1";
  const service = "execute-api";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(opts.body);
  const canonicalQuery = opts.query ?? "";
  const canonicalHeaders = [
    `host:${opts.host}`,
    `x-amz-date:${amzDate}`,
    ...(opts.sessionToken ? [`x-amz-security-token:${opts.sessionToken}`] : []),
  ].join("\n") + "\n";
  const signedHeaders = opts.sessionToken ? "host;x-amz-date;x-amz-security-token" : "host;x-amz-date";
  const canonicalRequest = [
    opts.method,
    opts.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = getSignatureKey(opts.secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = {
    Host: opts.host,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };
  if (opts.sessionToken) headers["x-amz-security-token"] = opts.sessionToken;
  return headers;
}

async function assumeRoleIfNeeded(settings: AmazonSpSettings): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string }> {
  if (!settings.awsRoleArn.trim()) {
    return { accessKeyId: settings.awsAccessKeyId, secretAccessKey: settings.awsSecretAccessKey };
  }
  const host = "sts.amazonaws.com";
  const query = new URLSearchParams({
    Action: "AssumeRole",
    RoleArn: settings.awsRoleArn,
    RoleSessionName: "sellerlens-sp-api",
    Version: "2011-06-15",
    DurationSeconds: "3600",
  }).toString();
  const body = "";
  const signed = signAwsRequest({
    method: "GET",
    host,
    path: "/",
    query,
    body,
    accessKeyId: settings.awsAccessKeyId,
    secretAccessKey: settings.awsSecretAccessKey,
  });
  const res = await fetch(`https://${host}/?${query}`, { method: "GET", headers: signed });
  const text = await res.text();
  if (!res.ok) throw new Error(`AWS AssumeRole failed (${res.status})`);
  const keyMatch = text.match(/<AccessKeyId>([^<]+)<\/AccessKeyId>/);
  const secretMatch = text.match(/<SecretAccessKey>([^<]+)<\/SecretAccessKey>/);
  const tokenMatch = text.match(/<SessionToken>([^<]+)<\/SessionToken>/);
  if (!keyMatch?.[1] || !secretMatch?.[1] || !tokenMatch?.[1]) {
    throw new Error("AWS AssumeRole response missing credentials");
  }
  return {
    accessKeyId: keyMatch[1],
    secretAccessKey: secretMatch[1],
    sessionToken: tokenMatch[1],
  };
}

export async function spApiRequest<T>(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  method: string;
  path: string;
  body?: unknown;
  accessToken?: string;
}): Promise<T> {
  if (!opts.settings.awsAccessKeyId.trim() || !opts.settings.awsSecretAccessKey.trim()) {
    throw new Error("AWS access credentials are required for SP-API. Add them in Admin → Amazon Settings.");
  }
  const token = opts.accessToken
    ?? (await refreshAccessToken(opts.settings, opts.refreshToken)).access_token;
  const host = spApiHost(opts.settings).replace("https://", "");
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  const creds = await assumeRoleIfNeeded(opts.settings);
  const signed = signAwsRequest({
    method: opts.method,
    host,
    path: opts.path,
    body: bodyStr,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  });
  const res = await fetch(`https://${host}${opts.path}`, {
    method: opts.method,
    headers: {
      ...signed,
      "Content-Type": "application/json",
      "x-amz-access-token": token,
    },
    body: opts.body ? bodyStr : undefined,
  });
  const json = await res.json().catch(() => ({})) as T & { errors?: Array<{ message?: string }> };
  if (!res.ok) {
    const msg = json.errors?.[0]?.message ?? `SP-API request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export interface PublishListingInput {
  sellerId: string;
  sku: string;
  marketplaceCode: string;
  title: string;
  brand: string;
  bullets: string[];
  description: string;
  keywords: string;
  imageUrls: string[];
}

export async function publishListingToAmazon(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  input: PublishListingInput;
}): Promise<unknown> {
  const marketplaceId = resolveSpMarketplaceId(opts.input.marketplaceCode);
  const lang = opts.input.marketplaceCode === "JP" ? "ja_JP" : "en_US";
  const attributes: Record<string, Array<Record<string, string>>> = {
    item_name: [{ value: opts.input.title, language_tag: lang, marketplace_id: marketplaceId }],
    brand: [{ value: opts.input.brand, language_tag: lang, marketplace_id: marketplaceId }],
    product_description: [{ value: opts.input.description, language_tag: lang, marketplace_id: marketplaceId }],
    generic_keyword: [{ value: opts.input.keywords, language_tag: lang, marketplace_id: marketplaceId }],
  };
  opts.input.bullets.slice(0, 5).forEach((bullet, i) => {
    attributes[`bullet_point${i + 1}`] = [{ value: bullet, language_tag: lang, marketplace_id: marketplaceId }];
  });
  if (opts.input.imageUrls[0]) {
    attributes.main_product_image_locator = [{
      media_location: opts.input.imageUrls[0],
      marketplace_id: marketplaceId,
    } as unknown as Record<string, string>];
  }
  opts.input.imageUrls.slice(1, 9).forEach((url, i) => {
    attributes[`other_product_image_locator_${i + 1}`] = [{
      media_location: url,
      marketplace_id: marketplaceId,
    } as unknown as Record<string, string>];
  });

  const path = `/listings/2021-08-01/items/${encodeURIComponent(opts.input.sellerId)}/${encodeURIComponent(opts.input.sku)}`;
  const body = {
    productType: "PRODUCT",
    requirements: "LISTING",
    attributes,
  };
  return spApiRequest({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    method: "PUT",
    path: `${path}?marketplaceIds=${marketplaceId}`,
    body,
  });
}
