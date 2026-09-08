export const CATALOG_PREVIEW_PAGE_SIZE = 25;
export const MAX_IMPORT_PER_RUN = 500;
export const DEFAULT_IMPORT_LIMIT = 50;

export type CatalogPreviewItem = {
  id: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  status: string | null;
  subtitle: string | null;
};

export type CatalogPreviewResponse = {
  items: CatalogPreviewItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalHint: number | null;
  nextCursor: string | null;
};

export type MarketplaceImportBody = {
  productIds?: string[];
  limit?: number;
  marketplace?: string;
};

export function parseCatalogPreviewQuery(query: Record<string, unknown>): {
  page: number;
  pageSize: number;
  search: string;
  cursor: string | null;
} {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.pageSize ?? CATALOG_PREVIEW_PAGE_SIZE), 10) || CATALOG_PREVIEW_PAGE_SIZE),
  );
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const cursor = typeof query.cursor === "string" && query.cursor.trim() ? query.cursor.trim() : null;
  return { page, pageSize, search, cursor };
}

export function clampImportLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_IMPORT_LIMIT;
  return Math.min(MAX_IMPORT_PER_RUN, Math.max(1, Math.floor(limit)));
}

export function parseMarketplaceImportBody(body: unknown): MarketplaceImportBody {
  const raw = body as Record<string, unknown> | undefined;
  const productIds = Array.isArray(raw?.productIds)
    ? raw.productIds
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim())
    : undefined;
  const limitRaw = raw?.limit;
  const limit = typeof limitRaw === "number"
    ? limitRaw
    : typeof limitRaw === "string"
      ? Number.parseInt(limitRaw, 10)
      : undefined;
  const marketplace = typeof raw?.marketplace === "string" && raw.marketplace.trim()
    ? raw.marketplace.trim()
    : undefined;
  return {
    productIds: productIds?.length ? productIds : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    marketplace,
  };
}

export function matchesCatalogSearch(
  search: string,
  fields: Array<string | null | undefined>,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}
