export type ImportLinkMarketplace = "amazon" | "shopify" | "woocommerce" | "ebay" | "walmart";

export const IMPORT_LINK_MARKETPLACES: {
  id: ImportLinkMarketplace;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    id: "amazon",
    label: "Import from Amazon",
    placeholder: "https://amazon.com/dp/B0… or B0XXXXXXXX",
    hint: "Amazon product URL or 10-character ASIN",
  },
  {
    id: "shopify",
    label: "Import from Shopify",
    placeholder: "https://yourstore.com/products/…",
    hint: "Public Shopify product page URL",
  },
  {
    id: "woocommerce",
    label: "Import from WooCommerce",
    placeholder: "https://yourstore.com/product/…",
    hint: "Public WooCommerce product page URL",
  },
  {
    id: "ebay",
    label: "Import from eBay",
    placeholder: "https://www.ebay.com/itm/…",
    hint: "eBay listing URL",
  },
  {
    id: "walmart",
    label: "Import from Walmart",
    placeholder: "https://www.walmart.com/ip/…",
    hint: "Walmart product page URL",
  },
];

export function marketplaceMatchesUrl(marketplace: ImportLinkMarketplace, rawUrl: string): boolean {
  const trimmed = rawUrl.trim().toLowerCase();
  if (!trimmed) return false;
  if (marketplace === "amazon") {
    return /^[a-z0-9]{10}$/i.test(trimmed.replace(/^(asin:?\s*)/i, ""))
      || trimmed.includes("amazon.");
  }
  if (marketplace === "shopify") {
    return trimmed.includes("myshopify.com") || trimmed.includes("/products/");
  }
  if (marketplace === "woocommerce") {
    return trimmed.includes("/product/") || trimmed.includes("woocommerce") || trimmed.includes("/shop/");
  }
  if (marketplace === "ebay") {
    return trimmed.includes("ebay.");
  }
  if (marketplace === "walmart") {
    return trimmed.includes("walmart.com");
  }
  return true;
}
