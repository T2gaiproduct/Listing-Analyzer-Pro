import {
  fetchEbayInventoryItemBySku,
  fetchEbayInventoryItemsPage,
  resolveEbayAccessToken,
} from "./ebay-inventory-client.js";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints } from "./ebay-oauth-config.js";
import { fetchAllEbayActiveListings, type EbayActiveListing } from "./ebay-trading-client.js";

const MIGRATE_BATCH_SIZE = 5;

type BulkMigrateResponse = {
  responses?: Array<{
    statusCode?: number;
    listingId?: string;
    errors?: Array<{ message?: string }>;
    inventoryItems?: Array<{ sku?: string; offerId?: string }>;
  }>;
  errors?: Array<{ message?: string }>;
};

async function postBulkMigrateListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listingIds: string[];
}): Promise<BulkMigrateResponse> {
  const { apiBaseUrl } = ebayOAuthEndpoints(input.environment);
  const res = await fetch(`${apiBaseUrl}/sell/inventory/v1/bulk_migrate_listing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Content-Type": "application/json",
      "Content-Language": "en-US",
    },
    body: JSON.stringify({
      requests: input.listingIds.map((listingId) => ({ listingId })),
    }),
  });
  const text = await res.text();
  if (!text) {
    throw new Error(`eBay bulk_migrate_listing failed (${res.status})`);
  }
  const data = JSON.parse(text) as BulkMigrateResponse;
  if (!res.ok && !data.responses?.length) {
    throw new Error(text);
  }
  return data;
}

async function loadInventorySkuSet(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  maxSkus: number;
}): Promise<Set<string>> {
  const skus = new Set<string>();
  let offset = 0;
  while (skus.size < input.maxSkus) {
    const batch = await fetchEbayInventoryItemsPage({
      environment: input.environment,
      accessToken: input.accessToken,
      limit: 100,
      offset,
    });
    if (batch.items.length === 0) break;
    for (const item of batch.items) {
      skus.add(item.sku.trim());
    }
    if (!batch.hasMore) break;
    offset += batch.items.length;
  }
  return skus;
}

async function listingAlreadyInInventory(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listing: EbayActiveListing;
  inventorySkus: Set<string>;
}): Promise<boolean> {
  const sku = input.listing.sku?.trim();
  if (sku && input.inventorySkus.has(sku)) return true;
  if (sku) {
    const item = await fetchEbayInventoryItemBySku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku,
    });
    if (item) return true;
  }
  return false;
}

export type EbayListingMigrateResult = {
  activeListingsFound: number;
  migrated: number;
  skippedAlreadyInventory: number;
  errors: string[];
};

/**
 * UI / Trading listings → Inventory API via bulk_migrate_listing, then inventory_item import can run.
 */
export async function migrateLegacyEbayListingsForWorkspace(input: {
  workspaceId: number;
  maxListings?: number;
}): Promise<EbayListingMigrateResult> {
  const maxListings = Math.min(Math.max(input.maxListings ?? 100), 500);
  const { accessToken, environment } = await resolveEbayAccessToken(input.workspaceId);
  const result: EbayListingMigrateResult = {
    activeListingsFound: 0,
    migrated: 0,
    skippedAlreadyInventory: 0,
    errors: [],
  };

  let activeListings: EbayActiveListing[] = [];
  try {
    activeListings = await fetchAllEbayActiveListings({
      environment,
      accessToken,
      maxListings,
    });
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : "Could not load active eBay listings (Trading API).",
    );
    return result;
  }

  result.activeListingsFound = activeListings.length;
  if (activeListings.length === 0) return result;

  const inventorySkus = await loadInventorySkuSet({
    environment,
    accessToken,
    maxSkus: maxListings,
  });

  const toMigrate: string[] = [];
  for (const listing of activeListings) {
    const inInventory = await listingAlreadyInInventory({
      environment,
      accessToken,
      listing,
      inventorySkus,
    });
    if (inInventory) {
      result.skippedAlreadyInventory += 1;
      continue;
    }
    toMigrate.push(listing.itemId);
  }

  for (let i = 0; i < toMigrate.length; i += MIGRATE_BATCH_SIZE) {
    const chunk = toMigrate.slice(i, i + MIGRATE_BATCH_SIZE);
    try {
      const response = await postBulkMigrateListing({
        environment,
        accessToken,
        listingIds: chunk,
      });
      if (response.errors?.length) {
        for (const err of response.errors) {
          if (err.message) result.errors.push(err.message);
        }
      }
      for (const row of response.responses ?? []) {
        if (row.statusCode === 200) {
          result.migrated += 1;
          for (const inv of row.inventoryItems ?? []) {
            if (inv.sku?.trim()) inventorySkus.add(inv.sku.trim());
          }
        } else {
          const msg = row.errors?.map((e) => e.message).filter(Boolean).join(" ")
            || `Listing ${row.listingId ?? "?"} could not be migrated`;
          result.errors.push(msg);
        }
      }
    } catch (err) {
      result.errors.push(
        err instanceof Error ? err.message : "bulk_migrate_listing request failed",
      );
    }
  }

  return result;
}
