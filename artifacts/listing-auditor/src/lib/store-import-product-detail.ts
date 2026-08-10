import type { ProductDetailView } from "@/lib/product-mappers";
import { isShopifyImportAsin } from "@/lib/shopify-import";
import { isWooCommerceImportAsin } from "@/lib/woocommerce-import";

type AuditRefSource = {
  asin?: string | null;
  referenceLinks?: string | null;
};

export function normalizeStoreImportProductDetail(
  product: ProductDetailView,
  audit?: AuditRefSource | null,
): ProductDetailView {
  const isShopify = product.isShopifyImport === true || isShopifyImportAsin(audit?.asin);
  const isWooCommerce = product.isWooCommerceImport === true || isWooCommerceImportAsin(audit?.asin);

  if (!isShopify && !isWooCommerce) return product;

  if (isShopify) {
    const shopifyUrl = product.referenceUrl?.trim()
      || product.referenceLinks.find((link) => link.label === "Shopify")?.url
      || null;
    const competitorLinks = product.referenceLinks.filter(
      (link) => link.label !== "Amazon Ref" && link.label !== "Shopify",
    );
    return {
      ...product,
      sourceType: "listing",
      sourceTypeLabel: "Shopify Import",
      stageLabel: product.stageLabel === "Audit in progress" || product.stageLabel === "Audit Results"
        ? "Imported from Shopify"
        : product.stageLabel,
      isShopifyImport: true,
      referenceUrl: shopifyUrl,
      referenceLinks: shopifyUrl
        ? [{ label: "Shopify", url: shopifyUrl }, ...competitorLinks]
        : competitorLinks,
    };
  }

  const wooUrl = product.referenceUrl?.trim()
    || product.referenceLinks.find((link) => link.label === "WooCommerce")?.url
    || null;
  const competitorLinks = product.referenceLinks.filter(
    (link) => link.label !== "Amazon Ref" && link.label !== "WooCommerce",
  );

  return {
    ...product,
    sourceType: "listing",
    sourceTypeLabel: "WooCommerce Import",
    stageLabel: product.stageLabel === "Audit in progress" || product.stageLabel === "Audit Results"
      ? "Imported from WooCommerce"
      : product.stageLabel,
    isWooCommerceImport: true,
    referenceUrl: wooUrl,
    referenceLinks: wooUrl
      ? [{ label: "WooCommerce", url: wooUrl }, ...competitorLinks]
      : competitorLinks,
  };
}
