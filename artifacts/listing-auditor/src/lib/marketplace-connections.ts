import { fetchJson } from "@/lib/api-fetch";
import {
  disconnectAmazon,
  fetchAmazonStatus,
  startAmazonConnect,
  type AmazonConnectionStatus,
} from "@/lib/amazon-publish";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type StoreMarketplace = "shopify" | "woocommerce";

export type MarketplaceConnectionsResponse = {
  amazon: AmazonConnectionStatus;
  shopify: { connected: boolean; storeUrl: string | null; connectedAt: string | null };
  woocommerce: { connected: boolean; storeUrl: string | null; connectedAt: string | null };
};

export async function fetchMarketplaceConnections(): Promise<MarketplaceConnectionsResponse> {
  return fetchJson<MarketplaceConnectionsResponse>(`${basePath}/api/marketplaces/connections`);
}

export async function connectStoreMarketplace(
  platform: StoreMarketplace,
  storeUrl: string,
): Promise<{ connected: boolean; storeUrl: string; connectedAt: string }> {
  return fetchJson(`${basePath}/api/marketplaces/connections/${platform}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeUrl }),
  });
}

export async function disconnectStoreMarketplace(platform: StoreMarketplace): Promise<void> {
  await fetchJson(`${basePath}/api/marketplaces/connections/${platform}`, {
    method: "DELETE",
  });
}

export { fetchAmazonStatus, startAmazonConnect, disconnectAmazon };
