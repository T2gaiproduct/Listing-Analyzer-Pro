export function isShopifyImportAsin(asin: string | null | undefined): boolean {
  return typeof asin === "string" && asin.startsWith("shopify:");
}

export type ShopifyVariantLike = {
  sku?: string;
  price?: string;
  inventory_quantity?: number | null;
  available?: boolean | null;
};

export type ShopifyProductLike = {
  published_at?: string | null;
  variants?: ShopifyVariantLike[];
};

export function isShopifyProductPublished(product: ShopifyProductLike): boolean {
  return Boolean(product.published_at?.trim());
}

export function summarizeShopifyVariants(variants: ShopifyVariantLike[] | undefined): {
  inventory: number | null;
  inStock: boolean | null;
} {
  const list = variants ?? [];
  if (list.length === 0) {
    return { inventory: null, inStock: null };
  }

  let totalQty = 0;
  let hasQty = false;
  let anyAvailable = false;
  let allExplicitlyUnavailable = true;

  for (const variant of list) {
    if (typeof variant.inventory_quantity === "number") {
      totalQty += variant.inventory_quantity;
      hasQty = true;
    }
    if (variant.available === true) {
      anyAvailable = true;
      allExplicitlyUnavailable = false;
    } else if (variant.available !== false) {
      allExplicitlyUnavailable = false;
    }
  }

  if (hasQty) {
    return { inventory: totalQty, inStock: totalQty > 0 };
  }
  if (anyAvailable) {
    return { inventory: null, inStock: true };
  }
  if (allExplicitlyUnavailable) {
    return { inventory: 0, inStock: false };
  }
  return { inventory: null, inStock: null };
}

export function parseShopifyPublishedAt(publishedAt: string | null | undefined): Date | null {
  if (!publishedAt?.trim()) return null;
  const parsed = new Date(publishedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
