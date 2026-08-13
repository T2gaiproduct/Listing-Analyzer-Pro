import { eq } from "drizzle-orm";
import { auditsTable, db } from "@workspace/db";
import { findWooCommerceProductBySlug, fetchWooCommerceStoreCurrency } from "./woocommerce-admin-client.js";
import { getWooCommerceConnection } from "./marketplace-connections.js";
import { isWooCommerceImportAsin, woocommerceSlugFromAsin } from "./woocommerce-import-utils.js";
import { refreshWooCommerceProduct } from "./woocommerce-product-sync.js";

/** Refresh WooCommerce listing fields on every product/audit load (live store data for Existing Content). */
export async function maybeRefreshStoreProductListing(input: {
  auditId: number;
  workspaceId: number | null;
  asin: string | null | undefined;
}): Promise<boolean> {
  if (!input.workspaceId || !input.asin?.trim() || !isWooCommerceImportAsin(input.asin)) {
    return false;
  }

  const slug = woocommerceSlugFromAsin(input.asin);
  if (!slug) return false;

  const connection = await getWooCommerceConnection(input.workspaceId);
  if (!connection?.storeUrl || !connection.consumerKey || !connection.consumerSecret) {
    return false;
  }

  try {
    const product = await findWooCommerceProductBySlug({
      storeUrl: connection.storeUrl,
      consumerKey: connection.consumerKey,
      consumerSecret: connection.consumerSecret,
      slug,
    });
    if (!product) return false;

    const storeCurrency = await fetchWooCommerceStoreCurrency({
      storeUrl: connection.storeUrl,
      consumerKey: connection.consumerKey,
      consumerSecret: connection.consumerSecret,
    });

    await refreshWooCommerceProduct({
      auditId: input.auditId,
      workspaceId: input.workspaceId,
      product,
      storeCurrency,
    });
    return true;
  } catch {
    return false;
  }
}

export async function reloadAuditRow(auditId: number) {
  const [row] = await db
    .select()
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);
  return row ?? null;
}
