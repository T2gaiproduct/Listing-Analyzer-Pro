type TokenCacheEntry = {
  accessToken: string;
  expiresAtMs: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

export function parseShopifyShopHost(storeUrl: string): string {
  const trimmed = storeUrl.trim();
  if (!trimmed) throw new Error("Shopify store URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!url.hostname.endsWith(".myshopify.com")) {
    throw new Error("Shopify store URL must be a *.myshopify.com domain");
  }
  return url.hostname;
}

export async function getShopifyAccessToken(opts: {
  shopHost: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const cacheKey = `${opts.shopHost}:${opts.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAtMs - 60_000) {
    return cached.accessToken;
  }

  const response = await fetch(`https://${opts.shopHost}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  });

  const body = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const detail = body.error_description ?? body.error ?? `HTTP ${response.status}`;
    throw new Error(`Shopify authentication failed: ${detail}`);
  }

  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 86_400;
  tokenCache.set(cacheKey, {
    accessToken: body.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  });

  return body.access_token;
}

const SHOPIFY_API_VERSION = "2025-01";

export async function shopifyAdminRequest<T>(opts: {
  shopHost: string;
  accessToken: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
}): Promise<T> {
  const response = await fetch(
    `https://${opts.shopHost}/admin/api/${SHOPIFY_API_VERSION}${opts.path}`,
    {
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": opts.accessToken,
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    },
  );

  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const errors = (parsed as { errors?: unknown }).errors;
    const message = typeof errors === "string"
      ? errors
      : Array.isArray(errors)
        ? errors.join(", ")
        : typeof errors === "object" && errors != null
          ? JSON.stringify(errors)
          : `Shopify API error (${response.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

export type ShopifyRestProduct = {
  id: number;
  handle: string;
  title: string;
  status: string;
  admin_graphql_api_id?: string;
};

export async function findShopifyProductByHandle(opts: {
  shopHost: string;
  accessToken: string;
  handle: string;
}): Promise<ShopifyRestProduct | null> {
  const data = await shopifyAdminRequest<{ products: ShopifyRestProduct[] }>({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    method: "GET",
    path: `/products.json?handle=${encodeURIComponent(opts.handle)}&limit=1`,
  });
  return data.products?.[0] ?? null;
}

export async function createShopifyProduct(opts: {
  shopHost: string;
  accessToken: string;
  product: Record<string, unknown>;
}): Promise<ShopifyRestProduct> {
  const data = await shopifyAdminRequest<{ product: ShopifyRestProduct }>({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    method: "POST",
    path: "/products.json",
    body: { product: opts.product },
  });
  return data.product;
}

export async function listShopifyProducts(opts: {
  shopHost: string;
  accessToken: string;
  limit?: number;
}): Promise<ShopifyRestProduct[]> {
  const products: ShopifyRestProduct[] = [];
  const pageSize = Math.min(opts.limit ?? 250, 250);
  let sinceId = 0;

  for (let page = 0; page < 40; page += 1) {
    const path = sinceId > 0
      ? `/products.json?limit=${pageSize}&since_id=${sinceId}`
      : `/products.json?limit=${pageSize}`;
    const data = await shopifyAdminRequest<{ products: ShopifyRestProduct[] }>({
      shopHost: opts.shopHost,
      accessToken: opts.accessToken,
      method: "GET",
      path,
    });

    const batch = data.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    sinceId = batch[batch.length - 1]!.id;
    if (batch.length < pageSize) break;
    if (opts.limit && products.length >= opts.limit) break;
  }

  return opts.limit ? products.slice(0, opts.limit) : products;
}

export type ShopifyAdminCatalogProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: string;
  published_at?: string | null;
  images?: Array<{ src?: string }>;
  variants?: Array<{
    sku?: string;
    price?: string;
    inventory_quantity?: number | null;
  }>;
};

export async function fetchShopifyCatalogViaAdmin(opts: {
  shopHost: string;
  accessToken: string;
  maxProducts?: number;
}): Promise<ShopifyAdminCatalogProduct[]> {
  const products: ShopifyAdminCatalogProduct[] = [];
  const pageSize = 250;
  let sinceId = 0;
  const maxProducts = opts.maxProducts ?? 500;

  for (let page = 0; page < 40 && products.length < maxProducts; page += 1) {
    const path = sinceId > 0
      ? `/products.json?limit=${pageSize}&since_id=${sinceId}`
      : `/products.json?limit=${pageSize}`;
    const data = await shopifyAdminRequest<{ products: ShopifyAdminCatalogProduct[] }>({
      shopHost: opts.shopHost,
      accessToken: opts.accessToken,
      method: "GET",
      path,
    });

    const batch = data.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    sinceId = batch[batch.length - 1]!.id;
    if (batch.length < pageSize) break;
  }

  return products.slice(0, maxProducts);
}

export async function updateShopifyProduct(opts: {
  shopHost: string;
  accessToken: string;
  productId: number;
  product: Record<string, unknown>;
}): Promise<ShopifyRestProduct> {
  const data = await shopifyAdminRequest<{ product: ShopifyRestProduct }>({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    method: "PUT",
    path: `/products/${opts.productId}.json`,
    body: { product: opts.product },
  });
  return data.product;
}

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function shopifyAdminGraphqlRequest<T>(opts: {
  shopHost: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(
    `https://${opts.shopHost}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": opts.accessToken,
      },
      body: JSON.stringify({
        query: opts.query,
        variables: opts.variables,
      }),
    },
  );

  const body = await response.json().catch(() => ({})) as ShopifyGraphqlResponse<T>;
  if (!response.ok) {
    throw new Error(`Shopify GraphQL error (${response.status})`);
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join(", "));
  }
  if (!body.data) {
    throw new Error("Shopify GraphQL returned no data");
  }
  return body.data;
}

const onlineStorePublicationCache = new Map<string, string>();

export async function getOnlineStorePublicationId(opts: {
  shopHost: string;
  accessToken: string;
}): Promise<string | null> {
  const cached = onlineStorePublicationCache.get(opts.shopHost);
  if (cached) return cached;

  const data = await shopifyAdminGraphqlRequest<{
    publications: {
      edges: Array<{ node: { id: string; name?: string | null } }>;
    };
  }>({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    query: `
      query OnlineStorePublication {
        publications(first: 20) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
  });

  const publications = data.publications?.edges ?? [];
  const onlineStore = publications.find((edge) =>
    edge.node.name?.toLowerCase().includes("online store"),
  );
  const publicationId = onlineStore?.node.id ?? publications[0]?.node.id ?? null;
  if (publicationId) {
    onlineStorePublicationCache.set(opts.shopHost, publicationId);
  }
  return publicationId;
}

export async function publishProductToOnlineStore(opts: {
  shopHost: string;
  accessToken: string;
  productGid: string;
  publicationId: string;
}): Promise<void> {
  const data = await shopifyAdminGraphqlRequest<{
    publishablePublish: {
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>({
    shopHost: opts.shopHost,
    accessToken: opts.accessToken,
    query: `
      mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      id: opts.productGid,
      input: [{ publicationId: opts.publicationId }],
    },
  });

  const userErrors = data.publishablePublish?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }
}

export function shopifyProductAdminUrl(shopHost: string, productId: number): string {
  return `https://${shopHost}/admin/products/${productId}`;
}

export function shopifyProductGid(productId: number): string {
  return `gid://shopify/Product/${productId}`;
}

export type ShopifyRestOrderLineItem = {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  sku: string | null;
  title: string;
  quantity: number;
  price: string;
};

export type ShopifyRestOrder = {
  id: number;
  name: string;
  order_number: number;
  email?: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  cancelled_at?: string | null;
  created_at: string;
  currency: string;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  line_items: ShopifyRestOrderLineItem[];
  fulfillments?: Array<{
    tracking_number?: string | null;
    tracking_numbers?: string[] | null;
  }>;
};

export async function listShopifyOrders(opts: {
  shopHost: string;
  accessToken: string;
  createdAtMin?: string;
  maxOrders?: number;
}): Promise<ShopifyRestOrder[]> {
  const orders: ShopifyRestOrder[] = [];
  const pageSize = 250;
  const maxOrders = opts.maxOrders ?? 500;
  let sinceId = 0;
  const createdAtMin = opts.createdAtMin
    ? `&created_at_min=${encodeURIComponent(opts.createdAtMin)}`
    : "";

  for (let page = 0; page < 40 && orders.length < maxOrders; page += 1) {
    const path = sinceId > 0
      ? `/orders.json?status=any&limit=${pageSize}&since_id=${sinceId}${createdAtMin}`
      : `/orders.json?status=any&limit=${pageSize}${createdAtMin}`;
    const data = await shopifyAdminRequest<{ orders: ShopifyRestOrder[] }>({
      shopHost: opts.shopHost,
      accessToken: opts.accessToken,
      method: "GET",
      path,
    });

    const batch = data.orders ?? [];
    if (batch.length === 0) break;
    orders.push(...batch);
    sinceId = batch[batch.length - 1]!.id;
    if (batch.length < pageSize) break;
  }

  return orders.slice(0, maxOrders);
}
