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
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}&status=publish,draft,pending,private`;
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
