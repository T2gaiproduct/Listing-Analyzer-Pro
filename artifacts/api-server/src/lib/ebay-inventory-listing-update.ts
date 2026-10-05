import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";
import { upsertEbayInventoryItem } from "./ebay-inventory-offers.js";

const MARKETPLACE_ID = "EBAY_US";

type InventoryOfferRow = {
  offerId: string;
  sku: string;
  listingId?: string;
  status?: string;
};

type EbayOfferFull = {
  offerId: string;
  sku: string;
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
      sku: row.sku?.trim() ?? "",
      listingId: row.listing?.listingId?.trim(),
      status: row.status?.trim(),
    }))
    .filter((row) => row.offerId && row.sku);
  const total = typeof data.total === "number" ? data.total : null;
  const hasMore = total != null
    ? input.offset + offers.length < total
    : offers.length >= input.limit;
  return { offers, hasMore };
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
  for (let page = 0; page < 10; page += 1) {
    const batch = await listInventoryOffersPage({
      environment: input.environment,
      accessToken: input.accessToken,
      limit,
      offset,
    });
    const match = batch.offers.find((row) => row.listingId === target);
    if (match) return match;
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
      sku: row.sku?.trim() ?? "",
      listingId: row.listing?.listingId?.trim(),
      status: row.status?.trim(),
    }))
    .filter((row) => row.offerId && row.sku);
}

export async function resolveInventoryOfferForListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listingId: string;
  skuCandidates: string[];
}): Promise<InventoryOfferRow | null> {
  const byListing = await findInventoryOfferByListingId({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId: input.listingId,
  });
  if (byListing) return byListing;

  for (const sku of input.skuCandidates) {
    const trimmed = sku.trim();
    if (!trimmed) continue;
    const offers = await fetchOffersBySku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku: trimmed,
    });
    const match = offers.find((row) => row.listingId === input.listingId) ?? offers[0];
    if (match) return match;
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
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku.trim())}`,
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

export async function updateInventoryBasedEbayListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerRow: InventoryOfferRow;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
  priceCents: number | null;
  currency: string;
}): Promise<{ listingId: string; warning?: string }> {
  const offer = await fetchEbayOfferFull({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: input.offerRow.offerId,
  });

  const inventorySku = input.offerRow.sku.trim();
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
    sku: offer.sku,
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

  return { listingId, warning };
}
