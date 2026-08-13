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
  images?: Array<{ id?: number; src?: string; name?: string; alt?: string }>;
};

export function normalizeWooCommerceStoreUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Store URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.toString().replace(/\/$/, "");
}

function storeHostname(storeUrl: string): string {
  return new URL(normalizeWooCommerceStoreUrl(storeUrl)).hostname.toLowerCase();
}

function basicAuthHeader(consumerKey: string, consumerSecret: string): string {
  return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`;
}

function assertWooCommerceResponseUrl(storeUrl: string, response: Response): void {
  const expected = storeHostname(storeUrl);
  const actual = new URL(response.url).hostname.toLowerCase();
  if (actual !== expected) {
    throw new Error(
      `WooCommerce store URL redirected to ${actual}. The site may be offline, expired, or the URL may be wrong. Update the store URL on Marketplaces and reconnect.`,
    );
  }
}

async function readWooCommerceJson<T>(response: Response, storeUrl: string): Promise<T> {
  assertWooCommerceResponseUrl(storeUrl, response);
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("WooCommerce returned an empty response. Check the store URL and REST API settings.");
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "WooCommerce returned a web page instead of JSON. The store may be offline, password-protected, or the REST API may be disabled.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("WooCommerce returned invalid JSON. Check the store URL and REST API credentials.");
  }
}

async function wooCommerceFetch(
  storeUrl: string,
  endpoint: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(endpoint, init);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location")?.trim();
    throw new Error(
      location
        ? `WooCommerce store URL redirected to ${location}. The site may be offline or expired. Update the store URL on Marketplaces and reconnect.`
        : "WooCommerce store URL redirected away. The site may be offline or expired. Update the store URL on Marketplaces and reconnect.",
    );
  }
  return response;
}

type WooCommerceAuth = {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

function wooCommerceAuthHeaders(
  consumerKey: string,
  consumerSecret: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    Authorization: basicAuthHeader(consumerKey, consumerSecret),
    Accept: "application/json",
    ...extra,
  };
}

async function wooCommerceRequest<T>(
  input: WooCommerceAuth & { path: string; method?: string; body?: unknown },
): Promise<T> {
  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const endpoint = `${storeUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const response = await wooCommerceFetch(storeUrl, endpoint, {
    method: input.method ?? "GET",
    headers: wooCommerceAuthHeaders(
      input.consumerKey,
      input.consumerSecret,
      input.body ? { "Content-Type": "application/json" } : undefined,
    ),
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

  return readWooCommerceJson<T>(response, storeUrl);
}

export async function fetchWooCommerceProducts(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  page?: number;
  perPage?: number;
}): Promise<WooCommerceRestProduct[]> {
  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 100;
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}&status=any`;
  const response = await wooCommerceFetch(storeUrl, endpoint, {
    method: "GET",
    headers: wooCommerceAuthHeaders(input.consumerKey, input.consumerSecret),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  const data = await readWooCommerceJson<unknown>(response, storeUrl);
  if (!Array.isArray(data)) return [];
  return data as WooCommerceRestProduct[];
}

export async function findWooCommerceProductBySlug(input: WooCommerceAuth & {
  slug: string;
}): Promise<WooCommerceRestProduct | null> {
  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const slug = encodeURIComponent(input.slug.trim());
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?slug=${slug}&per_page=1`;
  const response = await wooCommerceFetch(storeUrl, endpoint, {
    method: "GET",
    headers: wooCommerceAuthHeaders(input.consumerKey, input.consumerSecret),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  const data = await readWooCommerceJson<unknown>(response, storeUrl);
  if (!Array.isArray(data) || data.length === 0) return null;
  const summary = data[0] as WooCommerceRestProduct;
  if (!summary.id) return summary;

  try {
    return await getWooCommerceProductById({
      storeUrl: input.storeUrl,
      consumerKey: input.consumerKey,
      consumerSecret: input.consumerSecret,
      productId: summary.id,
    });
  } catch {
    return summary;
  }
}

export async function getWooCommerceProductById(input: WooCommerceAuth & {
  productId: number;
}): Promise<WooCommerceRestProduct> {
  return wooCommerceRequest<WooCommerceRestProduct>({
    storeUrl: input.storeUrl,
    consumerKey: input.consumerKey,
    consumerSecret: input.consumerSecret,
    path: `/wp-json/wc/v3/products/${input.productId}`,
  });
}

export async function findWooCommerceProductBySku(input: WooCommerceAuth & {
  sku: string;
}): Promise<WooCommerceRestProduct | null> {
  const sku = input.sku.trim();
  if (!sku) return null;

  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}&per_page=1`;
  const response = await wooCommerceFetch(storeUrl, endpoint, {
    method: "GET",
    headers: wooCommerceAuthHeaders(input.consumerKey, input.consumerSecret),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce API error (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce API error (${response.status})`,
    );
  }

  const data = await readWooCommerceJson<unknown>(response, storeUrl);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as WooCommerceRestProduct;
}

export type WooCommerceProductImage = {
  id?: number;
  src?: string;
  name?: string;
  alt?: string;
};

export type WooCommerceProductPayload = {
  name: string;
  slug: string;
  type?: string;
  status: "publish" | "draft" | "pending" | "private";
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  images?: WooCommerceProductImage[];
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

export async function uploadWooCommerceMedia(input: WooCommerceAuth & {
  filename: string;
  contentType: string;
  data: Buffer;
}): Promise<{ id: number; source_url: string }> {
  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const endpoint = `${storeUrl}/wp-json/wp/v2/media`;
  const response = await wooCommerceFetch(storeUrl, endpoint, {
    method: "POST",
    headers: {
      ...wooCommerceAuthHeaders(input.consumerKey, input.consumerSecret),
      "Content-Disposition": `attachment; filename="${input.filename.replace(/"/g, "")}"`,
      "Content-Type": input.contentType,
    },
    body: input.data,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.trim()
        ? `WooCommerce media upload failed (${response.status}): ${text.slice(0, 200)}`
        : `WooCommerce media upload failed (${response.status})`,
    );
  }

  const media = await readWooCommerceJson<{ id?: number; source_url?: string }>(response, storeUrl);
  if (!media.id) {
    throw new Error("WooCommerce media upload did not return a media id");
  }
  return { id: media.id, source_url: media.source_url?.trim() || "" };
}

export type WooCommerceRestOrderLineItem = {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  sku?: string;
  price?: number;
  total?: string;
  subtotal?: string;
};

export type WooCommerceRestOrder = {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  line_items?: WooCommerceRestOrderLineItem[];
  meta_data?: Array<{ key?: string; value?: unknown }>;
};

export async function listWooCommerceOrders(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  createdAfter?: string;
  maxOrders?: number;
}): Promise<WooCommerceRestOrder[]> {
  const maxOrders = input.maxOrders ?? 500;
  const orders: WooCommerceRestOrder[] = [];
  let page = 1;
  const after = input.createdAfter
    ? `&after=${encodeURIComponent(input.createdAfter)}`
    : "";

  while (orders.length < maxOrders) {
    const batch = await wooCommerceRequest<WooCommerceRestOrder[]>({
      storeUrl: input.storeUrl,
      consumerKey: input.consumerKey,
      consumerSecret: input.consumerSecret,
      path: `/wp-json/wc/v3/orders?status=any&per_page=100&page=${page}${after}`,
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    orders.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 40) break;
  }

  return orders.slice(0, maxOrders);
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
