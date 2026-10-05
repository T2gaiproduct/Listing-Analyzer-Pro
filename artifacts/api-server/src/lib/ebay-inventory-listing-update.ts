import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";
import {
  discardEbayOfferForRecovery,
  purgeBlockingOffersForSku,
  upsertEbayInventoryItem,
} from "./ebay-inventory-offers.js";
import {
  coerceEbayOfferSku,
  isEbayOfferNotAvailableMessage,
  isValidEbayInventorySku,
} from "./ebay-listing-sku.js";

const MARKETPLACE_ID = "EBAY_US";

type InventoryOfferRow = {
  offerId: string;
  sku: string;
  listingId?: string;
  status?: string;
};

type EbayOfferFull = {
  offerId: string;
  sku?: string;
  categoryId: string;
  marketplaceId: string;
  format: string;
  listingDescription?: string;
  merchantLocationKey: string;
  quantity: number;
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  pricingSummary: {
    price: { value: string; currency: string };
  };
  listing?: { listingId?: string };
};

type EbayInventoryItemFull = {
  sku: string;
  condition?: string;
  product?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
};

export function isInventoryBasedListingReviseError(message: string): boolean {
  return /inventory-based listing management is not currently supported/i.test(message);
}

export function shouldUseInventoryApiAfterTradingReviseError(message: string): boolean {
  return isInventoryBasedListingReviseError(message);
}

function inventoryRowFromOfferFull(
  full: EbayOfferFull,
  status?: string,
): InventoryOfferRow | null {
  const sku = coerceEbayOfferSku(full.sku);
  if (!sku || !isValidEbayInventorySku(sku)) {
    return null;
  }
  return {
    offerId: full.offerId,
    sku,
    listingId: full.listing?.listingId?.trim(),
    status,
  };
}

async function listInventoryOffersPage(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  limit: number;
  offset: number;
}): Promise<{ offers: InventoryOfferRow[]; hasMore: boolean }> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer?marketplace_id=${MARKETPLACE_ID}&limit=${input.limit}&offset=${input.offset}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay offers."));
  }
  const data = JSON.parse(text) as {
    offers?: Array<{
      offerId?: string;
      sku?: string;
      status?: string;
      listing?: { listingId?: string };
    }>;
    total?: number;
  };
  const offers = (data.offers ?? [])
    .map((row) => ({
      offerId: row.offerId?.trim() ?? "",
      sku: coerceEbayOfferSku(row.sku),
      listingId: row.listing?.listingId?.trim(),
      status: row.status?.trim(),
    }))
    .filter((row) => row.offerId);
  const total = typeof data.total === "number" ? data.total : null;
  const hasMore = total != null
    ? input.offset + offers.length < total
    : offers.length >= input.limit;
  return { offers, hasMore };
}

async function hydrateInventoryOfferRow(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  row: InventoryOfferRow;
}): Promise<InventoryOfferRow | null> {
  try {
    const full = await fetchEbayOfferFull({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: input.row.offerId,
    });
    return inventoryRowFromOfferFull(full, input.row.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isEbayOfferNotAvailableMessage(message)) {
      throw err;
    }
    await discardEbayOfferForRecovery({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: input.row.offerId,
      status: input.row.status,
    }).catch(() => undefined);
    return null;
  }
}

export async function findInventoryOfferByListingId(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listingId: string;
}): Promise<InventoryOfferRow | null> {
  const target = input.listingId.trim();
  if (!target) return null;

  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 20; page += 1) {
    const batch = await listInventoryOffersPage({
      environment: input.environment,
      accessToken: input.accessToken,
      limit,
      offset,
    });

    for (const row of batch.offers) {
      if (row.listingId === target) {
        const hydrated = await hydrateInventoryOfferRow({
          environment: input.environment,
          accessToken: input.accessToken,
          row,
        });
        if (hydrated) return hydrated;
      }
    }

    // Paged offer summaries often omit listingId — resolve via GET offer.
    for (const row of batch.offers) {
      if (row.listingId) continue;
      try {
        const full = await fetchEbayOfferFull({
          environment: input.environment,
          accessToken: input.accessToken,
          offerId: row.offerId,
        });
        const listingId = full.listing?.listingId?.trim();
        if (listingId === target) {
          const rowFromFull = inventoryRowFromOfferFull(full, row.status);
          if (rowFromFull) return rowFromFull;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isEbayOfferNotAvailableMessage(message)) {
          await discardEbayOfferForRecovery({
            environment: input.environment,
            accessToken: input.accessToken,
            offerId: row.offerId,
            status: row.status,
          }).catch(() => undefined);
          continue;
        }
        throw err;
      }
    }

    if (!batch.hasMore || batch.offers.length === 0) break;
    offset += batch.offers.length;
  }
  return null;
}

async function fetchOffersBySku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<InventoryOfferRow[]> {
  if (!isValidEbayInventorySku(input.sku)) {
    return [];
  }
  const sku = encodeURIComponent(input.sku.trim());
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer?sku=${sku}&marketplace_id=${MARKETPLACE_ID}&limit=50`,
  );
  const text = await res.text();
  if (!res.ok) {
    return [];
  }
  const data = JSON.parse(text) as {
    offers?: Array<{
      offerId?: string;
      sku?: string;
      status?: string;
      listing?: { listingId?: string };
    }>;
  };
  return (data.offers ?? [])
    .map((row) => ({
      offerId: row.offerId?.trim() ?? "",
      sku: coerceEbayOfferSku(row.sku),
      listingId: row.listing?.listingId?.trim(),
      status: row.status?.trim(),
    }))
    .filter((row) => row.offerId);
}

export async function resolveInventoryOfferForListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listingId: string;
  skuCandidates: string[];
  /** When true (push), only match offers tied to this listing id — avoids stale SKU offers. */
  listingIdOnly?: boolean;
}): Promise<InventoryOfferRow | null> {
  const byListing = await findInventoryOfferByListingId({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId: input.listingId,
  });
  if (byListing) return byListing;

  if (input.listingIdOnly) {
    return null;
  }

  for (const sku of input.skuCandidates) {
    const trimmed = sku.trim();
    if (!isValidEbayInventorySku(trimmed)) continue;
    const offers = await fetchOffersBySku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku: trimmed,
    });
    for (const row of offers) {
      if (row.listingId !== input.listingId) {
        continue;
      }
      const hydrated = await hydrateInventoryOfferRow({
        environment: input.environment,
        accessToken: input.accessToken,
        row,
      });
      if (hydrated) return hydrated;
    }
  }
  return null;
}

async function fetchEbayOfferFull(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<EbayOfferFull> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay offer."));
  }
  const data = JSON.parse(text) as EbayOfferFull & { offerId?: string };
  const offerId = data.offerId?.trim() ?? input.offerId;
  if (!data.categoryId || !data.listingPolicies?.fulfillmentPolicyId) {
    throw new Error("eBay offer is missing category or business policies.");
  }
  return { ...data, offerId };
}

async function fetchEbayInventoryItemFull(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<EbayInventoryItemFull | null> {
  const skuEncoded = encodeURIComponent(input.sku.trim());
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item/${skuEncoded}`,
  );
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay inventory item."));
  }
  return JSON.parse(text) as EbayInventoryItemFull;
}

function mapInventoryCondition(raw: string | undefined): "NEW" | "LIKE_NEW" | "USED_EXCELLENT" {
  const value = raw?.trim().toUpperCase();
  if (value === "LIKE_NEW") return "LIKE_NEW";
  if (value?.startsWith("USED")) return "USED_EXCELLENT";
  return "NEW";
}

async function updateInventoryBasedEbayListingOnce(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerRow: InventoryOfferRow;
  auditId: number;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
  priceCents: number | null;
  currency: string;
}): Promise<{ listingId: string; inventorySku: string; warning?: string }> {
  const offer = await fetchEbayOfferFull({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: input.offerRow.offerId,
  });

  const inventorySku = coerceEbayOfferSku(offer.sku).trim();
  if (!isValidEbayInventorySku(inventorySku)) {
    throw new Error(
      `[25707] This is an invalid value for a SKU. Only alphanumeric characters can be used for SKUs, and their length must not exceed 50 characters. `
      + `Your eBay listing uses SKU "${coerceEbayOfferSku(offer.sku) || input.offerRow.sku}". `
      + "SellerLens will update this listing via eBay Trading instead of Inventory.",
    );
  }

  const existingItem = await fetchEbayInventoryItemFull({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: inventorySku,
  });

  const quantity = existingItem?.availability?.shipToLocationAvailability?.quantity
    ?? offer.quantity
    ?? 1;

  await upsertEbayInventoryItem({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: inventorySku,
    title: input.title,
    descriptionHtml: input.descriptionHtml,
    imageUrls: input.pictureUrls,
    quantity: Math.max(1, quantity),
    condition: mapInventoryCondition(existingItem?.condition),
    aspects: existingItem?.product?.aspects,
  });

  const priceValue = input.priceCents != null && input.priceCents > 0
    ? (input.priceCents / 100).toFixed(2)
    : offer.pricingSummary.price.value;
  const currency = (input.currency?.trim() || offer.pricingSummary.price.currency || "USD").toUpperCase();

  const offerBody = {
    sku: inventorySku,
    marketplaceId: offer.marketplaceId || MARKETPLACE_ID,
    format: offer.format || "FIXED_PRICE",
    categoryId: offer.categoryId,
    listingDescription: input.descriptionHtml,
    listingPolicies: offer.listingPolicies,
    pricingSummary: {
      price: { value: priceValue, currency },
    },
    quantity: Math.max(1, quantity),
    merchantLocationKey: offer.merchantLocationKey,
  };

  const updateRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(offer.offerId)}`,
    { method: "PUT", body: JSON.stringify(offerBody) },
  );
  const updateText = await updateRes.text();
  if (!updateRes.ok) {
    throw new Error(parseEbayRestError(updateText, "Could not update eBay inventory offer."));
  }

  const listingId = offer.listing?.listingId?.trim()
    ?? input.offerRow.listingId?.trim();
  if (!listingId) {
    throw new Error("eBay offer updated but listing id was not found.");
  }

  const warning = input.priceCents == null || input.priceCents <= 0
    ? "Price was not updated — set a price in Product Explorer and push again."
    : undefined;

  return { listingId, inventorySku, warning };
}

export async function updateInventoryBasedEbayListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerRow: InventoryOfferRow;
  listingId: string;
  auditId: number;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
  priceCents: number | null;
  currency: string;
}): Promise<{ listingId: string; inventorySku: string; warning?: string }> {
  const targetListingId = input.listingId.trim();
  let offerRow = input.offerRow;
  let staleRecoveryWarning: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await updateInventoryBasedEbayListingOnce({
        environment: input.environment,
        accessToken: input.accessToken,
        offerRow,
        auditId: input.auditId,
        title: input.title,
        descriptionHtml: input.descriptionHtml,
        pictureUrls: input.pictureUrls,
        priceCents: input.priceCents,
        currency: input.currency,
      });
      const warnings = [staleRecoveryWarning, result.warning].filter(Boolean);
      return {
        ...result,
        warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isEbayOfferNotAvailableMessage(message) || attempt > 0) {
        throw err;
      }

      const sku = offerRow.sku.trim();
      if (sku) {
        await purgeBlockingOffersForSku({
          environment: input.environment,
          accessToken: input.accessToken,
          sku,
        });
      }
      await discardEbayOfferForRecovery({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: offerRow.offerId,
        status: offerRow.status,
      }).catch(() => undefined);

      const resolved = await findInventoryOfferByListingId({
        environment: input.environment,
        accessToken: input.accessToken,
        listingId: targetListingId,
      });
      if (!resolved) {
        throw new Error(
          `${message} SellerLens cleared stale sandbox offers but could not find a live inventory offer for listing ${targetListingId}. `
          + "In eBay sandbox Seller Hub, confirm the listing is active or reconnect and import the listing again.",
        );
      }
      offerRow = resolved;
      staleRecoveryWarning =
        "eBay had a stale inventory offer for this listing. SellerLens found the live offer and retried the push.";
    }
  }

  throw new Error("Could not update eBay inventory listing.");
}
