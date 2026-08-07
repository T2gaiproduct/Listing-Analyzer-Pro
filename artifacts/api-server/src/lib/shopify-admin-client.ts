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
