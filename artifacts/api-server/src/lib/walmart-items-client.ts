import { getWalmartWorkspaceConnection, type WalmartWorkspaceConnection } from "./walmart-workspace-connection.js";
import {
  parseWalmartErrorBody,
  refreshWalmartAccessToken,
  walmartApiBaseUrl,
  walmartMarketplaceHeaders,
  WalmartOAuthError,
  type WalmartEnvironment,
} from "./walmart-oauth.js";

export type WalmartCatalogItem = {
  sku: string;
  wpid: string | null;
  upc: string | null;
  productName: string;
  publishedStatus: string | null;
  lifecycleStatus: string | null;
  priceAmount: number | null;
  currency: string | null;
  imageUrls: string[];
  descriptionHtml: string | null;
};

export type WalmartItemsPage = {
  items: WalmartCatalogItem[];
  nextCursor: string | null;
  totalItems: number | null;
  hasMore: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function collectImageUrls(raw: unknown): string[] {
  const urls: string[] = [];
  const push = (value: unknown) => {
    const url = asString(value);
    if (url && /^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url);
  };

  if (typeof raw === "string") {
    push(raw);
    return urls;
  }

  const record = asRecord(raw);
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") push(entry);
      else {
        const obj = asRecord(entry);
        push(obj?.url ?? obj?.imageUrl ?? obj?.src ?? obj?.primaryImageUrl);
      }
    }
    return urls;
  }
  if (record) {
    push(record.url ?? record.imageUrl ?? record.src ?? record.primaryImageUrl);
    if (Array.isArray(record.images)) urls.push(...collectImageUrls(record.images));
  }
  return urls;
}

export function parseWalmartCatalogItem(raw: unknown): WalmartCatalogItem | null {
  const item = asRecord(raw);
  if (!item) return null;
  const sku = asString(item.sku);
  if (!sku) return null;
  const productName = asString(item.productName) ?? asString(item.name) ?? sku;
  const price = asRecord(item.price);
  const imageUrls = [
    ...collectImageUrls(item.images),
    ...collectImageUrls(item.primaryImageUrl),
    ...collectImageUrls(item.imageUrl),
  ].slice(0, 9);
  const descriptionHtml = asString(item.longDescription)
    ?? asString(item.shortDescription)
    ?? asString(item.description);

  return {
    sku,
    wpid: asString(item.wpid),
    upc: asString(item.upc) ?? asString(item.gtin),
    productName,
    publishedStatus: asString(item.publishedStatus),
    lifecycleStatus: asString(item.lifecycleStatus),
    priceAmount: asNumber(price?.amount ?? item.amount),
    currency: asString(price?.currency) ?? "USD",
    imageUrls,
    descriptionHtml,
  };
}

export function parseWalmartItemsPage(raw: unknown): WalmartItemsPage {
  const body = asRecord(raw) ?? {};
  const responsePayload = body.ItemResponse ?? body.itemResponse ?? body.items;
  const list = Array.isArray(responsePayload)
    ? responsePayload
    : responsePayload
      ? [responsePayload]
      : [];
  const items = list
    .map((entry) => parseWalmartCatalogItem(entry))
    .filter((item): item is WalmartCatalogItem => Boolean(item));
  const nextCursor = asString(body.nextCursor);
  const totalItems = asNumber(body.totalItems);
  return {
    items,
    nextCursor,
    totalItems,
    hasMore: Boolean(nextCursor) && items.length > 0,
  };
}

async function walmartGetJson(input: {
  connection: WalmartWorkspaceConnection;
  accessToken: string;
  path: string;
}): Promise<unknown> {
  const url = `${walmartApiBaseUrl(input.connection.environment)}${input.path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: walmartMarketplaceHeaders({
      accessToken: input.accessToken,
      partnerId: input.connection.partnerId,
      clientId: input.connection.clientId,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = parseWalmartErrorBody(text);
    throw new WalmartOAuthError(
      detail
        ? `Walmart items request failed (${res.status}): ${detail}`
        : `Walmart items request failed (${res.status}).`,
      res.status,
    );
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WalmartOAuthError("Walmart items response was not JSON.");
  }
}

export async function resolveWalmartAccessToken(workspaceId: number): Promise<{
  connection: WalmartWorkspaceConnection;
  accessToken: string;
  environment: WalmartEnvironment;
}> {
  const connection = await getWalmartWorkspaceConnection(workspaceId);
  if (!connection) {
    throw new WalmartOAuthError("Connect your Walmart seller account on the Marketplaces page first.");
  }
  const { accessToken } = await refreshWalmartAccessToken(connection);
  return { connection, accessToken, environment: connection.environment };
}

export async function fetchWalmartItemsPage(input: {
  connection: WalmartWorkspaceConnection;
  accessToken: string;
  limit: number;
  nextCursor?: string | null;
  sku?: string | null;
}): Promise<WalmartItemsPage> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(50, Math.max(1, input.limit))));
  if (input.nextCursor?.trim()) params.set("nextCursor", input.nextCursor.trim());
  if (input.sku?.trim()) params.set("sku", input.sku.trim());
  const parsed = parseWalmartItemsPage(
    await walmartGetJson({
      connection: input.connection,
      accessToken: input.accessToken,
      path: `/v3/items?${params.toString()}`,
    }),
  );
  return parsed;
}

export async function fetchWalmartItemBySku(input: {
  connection: WalmartWorkspaceConnection;
  accessToken: string;
  sku: string;
}): Promise<WalmartCatalogItem | null> {
  const sku = input.sku.trim();
  if (!sku) return null;
  try {
    const raw = await walmartGetJson({
      connection: input.connection,
      accessToken: input.accessToken,
      path: `/v3/items/${encodeURIComponent(sku)}?productIdType=SKU`,
    });
    const page = parseWalmartItemsPage(raw);
    if (page.items[0]) return page.items[0];
    return parseWalmartCatalogItem(raw);
  } catch (err) {
    if (err instanceof WalmartOAuthError && err.status === 404) return null;
    throw err;
  }
}
