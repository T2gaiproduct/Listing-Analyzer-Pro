import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints } from "./ebay-oauth-config.js";

export type EbayAmount = {
  value?: string;
  currency?: string;
};

export type EbayFulfillmentLineItem = {
  lineItemId?: string;
  sku?: string;
  quantity?: number;
  title?: string;
  lineItemCost?: EbayAmount;
  lineItemFulfillmentStatus?: string;
  legacyReference?: {
    legacyItemId?: string;
    legacyTransactionId?: string;
  };
};

export type EbayFulfillmentOrder = {
  orderId?: string;
  creationDate?: string;
  orderFulfillmentStatus?: string;
  cancelStatus?: {
    cancelState?: string;
  };
  buyer?: {
    username?: string;
    buyerRegistrationAddress?: {
      fullName?: string;
    };
  };
  pricingSummary?: {
    total?: EbayAmount;
  };
  paymentSummary?: {
    paymentStatus?: string;
  };
  lineItems?: EbayFulfillmentLineItem[];
  fulfillmentHrefs?: string[];
};

type EbayOrdersResponse = {
  orders?: EbayFulfillmentOrder[];
  total?: number;
  limit?: number;
  offset?: number;
  next?: string;
};

async function ebayFulfillmentFetch(
  environment: EbayOAuthEnvironment,
  accessToken: string,
  path: string,
): Promise<Response> {
  const { apiBaseUrl } = ebayOAuthEndpoints(environment);
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Content-Language": "en-US",
    },
  });
}

function encodeFilterCreationDateMin(isoMin: string): string {
  return `creationdate:[${isoMin}..]`;
}

export async function listEbayFulfillmentOrders(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  creationDateMin: string;
  maxOrders: number;
}): Promise<EbayFulfillmentOrder[]> {
  const maxOrders = Math.min(Math.max(input.maxOrders, 1), 500);
  const limit = 100;
  const filter = encodeURIComponent(encodeFilterCreationDateMin(input.creationDateMin));
  const collected: EbayFulfillmentOrder[] = [];
  let offset = 0;

  while (collected.length < maxOrders) {
    const path = `/sell/fulfillment/v1/order?filter=${filter}&limit=${limit}&offset=${offset}`;
    const res = await ebayFulfillmentFetch(input.environment, input.accessToken, path);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `eBay orders request failed (${res.status})`);
    }

    const data = JSON.parse(text) as EbayOrdersResponse;
    const page = data.orders ?? [];
    if (page.length === 0) break;

    for (const order of page) {
      collected.push(order);
      if (collected.length >= maxOrders) break;
    }

    const total = typeof data.total === "number" ? data.total : null;
    offset += page.length;
    if (page.length < limit) break;
    if (total != null && offset >= total) break;
  }

  return collected;
}
