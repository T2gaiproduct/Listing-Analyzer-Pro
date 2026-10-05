import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";

export type EbayPolicyOption = {
  id: string;
  name: string;
};

export type EbayListingPolicyOptions = {
  marketplaceId: string;
  fulfillmentPolicies: EbayPolicyOption[];
  paymentPolicies: EbayPolicyOption[];
  returnPolicies: EbayPolicyOption[];
};

const MARKETPLACE_ID = "EBAY_US";

function mapPolicyRows(
  rows: Array<Record<string, string | undefined>> | undefined,
  idField: string,
): EbayPolicyOption[] {
  const out: EbayPolicyOption[] = [];
  for (const row of rows ?? []) {
    const id = row[idField]?.trim();
    const name = row.name?.trim() || id;
    if (id) out.push({ id, name: name ?? id });
  }
  return out;
}

export async function fetchEbayListingPolicyOptions(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
}): Promise<EbayListingPolicyOptions> {
  const qs = `marketplace_id=${MARKETPLACE_ID}`;

  const [fulfillmentRes, paymentRes, returnRes] = await Promise.all([
    ebayRestFetch(input.environment, input.accessToken, `/sell/account/v1/fulfillment_policy?${qs}`),
    ebayRestFetch(input.environment, input.accessToken, `/sell/account/v1/payment_policy?${qs}`),
    ebayRestFetch(input.environment, input.accessToken, `/sell/account/v1/return_policy?${qs}`),
  ]);

  const fulfillmentText = await fulfillmentRes.text();
  const paymentText = await paymentRes.text();
  const returnText = await returnRes.text();

  if (!fulfillmentRes.ok) {
    throw new Error(parseEbayRestError(fulfillmentText, "Could not load eBay shipping policies."));
  }
  if (!paymentRes.ok) {
    throw new Error(parseEbayRestError(paymentText, "Could not load eBay payment policies."));
  }
  if (!returnRes.ok) {
    throw new Error(parseEbayRestError(returnText, "Could not load eBay return policies."));
  }

  const fulfillmentData = JSON.parse(fulfillmentText) as { fulfillmentPolicies?: Array<{ fulfillmentPolicyId?: string; name?: string }> };
  const paymentData = JSON.parse(paymentText) as { paymentPolicies?: Array<{ paymentPolicyId?: string; name?: string }> };
  const returnData = JSON.parse(returnText) as { returnPolicies?: Array<{ returnPolicyId?: string; name?: string }> };

  return {
    marketplaceId: MARKETPLACE_ID,
    fulfillmentPolicies: mapPolicyRows(fulfillmentData.fulfillmentPolicies, "fulfillmentPolicyId"),
    paymentPolicies: mapPolicyRows(paymentData.paymentPolicies, "paymentPolicyId"),
    returnPolicies: mapPolicyRows(returnData.returnPolicies, "returnPolicyId"),
  };
}

export function pickDefaultPolicyId(policies: EbayPolicyOption[]): string | null {
  return policies[0]?.id ?? null;
}
