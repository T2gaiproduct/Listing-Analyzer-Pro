import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints } from "./ebay-oauth-config.js";
import { getEbayWorkspaceConnection } from "./ebay-workspace-connection.js";
import { refreshEbayAccessToken } from "./ebay-oauth.js";

export type EbayInventoryItem = {
  sku: string;
  product?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  condition?: string;
};

type InventoryListResponse = {
  total?: number;
  size?: number;
  inventoryItems?: EbayInventoryItem[];
};

export async function resolveEbayAccessToken(workspaceId: number): Promise<{
  accessToken: string;
  environment: EbayOAuthEnvironment;
}> {
  const connection = await getEbayWorkspaceConnection(workspaceId);
  if (!connection) {
    throw new Error("Connect your eBay seller account on the Marketplaces page first.");
  }
  const tokens = await refreshEbayAccessToken(connection.environment, connection.refreshToken);
  const accessToken = tokens.access_token?.trim();
  if (!accessToken) {
    throw new Error("eBay authorization expired. Disconnect and connect eBay again.");
  }
  return { accessToken, environment: connection.environment };
}

async function ebayInventoryFetch(
  environment: EbayOAuthEnvironment,
  accessToken: string,
  path: string,
): Promise<Response> {
  const { apiBaseUrl } = ebayOAuthEndpoints(environment);
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  // Node fetch (undici) defaults Accept-Language to `*`, which eBay Inventory rejects (error 25709).
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Content-Type": "application/json",
      "Content-Language": "en-US",
    },
  });
}

export async function fetchEbayInventoryItemsPage(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  limit: number;
  offset: number;
}): Promise<{ items: EbayInventoryItem[]; total: number | null; hasMore: boolean }> {
  const limit = Math.min(Math.max(input.limit, 1), 200);
  const offset = Math.max(input.offset, 0);
  const res = await ebayInventoryFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay inventory request failed (${res.status})`);
  }
  const data = JSON.parse(text) as InventoryListResponse;
  const items = (data.inventoryItems ?? []).filter((row) => row.sku?.trim());
  const total = typeof data.total === "number" ? data.total : null;
  const hasMore = total != null ? offset + items.length < total : items.length >= limit;
  return { items, total, hasMore };
}

export async function fetchEbayInventoryItemBySku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<EbayInventoryItem | null> {
  const sku = input.sku.trim();
  if (!sku) return null;
  const encodedSku = encodeURIComponent(sku);
  const res = await ebayInventoryFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item/${encodedSku}`,
  );
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay inventory item request failed (${res.status})`);
  }
  const data = JSON.parse(text) as EbayInventoryItem;
  return data.sku?.trim() ? data : null;
}

export async function fetchEbayInventoryItemsBySkus(input: {
  workspaceId: number;
  skus: string[];
}): Promise<EbayInventoryItem[]> {
  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  const results: EbayInventoryItem[] = [];
  for (const sku of input.skus) {
    const item = await fetchEbayInventoryItemBySku({ environment, accessToken, sku });
    if (item) results.push(item);
  }
  return results;
}
