import crypto from "node:crypto";
import zlib from "node:zlib";
import {
  resolveSpMarketplaceId,
  sellerCentralOAuthConsentUrl,
  spApiHost,
  spApiRegionForMarketplaceCode,
  withProductionSpApiSettings,
  canSignSpApiRequests,
  type AmazonSpSettings,
} from "./amazon-sp-settings.js";

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

export function createOAuthState(input: { userId: string; workspaceId?: number | null }): string {
  const payload = Buffer.from(JSON.stringify({
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    ts: Date.now(),
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseOAuthState(state: string): { userId: string; workspaceId: number | null } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      workspaceId?: number | null;
      ts?: number;
    };
    if (!data.userId || !data.ts) return null;
    if (Date.now() - data.ts > 30 * 60 * 1000) return null;
    return {
      userId: data.userId,
      workspaceId: typeof data.workspaceId === "number" ? data.workspaceId : null,
    };
  } catch {
    return null;
  }
}

export function buildAmazonAuthorizeUrl(settings: AmazonSpSettings, state: string): string {
  const applicationId = settings.applicationId.trim();
  if (!applicationId.startsWith("amzn1.sp.solution.")) {
    throw new Error("SP-API Application ID (amzn1.sp.solution…) is required for OAuth.");
  }
  const params = new URLSearchParams({
    application_id: applicationId,
    state,
    redirect_uri: settings.redirectUri,
    version: "beta",
  });
  const base = sellerCentralOAuthConsentUrl(settings.defaultMarketplace);
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

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalizeQueryString(query: string): string {
  if (!query) return "";
  const params = new URLSearchParams(query);
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function splitPathAndQuery(pathWithQuery: string): { path: string; query: string } {
  const queryIndex = pathWithQuery.indexOf("?");
  if (queryIndex < 0) {
    return { path: pathWithQuery, query: "" };
  }
  return {
    path: pathWithQuery.slice(0, queryIndex),
    query: pathWithQuery.slice(queryIndex + 1),
  };
}

export function isSpApiAccessDenied(message: string, status?: number): boolean {
  const lower = message.toLowerCase();
  return status === 403
    || lower.includes("access to requested resource is denied")
    || lower.includes("access denied")
    || lower.includes("not authorized")
    || lower.includes("unauthorized");
}

export function formatSpApiAccessDeniedError(settings: AmazonSpSettings): string {
  const roleHint = settings.awsRoleArn.trim()
    ? " Confirm the AWS Role ARN matches the IAM Role registered in your SP-API app (Solution Provider Portal → Edit App)."
    : " If your SP-API app is registered with an IAM Role ARN (not a User ARN), paste that Role ARN in the AWS Role ARN field. If registered with an IAM User ARN, leave Role ARN blank and use that user's Access Key + Secret.";
  return [
    "Amazon denied SP-API access. Your refresh token is valid, but AWS signing or app roles are wrong.",
    "1) Solution Provider Portal → Seller Lens → Edit App: note the registered IAM User ARN or IAM Role ARN.",
    "2) SellerLens credentials: AWS keys must belong to that exact IAM user. Role ARN only if the app uses role-based auth.",
    "3) Seller Central India (sellercentral.amazon.in/apps/manage) → authorize Seller Lens → enable Product Listing + Inventory and Order Tracking → paste new Atzr| token.",
    `4) Default marketplace = India, Sandbox OFF.${roleHint}`,
  ].join(" ");
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
  const canonicalQuery = canonicalizeQueryString(opts.query ?? "");
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
  region?: "na" | "eu" | "fe";
}): Promise<T> {
  if (!opts.settings.awsAccessKeyId.trim() || !opts.settings.awsSecretAccessKey.trim()) {
    throw new Error("AWS access credentials are required for SP-API. Add them on the Marketplaces page.");
  }
  const token = opts.accessToken
    ?? (await refreshAccessToken(opts.settings, opts.refreshToken)).access_token;
  const host = spApiHost(opts.settings, opts.region ?? "na").replace("https://", "");
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  const creds = await assumeRoleIfNeeded(opts.settings);
  const { path, query } = splitPathAndQuery(opts.path);
  const signed = signAwsRequest({
    method: opts.method,
    host,
    path,
    query,
    body: bodyStr,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  });
  const requestUrl = query ? `https://${host}${path}?${query}` : `https://${host}${path}`;
  const res = await fetch(requestUrl, {
    method: opts.method,
    headers: {
      ...signed,
      "Content-Type": "application/json",
      "x-amz-access-token": token,
    },
    body: opts.body ? bodyStr : undefined,
  });
  const json = await res.json().catch(() => ({})) as T & { errors?: Array<{ message?: string; code?: string }> };
  if (!res.ok) {
    const msg = json.errors?.[0]?.message ?? `SP-API request failed (${res.status})`;
    if (msg.includes("Could not match input arguments") && opts.settings.sandbox) {
      throw new Error(
        "Amazon sandbox mode rejected this request. Open Marketplaces → Edit credentials, uncheck \"Use SP-API sandbox\", save, then import again.",
      );
    }
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

export type AmazonSpOrder = {
  AmazonOrderId: string;
  PurchaseDate: string;
  OrderStatus: string;
  OrderTotal?: { Amount?: string; CurrencyCode?: string };
  BuyerInfo?: { BuyerName?: string };
};

export type AmazonSpOrderItem = {
  OrderItemId: string;
  ASIN?: string;
  SellerSKU?: string;
  Title?: string;
  QuantityOrdered?: number;
  ItemPrice?: { Amount?: string; CurrencyCode?: string };
};

export async function listAmazonOrders(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  marketplaceId: string;
  createdAfter: string;
  maxOrders?: number;
}): Promise<AmazonSpOrder[]> {
  const orders: AmazonSpOrder[] = [];
  const maxOrders = opts.maxOrders ?? 100;
  let nextToken: string | undefined;

  for (let page = 0; page < 20 && orders.length < maxOrders; page += 1) {
    const tokenPart = nextToken ? `&NextToken=${encodeURIComponent(nextToken)}` : "";
    const path = `/orders/v0/orders?MarketplaceIds=${encodeURIComponent(opts.marketplaceId)}&CreatedAfter=${encodeURIComponent(opts.createdAfter)}&MaxResultsPerPage=100${tokenPart}`;
    const data = await spApiRequest<{
      payload?: { Orders?: AmazonSpOrder[]; NextToken?: string };
      Orders?: AmazonSpOrder[];
      NextToken?: string;
    }>({
      settings: opts.settings,
      refreshToken: opts.refreshToken,
      method: "GET",
      path,
    });

    const payload = data.payload ?? data;
    const batch = payload.Orders ?? [];
    orders.push(...batch);
    nextToken = payload.NextToken;
    if (!nextToken || batch.length === 0) break;
  }

  return orders.slice(0, maxOrders);
}

export async function listAmazonOrderItems(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  orderId: string;
}): Promise<AmazonSpOrderItem[]> {
  const items: AmazonSpOrderItem[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const tokenPart = nextToken ? `&NextToken=${encodeURIComponent(nextToken)}` : "";
    const path = `/orders/v0/orders/${encodeURIComponent(opts.orderId)}/orderItems?MaxResultsPerPage=100${tokenPart}`;
    const data = await spApiRequest<{
      payload?: { OrderItems?: AmazonSpOrderItem[]; NextToken?: string };
      OrderItems?: AmazonSpOrderItem[];
      NextToken?: string;
    }>({
      settings: opts.settings,
      refreshToken: opts.refreshToken,
      method: "GET",
      path,
    });

    const payload = data.payload ?? data;
    const batch = payload.OrderItems ?? [];
    items.push(...batch);
    nextToken = payload.NextToken;
    if (!nextToken || batch.length === 0) break;
  }

  return items;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type MerchantListingsReportRow = {
  sku: string;
  title: string;
  asin: string | null;
  priceCents: number | null;
  quantity: number | null;
  imageUrl: string | null;
  status: string | null;
};

export async function fetchSellerMarketplaceParticipations(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  region?: "na" | "eu" | "fe";
  accessToken?: string;
}): Promise<string[]> {
  const settings = withProductionSpApiSettings(opts.settings);
  const regions: Array<"na" | "eu" | "fe"> = opts.region
    ? [opts.region, "fe", "eu", "na"]
    : ["fe", "eu", "na"];

  let lastError: Error | null = null;

  for (const region of [...new Set(regions)]) {
    try {
      const data = await spApiRequest<{
        payload?: Array<{ marketplace?: { id?: string } }>;
      }>({
        settings,
        refreshToken: opts.refreshToken,
        method: "GET",
        path: "/sellers/v1/marketplaceParticipations",
        region,
        accessToken: opts.accessToken,
      });
      const ids = (data.payload ?? [])
        .map((entry) => entry.marketplace?.id?.trim())
        .filter((id): id is string => Boolean(id));
      if (ids.length > 0) return ids;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function fetchMerchantListingsAllDataReport(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  marketplaceCode: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<MerchantListingsReportRow[]> {
  const settings = withProductionSpApiSettings(opts.settings);
  const marketplaceId = resolveSpMarketplaceId(opts.marketplaceCode);
  const region = spApiRegionForMarketplaceCode(opts.marketplaceCode);

  const created = await spApiRequest<{ reportId?: string }>({
    settings,
    refreshToken: opts.refreshToken,
    method: "POST",
    path: "/reports/2021-06-30/reports",
    region,
    body: {
      reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
      marketplaceIds: [marketplaceId],
    },
  });

  const reportId = created.reportId?.trim();
  if (!reportId) {
    throw new Error("Amazon did not return a report id for catalog export.");
  }

  const pollIntervalMs = opts.pollIntervalMs ?? 15_000;
  const maxWaitMs = opts.maxWaitMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + maxWaitMs;
  let reportDocumentId: string | null = null;

  while (Date.now() < deadline) {
    const status = await spApiRequest<{
      processingStatus?: string;
      reportDocumentId?: string;
    }>({
      settings,
      refreshToken: opts.refreshToken,
      method: "GET",
      path: `/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`,
      region,
    });

    const processingStatus = status.processingStatus?.trim().toUpperCase() ?? "";
    if (processingStatus === "DONE") {
      reportDocumentId = status.reportDocumentId?.trim() ?? null;
      break;
    }
    if (processingStatus === "FATAL" || processingStatus === "CANCELLED") {
      throw new Error(`Amazon catalog report failed (${processingStatus}). Try again in Seller Central or contact support.`);
    }

    await sleep(pollIntervalMs);
  }

  if (!reportDocumentId) {
    throw new Error("Amazon catalog report timed out. Try again — large catalogs can take several minutes.");
  }

  const document = await spApiRequest<{
    url?: string;
    compressionAlgorithm?: string;
  }>({
    settings,
    refreshToken: opts.refreshToken,
    method: "GET",
    path: `/reports/2021-06-30/documents/${encodeURIComponent(reportDocumentId)}`,
    region,
  });

  const downloadUrl = document.url?.trim();
  if (!downloadUrl) {
    throw new Error("Amazon did not return a download URL for the catalog report.");
  }

  const downloadRes = await fetch(downloadUrl);
  if (!downloadRes.ok) {
    throw new Error(`Failed to download Amazon catalog report (${downloadRes.status}).`);
  }

  const rawBytes = Buffer.from(await downloadRes.arrayBuffer());
  const decompressed = document.compressionAlgorithm?.trim().toUpperCase() === "GZIP"
    ? zlib.gunzipSync(rawBytes)
    : rawBytes;
  const text = decompressed.toString("utf8");

  return parseMerchantListingsReport(text);
}

function parseMerchantListingsReport(text: string): MerchantListingsReportRow[] {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]!.split("\t").map((header) => header.trim().toLowerCase());
  const indexFor = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const skuIdx = indexFor(["seller-sku", "sku"]);
  const titleIdx = indexFor(["item-name", "title", "product-name"]);
  const asinIdx = indexFor(["asin1", "asin"]);
  const priceIdx = indexFor(["price", "your-price"]);
  const quantityIdx = indexFor(["quantity", "afn-fulfillable-quantity", "mfn-fulfillable-quantity"]);
  const imageIdx = indexFor(["image-url", "main-image-url"]);
  const statusIdx = indexFor(["status", "listing-status"]);

  const rows: MerchantListingsReportRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = lines[lineIndex]!.split("\t");
    const sku = skuIdx >= 0 ? columns[skuIdx]?.trim() : "";
    const title = titleIdx >= 0 ? columns[titleIdx]?.trim() : "";
    if (!sku && !title) continue;

    const asinRaw = asinIdx >= 0 ? columns[asinIdx]?.trim() : "";
    const asin = asinRaw && /^[A-Z0-9]{10}$/i.test(asinRaw) ? asinRaw.toUpperCase() : null;

    let priceCents: number | null = null;
    if (priceIdx >= 0) {
      const priceRaw = columns[priceIdx]?.trim().replace(/[^\d.,-]/g, "").replace(",", "");
      const price = Number.parseFloat(priceRaw);
      if (Number.isFinite(price) && price > 0) {
        priceCents = Math.round(price * 100);
      }
    }

    let quantity: number | null = null;
    if (quantityIdx >= 0) {
      const qtyRaw = columns[quantityIdx]?.trim();
      const qty = Number.parseInt(qtyRaw ?? "", 10);
      if (Number.isFinite(qty)) quantity = qty;
    }

    const imageUrl = imageIdx >= 0 ? columns[imageIdx]?.trim() || null : null;
    const status = statusIdx >= 0 ? columns[statusIdx]?.trim() || null : null;

    rows.push({
      sku: sku || asin || `ROW-${lineIndex}`,
      title: title || sku || asin || "Amazon listing",
      asin,
      priceCents,
      quantity,
      imageUrl,
      status,
    });
  }

  return rows;
}

export async function searchListingsItems(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  sellerId: string;
  marketplaceCode: string;
  maxItems?: number;
}): Promise<MerchantListingsReportRow[]> {
  const settings = withProductionSpApiSettings(opts.settings);
  const marketplaceId = resolveSpMarketplaceId(opts.marketplaceCode);
  const region = spApiRegionForMarketplaceCode(opts.marketplaceCode);
  const maxItems = opts.maxItems ?? 500;
  const rows: MerchantListingsReportRow[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 100 && rows.length < maxItems; page += 1) {
    const queryParams = new URLSearchParams({
      marketplaceIds: marketplaceId,
      pageSize: "20",
      includedData: "summaries,offers,fulfillmentAvailability",
    });
    if (pageToken) queryParams.set("pageToken", pageToken);

    const path = `/listings/2021-08-01/items/${encodeURIComponent(opts.sellerId)}`;
    const query = queryParams.toString();

    const data = await spApiRequest<{
      items?: Array<{
        sku?: string;
        summaries?: Array<{
          marketplaceId?: string;
          asin?: string;
          itemName?: string;
          status?: string[];
          mainImage?: { link?: string };
        }>;
        offers?: Array<{
          marketplaceId?: string;
          price?: { amount?: string };
        }>;
        fulfillmentAvailability?: Array<{ quantity?: number }>;
      }>;
      pagination?: { nextToken?: string };
    }>({
      settings,
      refreshToken: opts.refreshToken,
      method: "GET",
      path: `${path}?${query}`,
      region,
    });

    for (const item of data.items ?? []) {
      const sku = item.sku?.trim() ?? "";
      const summary = item.summaries?.find((entry) => entry.marketplaceId === marketplaceId)
        ?? item.summaries?.[0];
      if (!sku && !summary?.itemName) continue;

      const statuses = summary?.status ?? [];
      let status: string | null = null;
      if (statuses.includes("BUYABLE")) status = "active";
      else if (statuses.length > 0) status = "inactive";

      const offer = item.offers?.find((entry) => entry.marketplaceId === marketplaceId)
        ?? item.offers?.[0];
      let priceCents: number | null = null;
      if (offer?.price?.amount) {
        const price = Number.parseFloat(offer.price.amount);
        if (Number.isFinite(price) && price > 0) {
          priceCents = Math.round(price * 100);
        }
      }

      const quantity = item.fulfillmentAvailability?.[0]?.quantity ?? null;
      const asinRaw = summary?.asin?.trim() ?? "";
      const asin = asinRaw && /^[A-Z0-9]{10}$/i.test(asinRaw) ? asinRaw.toUpperCase() : null;

      rows.push({
        sku: sku || asin || `ROW-${rows.length + 1}`,
        title: summary?.itemName?.trim() || sku || asin || "Amazon listing",
        asin,
        priceCents,
        quantity: typeof quantity === "number" ? quantity : null,
        imageUrl: summary?.mainImage?.link?.trim() || null,
        status,
      });
    }

    pageToken = data.pagination?.nextToken?.trim();
    if (!pageToken) break;
  }

  return rows.slice(0, maxItems);
}

export async function fetchSellerCatalog(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  sellerId: string;
  marketplaceCode: string;
}): Promise<MerchantListingsReportRow[]> {
  let reportsError: Error | null = null;

  try {
    const reportRows = await fetchMerchantListingsAllDataReport({
      settings: opts.settings,
      refreshToken: opts.refreshToken,
      marketplaceCode: opts.marketplaceCode,
    });
    if (reportRows.length > 0) return reportRows;
  } catch (err) {
    reportsError = err instanceof Error ? err : new Error(String(err));
    if (!isSpApiAccessDenied(reportsError.message)) {
      throw reportsError;
    }
  }

  try {
    const listingRows = await searchListingsItems({
      settings: opts.settings,
      refreshToken: opts.refreshToken,
      sellerId: opts.sellerId,
      marketplaceCode: opts.marketplaceCode,
    });
    if (listingRows.length > 0) return listingRows;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isSpApiAccessDenied(message) && !reportsError) {
      throw err instanceof Error ? err : new Error(message);
    }
  }

  if (reportsError && !isSpApiAccessDenied(reportsError.message)) {
    throw reportsError;
  }

  throw new Error(formatSpApiAccessDeniedError(opts.settings));
}

export type AmazonImportDiagnosticStep = {
  name: string;
  ok: boolean;
  message: string;
};

export type AmazonImportDiagnostic = {
  ok: boolean;
  marketplaceCode: string;
  steps: AmazonImportDiagnosticStep[];
};

export async function diagnoseAmazonImportAccess(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  sellerId: string;
  marketplaceCode?: string;
}): Promise<AmazonImportDiagnostic> {
  const productionSettings = withProductionSpApiSettings(opts.settings);
  const marketplaceCode = opts.marketplaceCode?.trim().toUpperCase()
    || productionSettings.defaultMarketplace?.trim().toUpperCase()
    || "IN";
  const steps: AmazonImportDiagnosticStep[] = [];

  if (!canSignSpApiRequests(productionSettings)) {
    steps.push({
      name: "AWS credentials",
      ok: false,
      message: "AWS Access Key ID and Secret Access Key are required on the Marketplaces credentials form.",
    });
    return { ok: false, marketplaceCode, steps };
  }
  steps.push({
    name: "AWS credentials",
    ok: true,
    message: productionSettings.awsRoleArn.trim()
      ? "AWS keys and Role ARN are set."
      : "AWS keys are set.",
  });

  let accessToken: string;
  try {
    const token = await refreshAccessToken(productionSettings, opts.refreshToken);
    accessToken = token.access_token;
    steps.push({
      name: "Seller refresh token",
      ok: true,
      message: "Amazon accepted the refresh token.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token refresh failed";
    steps.push({
      name: "Seller refresh token",
      ok: false,
      message: `${message} Re-authorize in Seller Central → Develop Apps and paste a new Atzr| refresh token.`,
    });
    return { ok: false, marketplaceCode, steps };
  }

  let participationIds: string[] = [];
  try {
    participationIds = await fetchSellerMarketplaceParticipations({
      settings: productionSettings,
      refreshToken: opts.refreshToken,
      region: spApiRegionForMarketplaceCode(marketplaceCode),
      accessToken,
    });
    if (participationIds.length === 0) {
      steps.push({
        name: "Marketplace access",
        ok: false,
        message: "Amazon returned no marketplaces for this seller. Re-authorize on sellercentral.amazon.in and confirm the Selling Partner ID matches your SARITE account.",
      });
    } else {
      const codes = participationIds.map((id) => resolveMarketplaceCodeFromSpId(id));
      steps.push({
        name: "Marketplace access",
        ok: true,
        message: `Seller participates in: ${codes.join(", ")}.`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Marketplace check failed";
    steps.push({
      name: "Marketplace access",
      ok: false,
      message: isSpApiAccessDenied(message)
        ? `Access denied when reading seller marketplaces. ${formatSpApiAccessDeniedError(productionSettings)}`
        : message,
    });
    return { ok: false, marketplaceCode, steps };
  }

  const effectiveMarketplace = participationIds.length > 0
    ? resolveMarketplaceCodeFromSpId(
      participationIds.find((id) => resolveMarketplaceCodeFromSpId(id) === marketplaceCode)
        ?? participationIds[0]!,
    )
    : marketplaceCode;

  try {
    await spApiRequest({
      settings: productionSettings,
      refreshToken: opts.refreshToken,
      method: "POST",
      path: "/reports/2021-06-30/reports",
      region: spApiRegionForMarketplaceCode(effectiveMarketplace),
      body: {
        reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
        marketplaceIds: [resolveSpMarketplaceId(effectiveMarketplace)],
      },
      accessToken,
    });
    steps.push({
      name: "Catalog report API",
      ok: true,
      message: `Reports API accepted a catalog export request for ${effectiveMarketplace}.`,
    });
    return { ok: true, marketplaceCode: effectiveMarketplace, steps };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report request failed";
    steps.push({
      name: "Catalog report API",
      ok: false,
      message: isSpApiAccessDenied(message)
        ? "Reports API denied access (missing Inventory and Order Tracking role or stale authorization)."
        : message,
    });
  }

  try {
    const preview = await searchListingsItems({
      settings: productionSettings,
      refreshToken: opts.refreshToken,
      sellerId: opts.sellerId,
      marketplaceCode: effectiveMarketplace,
      maxItems: 1,
    });
    steps.push({
      name: "Listings Items API",
      ok: true,
      message: preview.length > 0
        ? `Listings API works — found at least 1 listing in ${effectiveMarketplace}. Import should work.`
        : `Listings API works but returned 0 listings for ${effectiveMarketplace}.`,
    });
    return { ok: preview.length > 0, marketplaceCode: effectiveMarketplace, steps };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Listings API failed";
    steps.push({
      name: "Listings Items API",
      ok: false,
      message: isSpApiAccessDenied(message)
        ? `Listings API also denied access. ${formatSpApiAccessDeniedError(productionSettings)}`
        : message,
    });
    return { ok: false, marketplaceCode: effectiveMarketplace, steps };
  }
}
