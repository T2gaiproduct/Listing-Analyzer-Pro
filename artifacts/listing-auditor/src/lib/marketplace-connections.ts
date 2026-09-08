import { fetchJson } from "@/lib/api-fetch";
import {
  fetchAmazonStatus,
  startAmazonConnect,
  type AmazonConnectionStatus,
} from "@/lib/amazon-publish";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type StoreMarketplace = "shopify" | "woocommerce";
export type MarketplacePlatform = StoreMarketplace | "amazon";

export type MarketplaceAmazonStatus = AmazonConnectionStatus & {
  applicationId?: string | null;
  clientId?: string | null;
  hasClientSecret?: boolean;
  hasAwsAccessKey?: boolean;
  hasAwsSecretKey?: boolean;
  awsRoleArn?: string | null;
};

export type MarketplaceConnectionsResponse = {
  amazon: MarketplaceAmazonStatus;
  shopify: {
    connected: boolean;
    publishReady: boolean;
    storeUrl: string | null;
    clientId: string | null;
    connectedAt: string | null;
  };
  woocommerce: {
    connected: boolean;
    publishReady: boolean;
    storeUrl: string | null;
    consumerKey: string | null;
    connectedAt: string | null;
  };
};

export type SaveAmazonMarketplaceCredentialsInput = {
  applicationId?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  defaultMarketplace?: string;
  sandbox?: boolean;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRoleArn?: string;
};

export async function fetchMarketplaceConnections(): Promise<MarketplaceConnectionsResponse> {
  return fetchJson<MarketplaceConnectionsResponse>(`${basePath}/api/marketplaces/connections`);
}

export async function connectStoreMarketplace(
  platform: StoreMarketplace,
  input: {
    storeUrl: string;
    clientId?: string;
    clientSecret?: string;
    consumerKey?: string;
    consumerSecret?: string;
  },
): Promise<{
  connected: boolean;
  storeUrl: string;
  connectedAt: string;
  publishReady?: boolean;
  message?: string;
}> {
  return fetchJson(`${basePath}/api/marketplaces/connections/${platform}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function saveAmazonMarketplaceCredentials(
  input: SaveAmazonMarketplaceCredentialsInput,
): Promise<{
  credentialsSaved: boolean;
  configured: boolean;
  publishReady: boolean;
  canSignRequests: boolean;
  redirectUri: string;
  message?: string;
}> {
  return fetchJson(`${basePath}/api/marketplaces/connections/amazon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type TestAmazonMarketplaceCredentialsInput = Partial<
  Pick<
    SaveAmazonMarketplaceCredentialsInput,
    "applicationId" | "clientId" | "clientSecret" | "redirectUri" | "defaultMarketplace" | "sandbox"
  >
>;

export async function testAmazonMarketplaceCredentials(
  input?: TestAmazonMarketplaceCredentialsInput,
): Promise<{ ok: boolean; message: string }> {
  return fetchJson(`${basePath}/api/marketplaces/amazon/test-credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}

export async function disconnectStoreMarketplace(platform: StoreMarketplace): Promise<void> {
  await fetchJson(`${basePath}/api/marketplaces/connections/${platform}`, {
    method: "DELETE",
  });
}

export type ShopifySyncResult = {
  imported: number;
  skipped: number;
  updated: number;
  total: number;
  auditsQueued: number;
  auditsCompleted?: number;
  auditsFailed?: number;
  auditsRemaining?: number;
  ordersImported?: number;
  ordersUpdated?: number;
  ordersSyncQueued?: boolean;
  orderSyncErrors?: string[];
  products: Array<{
    id: number;
    name: string;
    sku: string;
    handle: string;
    detailUrl: string;
    workflowUrl: string;
  }>;
  errors: Array<{ handle: string; error: string }>;
};

export type CatalogPreviewItem = {
  id: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  status: string | null;
  subtitle: string | null;
};

export type CatalogPreviewResponse = {
  items: CatalogPreviewItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalHint: number | null;
  nextCursor: string | null;
};

export type MarketplaceImportInput = {
  productIds?: string[];
  limit?: number;
  marketplace?: string;
};

export const DEFAULT_IMPORT_LIMIT = 50;
export const MAX_IMPORT_PER_RUN = 500;

export async function fetchCatalogPreview(
  platform: MarketplacePlatform,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    cursor?: string | null;
    marketplace?: string;
  } = {},
): Promise<CatalogPreviewResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.marketplace) searchParams.set("marketplace", params.marketplace);
  const qs = searchParams.toString();
  return fetchJson<CatalogPreviewResponse>(
    `${basePath}/api/marketplaces/${platform}/catalog-preview${qs ? `?${qs}` : ""}`,
  );
}

export async function syncShopifyProducts(input?: MarketplaceImportInput): Promise<ShopifySyncResult> {
  return fetchJson<ShopifySyncResult>(`${basePath}/api/marketplaces/shopify/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}

export async function syncWooCommerceProducts(input?: MarketplaceImportInput): Promise<ShopifySyncResult> {
  return fetchJson<ShopifySyncResult>(`${basePath}/api/marketplaces/woocommerce/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}

export async function syncAmazonProducts(input?: MarketplaceImportInput): Promise<ShopifySyncResult> {
  return fetchJson<ShopifySyncResult>(`${basePath}/api/marketplaces/amazon/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}

export async function disconnectAmazon(): Promise<void> {
  await fetchJson(`${basePath}/api/marketplaces/connections/amazon`, {
    method: "DELETE",
  });
}

export async function connectAmazonSelfAuth(input: {
  sellerId: string;
  refreshToken: string;
}): Promise<{ ok: boolean; sellerId: string }> {
  return fetchJson(`${basePath}/api/amazon/connection/self-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export { fetchAmazonStatus, startAmazonConnect };
