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
import {
  fetchEbayInventoryItemsPage,
  resolveEbayAccessToken,
} from "./ebay-inventory-client.js";
import {
  migrateLegacyEbayListingsForWorkspace,
  type EbayListingMigrateResult,
} from "./ebay-listing-migrate.js";
import type { EbayActiveListing } from "./ebay-trading-client.js";
import { getEbayWorkspaceConnectionPublic } from "./ebay-workspace-connection.js";
import {
  fetchWalmartItemsPage,
  resolveWalmartAccessToken,
} from "./walmart-items-client.js";
import { loadedBuildId } from "./api-build-meta.js";
import { isEbayTradingApiConfigured } from "./ebay-oauth-config.js";
import type { EbayImportDiagnostics } from "./marketplace-catalog-types.js";

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

function mapEbayActiveListingToPreview(listing: EbayActiveListing): CatalogPreviewItem {
  const sku = listing.sku?.trim() || null;
  const id = sku || listing.itemId;
  return {
    id,
    title: listing.title?.trim() || `eBay listing ${listing.itemId}`,
    sku,
    imageUrl: null,
    status: "active",
    subtitle: `Item ${listing.itemId}`,
  };
}

function buildEbayDiagnostics(
  migrate: EbayListingMigrateResult | null,
  connection: Awaited<ReturnType<typeof getEbayWorkspaceConnectionPublic>>,
): EbayImportDiagnostics {
  const environment = connection.environment ?? "sandbox";
  return {
    connectedUsername: connection.username,
    connectedEnvironment: connection.environment,
    activeListingsFound: migrate?.activeListingsFound ?? 0,
    migrated: migrate?.migrated ?? 0,
    skippedAlreadyInventory: migrate?.skippedAlreadyInventory ?? 0,
    skusAssigned: migrate?.skusAssigned ?? 0,
    listingIds: migrate?.listingIds ?? [],
    errors: migrate?.errors ?? [],
    apiBuildId: loadedBuildId,
    tradingApiConfigured: isEbayTradingApiConfigured(environment),
  };
}

function previewFromActiveListings(input: {
  listings: EbayActiveListing[];
  page: number;
  pageSize: number;
  search: string;
  cursor: string | null;
  ebay: EbayImportDiagnostics;
}): CatalogPreviewResponse {
  const filtered = input.listings.filter((listing) => {
    const preview = mapEbayActiveListingToPreview(listing);
    return matchesCatalogSearch(input.search, [preview.title, preview.sku, preview.subtitle]);
  });
  const offset = input.page === 1
    ? 0
    : (input.cursor ? Number.parseInt(input.cursor, 10) : (input.page - 1) * input.pageSize);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const slice = filtered.slice(safeOffset, safeOffset + input.pageSize);
  const nextOffset = safeOffset + slice.length;
  return {
    items: slice.map(mapEbayActiveListingToPreview),
    page: input.page,
    pageSize: input.pageSize,
    hasMore: nextOffset < filtered.length,
    totalHint: filtered.length,
    nextCursor: String(nextOffset),
    ebay: input.ebay,
  };
}

function withEbayDiagnostics(
  response: CatalogPreviewResponse,
  ebay: EbayImportDiagnostics,
): CatalogPreviewResponse {
  return { ...response, ebay };
}

export async function previewEbayCatalog(input: {
  workspaceId: number;
  page: number;
  pageSize: number;
  search: string;
  cursor: string | null;
}): Promise<CatalogPreviewResponse> {
  const connection = await getEbayWorkspaceConnectionPublic(input.workspaceId);
  let migrate: EbayListingMigrateResult | null = null;
  if (input.page === 1 && !input.cursor) {
    migrate = await migrateLegacyEbayListingsForWorkspace({
      workspaceId: input.workspaceId,
      maxListings: 200,
    });
  }
  const ebayDiag = buildEbayDiagnostics(migrate, connection);
  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  const offset = input.page === 1
    ? 0
    : (input.cursor ? Number.parseInt(input.cursor, 10) : (input.page - 1) * input.pageSize);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  if (input.search.trim()) {
    const collected: CatalogPreviewItem[] = [];
    let scanOffset = safeOffset;
    let hasMore = false;
    const maxScan = 2_000;

    while (collected.length < input.pageSize) {
      const batch = await fetchEbayInventoryItemsPage({
        environment,
        accessToken,
        limit: 100,
        offset: scanOffset,
      });
      if (batch.items.length === 0) break;

      for (const item of batch.items) {
        const title = item.product?.title?.trim() || item.sku;
        const preview: CatalogPreviewItem = {
          id: item.sku.trim(),
          title,
          sku: item.sku.trim(),
          imageUrl: item.product?.imageUrls?.[0]?.trim() || null,
          status: item.condition ?? null,
          subtitle: item.sku.trim(),
        };
        if (!matchesCatalogSearch(input.search, [preview.title, preview.sku, preview.subtitle])) continue;
        collected.push(preview);
        if (collected.length >= input.pageSize) break;
      }

      if (!batch.hasMore) break;
      scanOffset += batch.items.length;
      hasMore = batch.hasMore;
      if (scanOffset >= maxScan) break;
    }

    const response: CatalogPreviewResponse = {
      items: collected,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: collected.length >= input.pageSize || hasMore,
      totalHint: null,
      nextCursor: String(scanOffset),
    };
    if (collected.length === 0 && migrate?.activeListings.length) {
      return previewFromActiveListings({
        listings: migrate.activeListings,
        page: input.page,
        pageSize: input.pageSize,
        search: input.search,
        cursor: input.cursor,
        ebay: ebayDiag,
      });
    }
    return withEbayDiagnostics(response, ebayDiag);
  }

  const batch = await fetchEbayInventoryItemsPage({
    environment,
    accessToken,
    limit: input.pageSize,
    offset: safeOffset,
  });

  const items: CatalogPreviewItem[] = batch.items.map((item) => ({
    id: item.sku.trim(),
    title: item.product?.title?.trim() || item.sku.trim(),
    sku: item.sku.trim(),
    imageUrl: item.product?.imageUrls?.[0]?.trim() || null,
    status: item.condition ?? null,
    subtitle: item.sku.trim(),
  }));

  const nextOffset = safeOffset + items.length;
  const response: CatalogPreviewResponse = {
    items,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: batch.hasMore,
    totalHint: batch.total,
    nextCursor: String(nextOffset),
  };
  if (items.length === 0 && migrate?.activeListings.length) {
    return previewFromActiveListings({
      listings: migrate.activeListings,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search,
      cursor: input.cursor,
      ebay: ebayDiag,
    });
  }
  return withEbayDiagnostics(response, ebayDiag);
}

export async function previewWalmartCatalog(input: {
  workspaceId: number;
  page: number;
  pageSize: number;
  search: string;
  cursor: string | null;
}): Promise<CatalogPreviewResponse> {
  const { connection, accessToken } = await resolveWalmartAccessToken(input.workspaceId);
  const nextCursor = input.page === 1 ? null : input.cursor;

  if (input.search.trim()) {
    const collected: CatalogPreviewItem[] = [];
    let scanCursor: string | null = nextCursor;
    let hasMore = false;
    const maxPages = 20;

    for (let i = 0; i < maxPages && collected.length < input.pageSize; i++) {
      const scanned = await fetchWalmartItemsPage({
        connection,
        accessToken,
        limit: 50,
        nextCursor: scanCursor,
      });
      if (scanned.items.length === 0) break;

      for (const item of scanned.items) {
        const preview: CatalogPreviewItem = {
          id: item.sku,
          title: item.productName || item.sku,
          sku: item.sku,
          imageUrl: item.imageUrls[0] ?? null,
          status: item.publishedStatus,
          subtitle: item.wpid ? `WPID ${item.wpid}` : item.sku,
        };
        if (!matchesCatalogSearch(input.search, [preview.title, preview.sku, preview.subtitle, item.upc])) continue;
        collected.push(preview);
        if (collected.length >= input.pageSize) break;
      }

      hasMore = scanned.hasMore;
      scanCursor = scanned.nextCursor;
      if (!hasMore || !scanCursor) break;
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

  const batch = await fetchWalmartItemsPage({
    connection,
    accessToken,
    limit: input.pageSize,
    nextCursor,
  });

  return {
    items: batch.items.map((item) => ({
      id: item.sku,
      title: item.productName || item.sku,
      sku: item.sku,
      imageUrl: item.imageUrls[0] ?? null,
      status: item.publishedStatus,
      subtitle: item.wpid ? `WPID ${item.wpid}` : item.sku,
    })),
    page: input.page,
    pageSize: input.pageSize,
    hasMore: batch.hasMore,
    totalHint: batch.totalItems,
    nextCursor: batch.nextCursor,
  };
}
