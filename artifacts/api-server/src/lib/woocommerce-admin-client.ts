export type WooCommerceRestProduct = {
  id: number;
  name: string;
  slug: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  status?: string;
  categories?: Array<{ name?: string }>;
  tags?: Array<{ name?: string }>;
  images?: Array<{ src?: string }>;
};

function normalizeStoreUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Store URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.toString().replace(/\/$/, "");
}

function basicAuthHeader(consumerKey: string, consumerSecret: string): string {
  return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`;
}

type WooCommerceAuth = {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

async function wooCommerceRequest<T>(
  input: WooCommerceAuth & { path: string; method?: string; body?: unknown },
): Promise<T> {
  const storeUrl = normalizeStoreUrl(input.storeUrl);
  const endpoint = `${storeUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const response = await fetch(endpoint, {
    method: input.method ?? "GET",
    headers: {
      Authorization: basicAuthHeader(input.consumerKey, input.consumerSecret),
      Accept: "application/json",
      ...(input.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchWooCommerceProducts(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  page?: number;
  perPage?: number;
}): Promise<WooCommerceRestProduct[]> {
  const storeUrl = normalizeStoreUrl(input.storeUrl);
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 100;
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}&status=any`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(input.consumerKey, input.consumerSecret),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  const data = await response.json() as unknown;
  if (!Array.isArray(data)) return [];
  return data as WooCommerceRestProduct[];
}

export async function findWooCommerceProductBySlug(input: WooCommerceAuth & {
  slug: string;
}): Promise<WooCommerceRestProduct | null> {
  const storeUrl = normalizeStoreUrl(input.storeUrl);
  const slug = encodeURIComponent(input.slug.trim());
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?slug=${slug}&per_page=1`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(input.consumerKey, input.consumerSecret),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  const data = await response.json() as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as WooCommerceRestProduct;
}

export type WooCommerceProductPayload = {
  name: string;
  slug: string;
  type?: string;
  status: "publish" | "draft" | "pending" | "private";
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  images?: Array<{ src: string }>;
  categories?: Array<{ name: string }>;
  tags?: Array<{ name: string }>;
};

export async function createWooCommerceProduct(
  input: WooCommerceAuth & { product: WooCommerceProductPayload },
): Promise<WooCommerceRestProduct> {
  return wooCommerceRequest<WooCommerceRestProduct>({
    ...input,
    path: "/wp-json/wc/v3/products",
    method: "POST",
    body: input.product,
  });
}

export async function updateWooCommerceProduct(
  input: WooCommerceAuth & { productId: number; product: WooCommerceProductPayload },
): Promise<WooCommerceRestProduct> {
  return wooCommerceRequest<WooCommerceRestProduct>({
    ...input,
    path: `/wp-json/wc/v3/products/${input.productId}`,
    method: "PUT",
    body: input.product,
  });
}

export async function fetchWooCommerceCatalog(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  maxProducts?: number;
}): Promise<WooCommerceRestProduct[]> {
  const maxProducts = input.maxProducts ?? 500;
  const products: WooCommerceRestProduct[] = [];
  let page = 1;

  while (products.length < maxProducts) {
    const batch = await fetchWooCommerceProducts({
      ...input,
      page,
      perPage: Math.min(100, maxProducts - products.length),
    });
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 40) break;
  }

  return products.slice(0, maxProducts);
}
