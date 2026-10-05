import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
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
}): Promise<void> {
  const skuEncoded = encodeURIComponent(input.sku.trim());
  const body = {
    product: {
      title: input.title,
      description: input.descriptionHtml,
      imageUrls: input.imageUrls.filter(Boolean).slice(0, 12),
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
}): Promise<{ offerId: string; listingId: string }> {
  const priceValue = (input.priceCents / 100).toFixed(2);
  const currency = (input.currency?.trim() || "USD").toUpperCase();

  const offerPayload = {
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

  const createRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    "/sell/inventory/v1/offer",
    { method: "POST", body: JSON.stringify(offerPayload) },
  );
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(parseEbayRestError(createText, "Could not create eBay offer."));
  }
  const created = JSON.parse(createText) as { offerId?: string };
  const offerId = created.offerId?.trim();
  if (!offerId) throw new Error("eBay did not return an offer id.");

  const publishRes = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    { method: "POST", body: JSON.stringify({}) },
  );
  const publishText = await publishRes.text();
  if (!publishRes.ok) {
    throw new Error(parseEbayRestError(publishText, "Could not publish eBay listing."));
  }
  const published = JSON.parse(publishText) as { listingId?: string };
  const listingId = published.listingId?.trim();
  if (!listingId) throw new Error("eBay published the offer but did not return a listing id.");

  return { offerId, listingId };
}

export function ebayListingUrl(environment: EbayOAuthEnvironment, listingId: string): string {
  const host = environment === "sandbox" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${host}/itm/${listingId}`;
}
