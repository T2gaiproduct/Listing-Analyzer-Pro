import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { isValidEbayInventorySku } from "./ebay-listing-sku.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";

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
  return /25713|offer is not available/i.test(message);
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
      return {
        offerId: details.offerId,
        listingId,
        alreadyPublished: true,
        linkExistingWarning:
          "This SKU already has a live eBay listing; SellerLens linked that listing to this product.",
      };
    }
    if (details.status?.toUpperCase() !== "PUBLISHED") {
      draftCandidates.push(details);
    }
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

  try {
    const offerId = await createEbayOffer({
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
    const offerId = await createEbayOffer({
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
  const beforePublish = await tryFetchOfferDetails({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: input.offerId,
  });
  if (beforePublish) {
    const existingListingId = liveListingIdFromOffer(beforePublish);
    if (existingListingId) {
      return { offerId: beforePublish.offerId, listingId: existingListingId };
    }
  }

  try {
    const listingId = await publishEbayOffer({
      environment: input.environment,
      accessToken: input.accessToken,
      offerId: input.offerId,
    });
    return { offerId: input.offerId, listingId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isEbayOfferNotAvailableError(message)) {
      throw err;
    }
  }

  await deleteEbayOffer({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: input.offerId,
  }).catch(() => undefined);

  const newOfferId = await createEbayOffer({
    environment: input.environment,
    accessToken: input.accessToken,
    payload: input.payload,
  });

  const listingId = await publishEbayOffer({
    environment: input.environment,
    accessToken: input.accessToken,
    offerId: newOfferId,
  });

  return {
    offerId: newOfferId,
    listingId,
    staleOfferWarning:
      "eBay had a stale draft offer for this SKU. SellerLens created a fresh offer and published it.",
  };
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
}): Promise<{ offerId: string; listingId: string; warning?: string }> {
  const offerPayload = buildOfferPayload(input);

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
}

export function ebayListingUrl(environment: EbayOAuthEnvironment, listingId: string): string {
  const host = environment === "sandbox" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${host}/itm/${listingId}`;
}
