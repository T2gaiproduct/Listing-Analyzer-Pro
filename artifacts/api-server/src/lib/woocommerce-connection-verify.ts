export type WooCommerceConnectionVerification = {
  ok: boolean;
  message: string;
};

function normalizeWooCommerceStoreUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Store URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.toString().replace(/\/$/, "");
}

export async function verifyWooCommerceConnection(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<WooCommerceConnectionVerification> {
  const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
  const consumerKey = input.consumerKey.trim();
  const consumerSecret = input.consumerSecret.trim();
  if (!consumerKey || !consumerSecret) {
    return {
      ok: false,
      message: "Consumer key and consumer secret are required.",
    };
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const endpoint = `${storeUrl}/wp-json/wc/v3/products?per_page=1`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      message: "WooCommerce rejected the credentials. Check the consumer key and secret, and ensure the API key has Read/Write permissions.",
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const detail = text.slice(0, 200).trim();
    return {
      ok: false,
      message: detail
        ? `Could not reach WooCommerce API (${response.status}): ${detail}`
        : `Could not reach WooCommerce API (${response.status}). Confirm the store URL and that WooCommerce REST API is enabled.`,
    };
  }

  return {
    ok: true,
    message: "WooCommerce connection verified for product catalog access.",
  };
}
