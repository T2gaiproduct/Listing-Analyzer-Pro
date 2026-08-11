import {
  clearShopifyAccessTokenCache,
  getOnlineStorePublicationId,
  getShopifyAccessTokenWithScope,
  parseShopifyShopHost,
  shopifyAdminRequest,
} from "./shopify-admin-client.js";

const REQUIRED_PUBLISH_SCOPES = [
  "read_products",
  "write_products",
  "read_publications",
  "write_publications",
] as const;

function missingScopes(scope: string): string[] {
  const granted = new Set(scope.split(/[,\s]+/).map((entry) => entry.trim()).filter(Boolean));
  return REQUIRED_PUBLISH_SCOPES.filter((required) => !granted.has(required));
}

export type ShopifyConnectionVerification = {
  ok: boolean;
  scopes: string;
  message: string;
};

export async function verifyShopifyConnection(input: {
  storeUrl: string;
  clientId: string;
  clientSecret: string;
}): Promise<ShopifyConnectionVerification> {
  const shopHost = parseShopifyShopHost(input.storeUrl);
  clearShopifyAccessTokenCache({ shopHost, clientId: input.clientId });

  const { accessToken, scope } = await getShopifyAccessTokenWithScope({
    shopHost,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });

  let publicationId: string | null = null;
  try {
    await shopifyAdminRequest<{ products: unknown[] }>({
      shopHost,
      accessToken,
      method: "GET",
      path: "/products.json?limit=1",
    });
    publicationId = await getOnlineStorePublicationId({ shopHost, accessToken });
  } catch {
    // Fall through to scope / publication checks below.
  }

  const missing = missingScopes(scope);
  if (missing.length > 0 && !publicationId) {
    return {
      ok: false,
      scopes: scope,
      message: `Shopify token is missing required scopes: ${missing.join(", ")}. Add them in Dev Dashboard, release the app version, then reconnect here.`,
    };
  }

  if (!publicationId) {
    return {
      ok: false,
      scopes: scope,
      message: "Connected to Shopify, but no Online Store publication was found. Check your store sales channels.",
    };
  }

  return {
    ok: true,
    scopes: scope,
    message: "Shopify connection verified for product and Online Store publishing.",
  };
}
