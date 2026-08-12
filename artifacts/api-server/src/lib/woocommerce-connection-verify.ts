import { fetchWooCommerceProducts } from "./woocommerce-admin-client.js";

export type WooCommerceConnectionVerification = {
  ok: boolean;
  message: string;
};

export async function verifyWooCommerceConnection(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<WooCommerceConnectionVerification> {
  const consumerKey = input.consumerKey.trim();
  const consumerSecret = input.consumerSecret.trim();
  if (!consumerKey || !consumerSecret) {
    return {
      ok: false,
      message: "Consumer key and consumer secret are required.",
    };
  }

  try {
    await fetchWooCommerceProducts({
      storeUrl: input.storeUrl,
      consumerKey,
      consumerSecret,
      page: 1,
      perPage: 1,
    });
    return {
      ok: true,
      message: "WooCommerce connection verified for product catalog access.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify WooCommerce credentials";
    if (message.includes("401") || message.includes("403")) {
      return {
        ok: false,
        message: "WooCommerce rejected the credentials. Check the consumer key and secret, and ensure the API key has Read/Write permissions.",
      };
    }
    return { ok: false, message };
  }
}
