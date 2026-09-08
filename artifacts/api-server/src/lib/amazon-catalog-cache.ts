import type { MerchantListingsReportRow } from "./amazon-sp-api.js";

type CacheEntry = {
  rows: MerchantListingsReportRow[];
  fetchedAtMs: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(workspaceId: number, marketplaceCode: string): string {
  return `${workspaceId}:${marketplaceCode}`;
}

export function getCachedAmazonCatalog(
  workspaceId: number,
  marketplaceCode: string,
): MerchantListingsReportRow[] | null {
  const entry = cache.get(cacheKey(workspaceId, marketplaceCode));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAtMs > CACHE_TTL_MS) {
    cache.delete(cacheKey(workspaceId, marketplaceCode));
    return null;
  }
  return entry.rows;
}

export function setCachedAmazonCatalog(
  workspaceId: number,
  marketplaceCode: string,
  rows: MerchantListingsReportRow[],
): void {
  cache.set(cacheKey(workspaceId, marketplaceCode), {
    rows,
    fetchedAtMs: Date.now(),
  });
}
