import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ShopifyConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  storeUrl: string | null;
  clientId: string | null;
  connectedAt: string | null;
}

export async function fetchShopifyStatus(): Promise<ShopifyConnectionStatus> {
  return fetchJson<ShopifyConnectionStatus>(`${basePath}/api/shopify/status`);
}

export type ShopifyCollectionOption = {
  id: string;
  title: string;
  handle: string;
};

export async function fetchShopifyCollections(): Promise<{ collections: ShopifyCollectionOption[] }> {
  return fetchJson<{ collections: ShopifyCollectionOption[] }>(`${basePath}/api/shopify/collections`);
}

export type ShopifyListingCollections = {
  handle: string | null;
  productType: string | null;
  listingCategory: string | null;
  manualCollections: ShopifyCollectionOption[];
  smartCollections: ShopifyCollectionOption[];
  storefrontOrigin?: string;
  message?: string;
};

export async function fetchShopifyListingCollections(auditId: number): Promise<ShopifyListingCollections> {
  return fetchJson<ShopifyListingCollections>(
    `${basePath}/api/audits/${auditId}/shopify/listing-collections`,
  );
}

export async function publishAuditToShopify(opts: {
  auditId: number;
  publishMode?: "draft" | "live";
  shopifyCollectionGids?: string[];
  shopifyCollectionTitles?: Record<string, string>;
}): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  status?: "live" | "pending";
  warning?: string;
  collectionsAssigned?: Array<{ id: string; title?: string }>;
}> {
  const data = await fetchJson<{
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    status?: "live" | "pending";
    warning?: string;
    collectionsAssigned?: Array<{ id: string; title?: string }>;
  }>(`${basePath}/api/audits/${opts.auditId}/publish/shopify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publishMode: opts.publishMode ?? "draft",
      shopifyCollectionGids: opts.shopifyCollectionGids,
      shopifyCollectionTitles: opts.shopifyCollectionTitles,
    }),
  });
  return {
    ok: true,
    message: data.message ?? "Published to Shopify",
    listingUrl: data.listingUrl,
    status: data.status,
    warning: data.warning,
    collectionsAssigned: data.collectionsAssigned,
  };
}
