import type { ResolvedAmazonConnection } from "./resolve-amazon-settings.js";
import { fetchMerchantListingsAllDataReport } from "./amazon-sp-api.js";
import { getCachedAmazonCatalog, setCachedAmazonCatalog } from "./amazon-catalog-cache.js";
import {
  type CatalogPreviewItem,
  type CatalogPreviewResponse,
  matchesCatalogSearch,
} from "./marketplace-catalog-types.js";
import {
  fetchShopifyCatalogPage,
  fetchShopifyProductsByIds,
  getShopifyAccessToken,
  parseShopifyShopHost,
  type ShopifyAdminCatalogProduct,
} from "./shopify-admin-client.js";
import {
  fetchShopifyCatalogProducts,
  type ShopifyCatalogProduct,
} from "./shopify-product-sync.js";
import { fetchWooCommerceProducts } from "./woocommerce-admin-client.js";

function mapShopifyAdminProduct(product: ShopifyAdminCatalogProduct): CatalogPreviewItem {
  const sku = product.variants?.find((variant) => variant.sku?.trim())?.sku?.trim() ?? null;
  return {
    id: String(product.id),
    title: product.title?.trim() || "Untitled product",
    sku,
    imageUrl: product.images?.[0]?.src?.trim() || null,
    status: product.status ?? null,
    subtitle: product.handle?.trim() || null,
  };
}

function mapShopifyPublicProduct(product: ShopifyCatalogProduct): CatalogPreviewItem {
  const sku = product.variants?.find((variant) => variant.sku?.trim())?.sku?.trim() ?? null;
  return {
    id: String(product.id),
    title: product.title?.trim() || "Untitled product",
    sku,
    imageUrl: product.images?.[0]?.src?.trim() || null,
    status: product.published_at ? "active" : "draft",
    subtitle: product.handle?.trim() || null,
  };
}

export async function previewShopifyCatalog(input: {
  storeUrl: string;
  clientId?: string;
  clientSecret?: string;
  page: number;
  pageSize: number;
  search: string;
  cursor: string | null;
}): Promise<CatalogPreviewResponse> {
  if (input.clientId?.trim() && input.clientSecret?.trim()) {
    const shopHost = parseShopifyShopHost(input.storeUrl);
    const accessToken = await getShopifyAccessToken({
      shopHost,
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
    });

    if (input.search) {
      const collected: CatalogPreviewItem[] = [];
      let scanCursor = input.page === 1 ? null : input.cursor;
      let hasMore = false;
      let scanned = 0;
      const maxScan = 2_000;

      while (collected.length < input.pageSize && scanned < maxScan) {
        const batch = await fetchShopifyCatalogPage({
          shopHost,
          accessToken,
          pageSize: 250,
          sinceId: scanCursor ? Number.parseInt(scanCursor, 10) : null,
        });
        if (batch.products.length === 0) break;

        scanned += batch.products.length;
        for (const product of batch.products) {
          const item = mapShopifyAdminProduct(product);
          if (!matchesCatalogSearch(input.search, [item.title, item.sku, item.subtitle])) continue;
          collected.push(item);
          if (collected.length >= input.pageSize) break;
        }

        if (!batch.hasMore) break;
        scanCursor = batch.nextCursor;
        hasMore = batch.hasMore;
      }

      return {
        items: collected,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: collected.length >= input.pageSize || hasMore,
        totalHint: null,
        nextCursor: scanCursor,
      };
    }

    const sinceId = input.page === 1
      ? null
      : (input.cursor ? Number.parseInt(input.cursor, 10) : null);
    const batch = await fetchShopifyCatalogPage({
      shopHost,
      accessToken,
      pageSize: input.pageSize,
      sinceId: Number.isFinite(sinceId) ? sinceId : null,
    });

    return {
      items: batch.products.map(mapShopifyAdminProduct),
      page: input.page,
      pageSize: input.pageSize,
      hasMore: batch.hasMore,
      totalHint: null,
      nextCursor: batch.nextCursor,
    };
  }

  const catalog = await fetchShopifyCatalogProducts(input.storeUrl);
  const filtered = catalog.filter((product) => matchesCatalogSearch(input.search, [
    product.title,
    product.handle,
    product.variants?.find((variant) => variant.sku)?.sku,
  ]));
  const offset = (input.page - 1) * input.pageSize;
  const items = filtered.slice(offset, offset + input.pageSize).map(mapShopifyPublicProduct);

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: offset + input.pageSize < filtered.length,
    totalHint: filtered.length,
    nextCursor: null,
  };
}

export async function previewWooCommerceCatalog(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  page: number;
  pageSize: number;
  search: string;
}): Promise<CatalogPreviewResponse> {
  const products = await fetchWooCommerceProducts({
    storeUrl: input.storeUrl,
    consumerKey: input.consumerKey,
    consumerSecret: input.consumerSecret,
    page: input.page,
    perPage: input.pageSize,
    search: input.search || undefined,
  });

  const items: CatalogPreviewItem[] = products.map((product) => ({
    id: String(product.id),
    title: product.name?.trim() || "Untitled product",
    sku: product.sku?.trim() || null,
    imageUrl: product.images?.[0]?.src?.trim() || null,
    status: product.status ?? null,
    subtitle: product.slug?.trim() || null,
  }));

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: products.length >= input.pageSize,
    totalHint: null,
    nextCursor: null,
  };
}

async function loadAmazonCatalogRows(input: {
  connection: ResolvedAmazonConnection;
  marketplaceCode: string;
  workspaceId: number;
}): Promise<import("./amazon-sp-api.js").MerchantListingsReportRow[]> {
  const cached = getCachedAmazonCatalog(input.workspaceId, input.marketplaceCode);
  if (cached) return cached;

  const rows = await fetchMerchantListingsAllDataReport({
    settings: input.connection.settings,
    refreshToken: input.connection.refreshToken,
    marketplaceCode: input.marketplaceCode,
  });
  setCachedAmazonCatalog(input.workspaceId, input.marketplaceCode, rows);
  return rows;
}

export async function previewAmazonCatalog(input: {
  connection: ResolvedAmazonConnection;
  workspaceId: number;
  marketplaceCode: string;
  page: number;
  pageSize: number;
  search: string;
}): Promise<CatalogPreviewResponse> {
  const rows = await loadAmazonCatalogRows(input);
  const filtered = rows.filter((row) => matchesCatalogSearch(input.search, [
    row.title,
    row.sku,
    row.asin,
  ]));
  const offset = (input.page - 1) * input.pageSize;
  const slice = filtered.slice(offset, offset + input.pageSize);

  const items: CatalogPreviewItem[] = slice.map((row) => ({
    id: row.asin?.trim() || row.sku.trim(),
    title: row.title.trim() || row.sku.trim() || "Amazon listing",
    sku: row.sku.trim() || null,
    imageUrl: row.imageUrl,
    status: row.status,
    subtitle: row.asin?.trim() || null,
  }));

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: offset + input.pageSize < filtered.length,
    totalHint: filtered.length,
    nextCursor: null,
  };
}

export async function fetchShopifyCatalogForImport(input: {
  storeUrl: string;
  clientId?: string;
  clientSecret?: string;
  productIds?: string[];
  limit: number;
  search?: string;
}): Promise<ShopifyCatalogProduct[]> {
  if (input.productIds?.length) {
    if (!input.clientId?.trim() || !input.clientSecret?.trim()) {
      throw new Error("Shopify Admin API credentials are required to import selected products.");
    }
    const shopHost = parseShopifyShopHost(input.storeUrl);
    const accessToken = await getShopifyAccessToken({
      shopHost,
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
    });
    const ids = input.productIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id));
    const products = await fetchShopifyProductsByIds({
      shopHost,
      accessToken,
      productIds: ids,
    });
    return products.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      body_html: product.body_html,
      vendor: product.vendor,
      product_type: product.product_type,
      tags: product.tags,
      published_at: product.published_at,
      images: product.images,
      variants: product.variants,
    }));
  }

  const catalog = input.clientId?.trim() && input.clientSecret?.trim()
    ? await (async () => {
      const shopHost = parseShopifyShopHost(input.storeUrl);
      const accessToken = await getShopifyAccessToken({
        shopHost,
        clientId: input.clientId!.trim(),
        clientSecret: input.clientSecret!.trim(),
      });
      const collected: ShopifyAdminCatalogProduct[] = [];
      let sinceId: number | null = null;
      while (collected.length < input.limit) {
        const batch = await fetchShopifyCatalogPage({
          shopHost,
          accessToken,
          pageSize: Math.min(250, input.limit - collected.length),
          sinceId,
        });
        if (batch.products.length === 0) break;
        const filtered = batch.products.filter((product) => matchesCatalogSearch(input.search ?? "", [
          product.title,
          product.handle,
          product.variants?.find((variant) => variant.sku)?.sku,
        ]));
        collected.push(...filtered);
        if (!batch.hasMore) break;
        sinceId = batch.nextCursor ? Number.parseInt(batch.nextCursor, 10) : null;
      }
      return collected.map((product) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        body_html: product.body_html,
        vendor: product.vendor,
        product_type: product.product_type,
        tags: product.tags,
        published_at: product.published_at,
        images: product.images,
        variants: product.variants,
      }));
    })()
    : await fetchShopifyCatalogProducts(input.storeUrl);

  const filtered = catalog.filter((product) => matchesCatalogSearch(input.search ?? "", [
    product.title,
    product.handle,
    product.variants?.find((variant) => variant.sku)?.sku,
  ]));
  return filtered.slice(0, input.limit);
}
