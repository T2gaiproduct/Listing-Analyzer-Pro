import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { coerceEbayOfferSku, isValidEbayInventorySku } from "./ebay-listing-sku.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";
import {
  fetchEbayTradingItemDetails,
  isEbayTradingListingActive,
} from "./ebay-trading-client.js";

const MARKETPLACE_ID = "EBAY_US";

export async function resolveEbayMerchantLocationKey(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
}): Promise<string> {
  const res = await ebayRestFetch(input.environment, input.accessToken, "/sell/inventory/v1/location?limit=10");
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay inventory locations."));
  }
  const data = JSON.parse(text) as { locations?: Array<{ merchantLocationKey?: string }> };
  const key = data.locations?.find((row) => row.merchantLocationKey?.trim())?.merchantLocationKey?.trim();
  if (key) return key;

  const merchantLocationKey = "sellerlens_default";
  const createRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/location/${merchantLocationKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        location: {
          address: {
            addressLine1: "123 Main St",
            city: "San Jose",
            stateOrProvince: "CA",
            postalCode: "95125",
            country: "US",
          },
        },
        locationTypes: ["WAREHOUSE"],
        name: "SellerLens default",
        merchantLocationStatus: "ENABLED",
      }),
    },
  );
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(
      parseEbayRestError(
        createText,
        "No eBay inventory location found. Add a warehouse location in eBay Seller Hub, then try again.",
      ),
    );
  }
  return merchantLocationKey;
}

export async function upsertEbayInventoryItem(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
  title: string;
  descriptionHtml: string;
  imageUrls: string[];
  quantity: number;
  condition: "NEW" | "LIKE_NEW" | "USED_EXCELLENT";
  aspects?: Record<string, string[]>;
}): Promise<void> {
  const skuEncoded = encodeURIComponent(input.sku.trim());
  const aspects = input.aspects && Object.keys(input.aspects).length > 0
    ? input.aspects
    : undefined;
  const body = {
    product: {
      title: input.title,
      description: input.descriptionHtml,
      imageUrls: input.imageUrls.filter(Boolean).slice(0, 12),
      ...(aspects ? { aspects } : {}),
    },
    condition: input.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: Math.max(1, input.quantity),
      },
    },
  };

  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item/${skuEncoded}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not create eBay inventory item."));
  }
}

type EbayOfferSummary = {
  offerId: string;
  status?: string;
  listingId?: string;
};

function isEbayOfferNotAvailableError(message: string): boolean {
  return /\[?25713\]?|offer is not available/i.test(message);
}

function isEbayOfferMissingError(message: string): boolean {
  return /25710|didn't find the resource|could not load eBay offer/i.test(message);
}

function buildOfferPayload(input: {
  sku: string;
  categoryId: string;
  priceCents: number;
  currency: string;
  quantity: number;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
  listingDescriptionHtml: string;
}) {
  const priceValue = (input.priceCents / 100).toFixed(2);
  const currency = (input.currency?.trim() || "USD").toUpperCase();
  return {
    sku: input.sku.trim(),
    marketplaceId: MARKETPLACE_ID,
    format: "FIXED_PRICE",
    categoryId: input.categoryId.trim(),
    listingDescription: input.listingDescriptionHtml,
    listingPolicies: {
      fulfillmentPolicyId: input.fulfillmentPolicyId,
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
    },
    pricingSummary: {
      price: {
        value: priceValue,
        currency,
      },
    },
    quantity: Math.max(1, input.quantity),
    merchantLocationKey: input.merchantLocationKey,
  };
}

async function fetchOffersBySku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<EbayOfferSummary[]> {
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
    throw new Error(parseEbayRestError(text, "Could not load existing eBay offers for this SKU."));
  }
  const data = JSON.parse(text) as {
    offers?: Array<{
      offerId?: string;
      status?: string;
      listing?: { listingId?: string };
    }>;
  };
  return (data.offers ?? [])
    .map((row) => ({
      offerId: row.offerId?.trim() ?? "",
      status: row.status?.trim(),
      listingId: row.listing?.listingId?.trim(),
    }))
    .filter((row) => row.offerId);
}

async function tryFetchOfferDetails(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<EbayOfferSummary | null> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}`,
  );
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) {
    const message = parseEbayRestError(text, "Could not load eBay offer details.");
    if (isEbayOfferNotAvailableError(message) || isEbayOfferMissingError(message)) {
      return null;
    }
    throw new Error(message);
  }
  const data = JSON.parse(text) as {
    offerId?: string;
    status?: string;
    listing?: { listingId?: string };
  };
  return {
    offerId: data.offerId?.trim() ?? input.offerId,
    status: data.status?.trim(),
    listingId: data.listing?.listingId?.trim(),
  };
}

function liveListingIdFromOffer(details: EbayOfferSummary): string | null {
  const listingId = details.listingId?.trim();
  if (listingId) return listingId;
  return null;
}

function auditInventorySkuPattern(auditId: number): RegExp {
  return new RegExp(`^SL${auditId}(R[A-Z0-9]*)?$`, "i");
}

async function isOfferLinkedToReachableListing(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  details: EbayOfferSummary;
}): Promise<boolean> {
  const listingId = liveListingIdFromOffer(input.details);
  if (!listingId) return false;
  return isEbayListingReachableOnTrading({
    environment: input.environment,
    accessToken: input.accessToken,
    listingId,
  });
}

async function listAllInventoryOfferSummaries(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  limit: number;
  offset: number;
}): Promise<{ offers: Array<{ offerId: string; sku?: string; status?: string; listingId?: string }>; hasMore: boolean }> {
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
      status: row.status?.trim(),
      listingId: row.listing?.listingId?.trim(),
    }))
    .filter((row) => row.offerId);
  const total = typeof data.total === "number" ? data.total : null;
  const hasMore = total != null
    ? input.offset + offers.length < total
    : offers.length >= input.limit;
  return { offers, hasMore };
}

/** Sandbox: remove ghost offers for SL{auditId}* SKUs (common cause of 25713 on List as new). */
export async function purgeStaleOffersForAuditInventorySkus(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  auditId: number;
}): Promise<void> {
  const skuPattern = auditInventorySkuPattern(input.auditId);
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 25; page++) {
    const batch = await listAllInventoryOfferSummaries({
      environment: input.environment,
      accessToken: input.accessToken,
      limit,
      offset,
    });
    for (const row of batch.offers) {
      let sku = row.sku?.trim() ?? "";
      if (!sku || !skuPattern.test(sku)) {
        const fullRes = await ebayRestFetch(
          input.environment,
          input.accessToken,
          `/sell/inventory/v1/offer/${encodeURIComponent(row.offerId)}`,
        );
        if (fullRes.ok) {
          const full = JSON.parse(await fullRes.text()) as { sku?: string };
          sku = coerceEbayOfferSku(full.sku);
        }
      }
      if (!sku || !skuPattern.test(sku)) continue;
      const details: EbayOfferSummary = {
        offerId: row.offerId,
        status: row.status,
        listingId: row.listingId,
      };
      const refreshed = await tryFetchOfferDetails({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: row.offerId,
      });
      const offerDetails = refreshed ?? details;
      if (await isOfferLinkedToReachableListing({
        environment: input.environment,
        accessToken: input.accessToken,
        details: offerDetails,
      })) {
        continue;
      }
      await removeStaleOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: row.offerId,
        status: offerDetails.status,
      }).catch(() => undefined);
      await deleteEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: row.offerId,
      }).catch(() => undefined);
      if (isValidEbayInventorySku(sku)) {
        await deleteEbayInventoryItem({
          environment: input.environment,
          accessToken: input.accessToken,
          sku,
        }).catch(() => undefined);
      }
    }
    if (!batch.hasMore || batch.offers.length === 0) break;
    offset += batch.offers.length;
  }
}

async function isEbayListingReachableOnTrading(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  listingId: string;
}): Promise<boolean> {
  const listingId = input.listingId.trim();
  if (!listingId) return false;
  try {
    const item = await fetchEbayTradingItemDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      itemId: listingId,
    });
    return Boolean(item.itemId?.trim()) && isEbayTradingListingActive(item);
  } catch {
    return false;
  }
}

/** Withdraw/delete a single offer (e.g. after sandbox 25713 on push). */
export async function discardEbayOfferForRecovery(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
  status?: string;
}): Promise<void> {
  await removeStaleOffer(input);
}

async function removeStaleOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
  status?: string;
}): Promise<void> {
  if (input.status?.toUpperCase() === "PUBLISHED") {
    await withdrawEbayOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: input.offerId,
    }).catch(() => undefined);
  }
  await deleteEbayOffer({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: input.offerId,
  }).catch(() => undefined);
}

/** Remove unpublished / ended offers for this SKU so a new offer can be published. */
async function findPublishedListingForInventorySku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<{ offerId: string; listingId: string } | null> {
  const existing = await fetchOffersBySku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
  });
  for (const row of existing) {
    const details = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
    });
    if (!details) continue;
    const listingId = liveListingIdFromOffer(details);
    if (!listingId) continue;
    const active = await isEbayListingReachableOnTrading({
      environment: input.environment,
      accessToken: input.accessToken,
      listingId,
    });
    if (active) {
      return { offerId: details.offerId, listingId };
    }
  }
  return null;
}

/** Aggressive purge for List as new — remove every offer on this SKU unless it has a live listing id. */
export async function purgeAllOffersForCreateSku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<void> {
  const existing = await fetchOffersBySku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
  });
  for (const row of existing) {
    const details = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
    });
    if (details && await isOfferLinkedToReachableListing({
      environment: input.environment,
      accessToken: input.accessToken,
      details,
    })) {
      continue;
    }
    await removeStaleOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
      status: details?.status ?? row.status,
    }).catch(() => undefined);
    await deleteEbayOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
    }).catch(() => undefined);
  }
}

export async function purgeBlockingOffersForSku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
  exceptOfferId?: string;
}): Promise<void> {
  const existing = await fetchOffersBySku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
  });
  for (const row of existing) {
    if (row.offerId === input.exceptOfferId) continue;
    const details = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
    });
    if (!details) {
      await deleteEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: row.offerId,
      }).catch(() => undefined);
      continue;
    }
    if (await isOfferLinkedToReachableListing({
      environment: input.environment,
      accessToken: input.accessToken,
      details,
    })) {
      continue;
    }
    await removeStaleOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: details.offerId,
      status: details.status,
    });
  }
}

async function updateEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
  payload: ReturnType<typeof buildOfferPayload>;
}): Promise<void> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}`,
    { method: "PUT", body: JSON.stringify(input.payload) },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not update eBay offer."));
  }
}

async function withdrawEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<void> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}/withdraw`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (res.status === 404) return;
  const text = await res.text();
  if (!res.ok) {
    const message = parseEbayRestError(text, "Could not withdraw eBay offer.");
    if (isEbayOfferNotAvailableError(message) || isEbayOfferMissingError(message)) {
      return;
    }
    throw new Error(message);
  }
}

async function deleteEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<void> {
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}`,
    { method: "DELETE" },
  );
  if (res.status === 404) return;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not delete stale eBay offer."));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilOfferReady(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<void> {
  const delaysMs = [0, 300, 600, 1200, 2000, 3500];
  for (const delay of delaysMs) {
    if (delay > 0) await sleep(delay);
    const details = await tryFetchOfferDetails(input);
    if (details) return;
  }
}

async function createEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  payload: ReturnType<typeof buildOfferPayload>;
}): Promise<string> {
  const createRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    "/sell/inventory/v1/offer",
    { method: "POST", body: JSON.stringify(input.payload) },
  );
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(parseEbayRestError(createText, "Could not create eBay offer."));
  }
  const created = JSON.parse(createText) as { offerId?: string };
  const offerId = created.offerId?.trim();
  if (!offerId) throw new Error("eBay did not return an offer id.");
  return offerId;
}

/** Create offer, wait for sandbox read-after-write, and recover from duplicate SKU offers. */
async function createEbayOfferReady(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  payload: ReturnType<typeof buildOfferPayload>;
}): Promise<string> {
  const sku = input.payload.sku.trim();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const offerId = await createEbayOffer(input);
      await waitUntilOfferReady({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId,
      });
      return offerId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(message) && attempt < 4) {
        await purgeBlockingOffersForSku({
          environment: input.environment,
          accessToken: input.accessToken,
          sku,
        });
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not create eBay offer after clearing duplicate sandbox offers.");
}

export async function deleteEbayInventoryItem(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
}): Promise<void> {
  const skuEncoded = encodeURIComponent(input.sku.trim());
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/inventory_item/${skuEncoded}`,
    { method: "DELETE" },
  );
  if (res.status === 404) return;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not delete eBay inventory item."));
  }
}

async function publishEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
}): Promise<string> {
  const publishRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(input.offerId)}/publish`,
    { method: "POST", body: JSON.stringify({}) },
  );
  const publishText = await publishRes.text();
  if (!publishRes.ok) {
    throw new Error(parseEbayRestError(publishText, "Could not publish eBay listing."));
  }
  const published = JSON.parse(publishText) as { listingId?: string };
  const listingId = published.listingId?.trim();
  if (!listingId) throw new Error("eBay published the offer but did not return a listing id.");
  return listingId;
}

async function resolveOfferIdForPublish(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
  payload: ReturnType<typeof buildOfferPayload>;
}): Promise<{
  offerId: string;
  listingId?: string;
  alreadyPublished: boolean;
  linkExistingWarning?: string;
}> {
  const existing = await fetchOffersBySku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
  });

  const draftCandidates: EbayOfferSummary[] = [];

  for (const row of existing) {
    const details = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: row.offerId,
    });
    if (!details) {
      await deleteEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: row.offerId,
      }).catch(() => undefined);
      continue;
    }
    const listingId = liveListingIdFromOffer(details);
    if (listingId) {
      const reachable = await isEbayListingReachableOnTrading({
        environment: input.environment,
        accessToken: input.accessToken,
        listingId,
      });
      if (reachable) {
        return {
          offerId: details.offerId,
          listingId,
          alreadyPublished: true,
          linkExistingWarning:
            "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
        };
      }
      await removeStaleOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: details.offerId,
        status: details.status,
      }).catch(() => undefined);
      continue;
    }
    if (details.status?.toUpperCase() === "PUBLISHED") {
      await removeStaleOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: details.offerId,
        status: details.status,
      });
      continue;
    }
    draftCandidates.push(details);
  }

  const draft = draftCandidates[0];
  if (draft) {
    try {
      await updateEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: draft.offerId,
        payload: input.payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isEbayOfferNotAvailableError(message) && !isEbayOfferMissingError(message)) {
        throw err;
      }
      await deleteEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: draft.offerId,
      }).catch(() => undefined);
    }

    const refreshed = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: draft.offerId,
    });
    if (refreshed) {
      const listingId = liveListingIdFromOffer(refreshed);
      if (listingId) {
        return {
          offerId: refreshed.offerId,
          listingId,
          alreadyPublished: true,
          linkExistingWarning:
            "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
        };
      }
      return { offerId: refreshed.offerId, alreadyPublished: false };
    }
  }

  await purgeBlockingOffersForSku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
  });

  try {
    const offerId = await createEbayOfferReady({
      environment: input.environment,
      accessToken: input.accessToken,
      payload: input.payload,
    });
    return { offerId, alreadyPublished: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(message)) throw err;
    const retryExisting = await fetchOffersBySku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku: input.sku,
    });
    for (const retryDraft of retryExisting) {
      const details = await tryFetchOfferDetails({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId: retryDraft.offerId,
      });
      if (!details) continue;
      const listingId = liveListingIdFromOffer(details);
      if (listingId) {
        return {
          offerId: details.offerId,
          listingId,
          alreadyPublished: true,
          linkExistingWarning:
            "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
        };
      }
      try {
        await updateEbayOffer({
          environment: input.environment,
          accessToken: input.accessToken,
          offerId: details.offerId,
          payload: input.payload,
        });
        return { offerId: details.offerId, alreadyPublished: false };
      } catch (updateErr) {
        const updateMessage = updateErr instanceof Error ? updateErr.message : String(updateErr);
        if (isEbayOfferNotAvailableError(updateMessage) || isEbayOfferMissingError(updateMessage)) {
          await deleteEbayOffer({
            environment: input.environment,
            accessToken: input.accessToken,
            offerId: details.offerId,
          }).catch(() => undefined);
          continue;
        }
        throw updateErr;
      }
    }
    const offerId = await createEbayOfferReady({
      environment: input.environment,
      accessToken: input.accessToken,
      payload: input.payload,
    });
    return { offerId, alreadyPublished: false };
  }
}

async function publishOfferWithStaleRecovery(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  offerId: string;
  payload: ReturnType<typeof buildOfferPayload>;
}): Promise<{ offerId: string; listingId: string; staleOfferWarning?: string }> {
  const sku = input.payload.sku.trim();
  let offerId = input.offerId;
  let lastError: Error | null = null;
  let recoveryRounds = 0;

  for (let round = 0; round < 10; round++) {
    const beforePublish = await tryFetchOfferDetails({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId,
    });
    if (beforePublish) {
      const existingListingId = liveListingIdFromOffer(beforePublish);
      if (existingListingId) {
        const reachable = await isEbayListingReachableOnTrading({
          environment: input.environment,
          accessToken: input.accessToken,
          listingId: existingListingId,
        });
        if (reachable) {
          return { offerId: beforePublish.offerId, listingId: existingListingId };
        }
        await removeStaleOffer({
          environment: input.environment,
          accessToken: input.accessToken,
          offerId: beforePublish.offerId,
          status: beforePublish.status,
        }).catch(() => undefined);
      }
    }

    try {
      const listingId = await publishEbayOffer({
        environment: input.environment,
        accessToken: input.accessToken,
        offerId,
      });
      const staleOfferWarning = recoveryRounds > 0
        ? "eBay sandbox had stale offers for this SKU. SellerLens cleared them and published a new listing."
        : undefined;
      return { offerId, listingId, staleOfferWarning };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isEbayOfferNotAvailableError(lastError.message)) {
        throw lastError;
      }
    }

    recoveryRounds += 1;
    await removeStaleOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId,
      status: beforePublish?.status,
    }).catch(() => undefined);
    await purgeAllOffersForCreateSku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku,
    });
    await deleteEbayInventoryItem({
      environment: input.environment,
      accessToken: input.accessToken,
      sku,
    }).catch(() => undefined);
    offerId = await createEbayOfferReady({
      environment: input.environment,
      accessToken: input.accessToken,
      payload: input.payload,
    });
  }

  throw lastError ?? new Error("[25713] This Offer is not available.");
}

export async function createAndPublishEbayOffer(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  sku: string;
  categoryId: string;
  priceCents: number;
  currency: string;
  quantity: number;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
  listingDescriptionHtml: string;
  forceFreshOffer?: boolean;
}): Promise<{ offerId: string; listingId: string; warning?: string }> {
  const offerPayload = buildOfferPayload(input);

  if (input.forceFreshOffer) {
    await purgeAllOffersForCreateSku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku: input.sku.trim(),
    });
    const existingLive = await findPublishedListingForInventorySku({
      environment: input.environment,
      accessToken: input.accessToken,
      sku: input.sku.trim(),
    });
    if (existingLive) {
      const reachable = await isEbayListingReachableOnTrading({
        environment: input.environment,
        accessToken: input.accessToken,
        listingId: existingLive.listingId,
      });
      if (reachable) {
        return {
          offerId: existingLive.offerId,
          listingId: existingLive.listingId,
          warning:
            "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
        };
      }
      await purgeAllOffersForCreateSku({
        environment: input.environment,
        accessToken: input.accessToken,
        sku: input.sku.trim(),
      });
    }
    const offerId = await createEbayOfferReady({
      environment: input.environment,
      accessToken: input.accessToken,
      payload: offerPayload,
    });
    const published = await publishOfferWithStaleRecovery({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId,
      payload: offerPayload,
    });
    return {
      offerId: published.offerId,
      listingId: published.listingId,
      warning: published.staleOfferWarning,
    };
  }

  const existingLive = await findPublishedListingForInventorySku({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku.trim(),
  });
  if (existingLive) {
    return {
      offerId: existingLive.offerId,
      listingId: existingLive.listingId,
      warning:
        "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
    };
  }

  const resolved = await resolveOfferIdForPublish({
    environment: input.environment,
    accessToken: input.accessToken,
    sku: input.sku,
    payload: offerPayload,
  });

  if (resolved.alreadyPublished && resolved.listingId) {
    return {
      offerId: resolved.offerId,
      listingId: resolved.listingId,
      warning: resolved.linkExistingWarning,
    };
  }

  try {
    const published = await publishOfferWithStaleRecovery({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: resolved.offerId,
      payload: offerPayload,
    });

    const warnings = [resolved.linkExistingWarning, published.staleOfferWarning].filter(Boolean);
    return {
      offerId: published.offerId,
      listingId: published.listingId,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isEbayOfferNotAvailableError(message)) {
      throw new Error(
        `${message} SellerLens could not clear stale sandbox offers for SKU "${input.sku.trim()}". `
        + "In eBay sandbox Seller Hub, end/delete old offers for this SKU, set a new alphanumeric SKU on the product Overview, or contact support.",
      );
    }
    throw err;
  }
}

export function ebayListingUrl(environment: EbayOAuthEnvironment, listingId: string): string {
  const host = environment === "sandbox" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${host}/itm/${listingId}`;
}
