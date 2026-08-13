import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export function isRealAmazonAsin(asin: string | null | undefined): boolean {
  const trimmed = asin?.trim();
  if (!trimmed) return false;
  return !isShopifyImportAsin(trimmed) && !isWooCommerceImportAsin(trimmed);
}
