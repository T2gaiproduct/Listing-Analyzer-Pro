import {
  clearShopifyAccessTokenCache,
  getOnlineStorePublicationId,
  getShopifyAccessTokenWithScope,
  parseShopifyShopHost,
  resolveShopifyGrantedScopes,
  shopifyAdminRequest,
} from "./shopify-admin-client.js";

const REQUIRED_PUBLISH_SCOPES = [
  "read_products",
  "write_products",
  "read_publications",
  "write_publications",
] as const;

function missingScopes(granted: Iterable<string>): string[] {
  const grantedSet = new Set(granted);
  return REQUIRED_PUBLISH_SCOPES.filter((required) => !grantedSet.has(required));
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

  const { accessToken, scope: cachedScope } = await getShopifyAccessTokenWithScope({
    shopHost,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });

  const grantedScopes = await resolveShopifyGrantedScopes({
    shopHost,
    accessToken,
    tokenScope: cachedScope,
  });
  const scope = grantedScopes.join(",");

  let productsOk = false;
  let productsError: string | null = null;
  try {
    await shopifyAdminRequest<{ products: unknown[] }>({
      shopHost,
      accessToken,
      method: "GET",
      path: "/products.json?limit=1",
    });
    productsOk = true;
  } catch (err) {
    productsError = err instanceof Error ? err.message : "Could not read products from Shopify";
  }

  let publicationId: string | null = null;
  let publicationsError: string | null = null;
  try {
    publicationId = await getOnlineStorePublicationId({ shopHost, accessToken });
  } catch (err) {
    publicationsError = err instanceof Error ? err.message : "Could not read Shopify publications";
  }

  // Functional probes are authoritative — if both succeed, the token has what we need.
  if (productsOk && publicationId) {
    return {
      ok: true,
      scopes: scope,
      message: "Shopify connection verified for product and Online Store publishing.",
    };
  }

  if (productsOk && !publicationId) {
    return {
      ok: false,
      scopes: scope,
      message: publicationsError
        ? `Connected to Shopify, but publications could not be verified: ${publicationsError}`
        : "Connected to Shopify, but no Online Store publication was found. Check your store sales channels.",
    };
  }

  const missing = missingScopes(grantedScopes);
  if (missing.length > 0) {
    return {
      ok: false,
      scopes: scope,
      message: `Shopify token is missing required scopes: ${missing.join(", ")}. Add them in Dev Dashboard, release the app version, install the app on this store, then reconnect here.`,
    };
  }

  if (productsError) {
    return {
      ok: false,
      scopes: scope,
      message: `Shopify product access failed: ${productsError}. Confirm the app is installed on ${shopHost} and the Client ID/secret match the active app version.`,
    };
  }

  return {
    ok: false,
    scopes: scope,
    message: publicationsError
      ? `Shopify publications access failed: ${publicationsError}`
      : "Could not verify Shopify connection. Check your credentials and try again.",
  };
}
