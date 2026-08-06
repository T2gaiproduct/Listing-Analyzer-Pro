import type { ProductDetailView } from "@/lib/product-mappers";
import { isBrokenShopifyAmazonUrl, isShopifyImportAsin } from "@/lib/shopify-import";

type AuditRefSource = {
  asin?: string | null;
  referenceLinks?: string | null;
};

export function resolveShopifyReferenceUrl(
  product: Pick<ProductDetailView, "referenceLinks" | "referenceUrl" | "isShopifyImport">,
  audit?: AuditRefSource | null,
): string | null {
  const fromAudit = audit?.referenceLinks?.trim();
  if (fromAudit && !isBrokenShopifyAmazonUrl(fromAudit)) return fromAudit;

  const fromProduct = product.referenceUrl?.trim();
  if (fromProduct && !isBrokenShopifyAmazonUrl(fromProduct)) return fromProduct;

  const fromLink = product.referenceLinks.find(
    (link) => link.label === "Shopify" && link.url.startsWith("http") && !isBrokenShopifyAmazonUrl(link.url),
  )?.url;
  if (fromLink) return fromLink;

  return product.referenceLinks.find(
    (link) => link.url.includes("/products/") && !link.url.includes("amazon."),
  )?.url ?? null;
}

export function normalizeShopifyProductDetail(
  product: ProductDetailView,
  audit?: AuditRefSource | null,
): ProductDetailView {
  const isShopify = product.isShopifyImport === true
    || isShopifyImportAsin(audit?.asin)
    || product.referenceLinks.some((link) => isBrokenShopifyAmazonUrl(link.url));

  if (!isShopify) return product;

  const shopifyUrl = resolveShopifyReferenceUrl(product, audit);
  const competitorLinks = product.referenceLinks.filter(
    (link) => !isBrokenShopifyAmazonUrl(link.url) && link.label !== "Amazon Ref" && link.label !== "Shopify",
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
