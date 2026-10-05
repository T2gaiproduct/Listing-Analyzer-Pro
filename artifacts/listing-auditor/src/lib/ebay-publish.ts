import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface EbayConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  environment: "sandbox" | "production" | null;
  username: string | null;
  ebayUserId: string | null;
  connectedAt: string | null;
}

export async function fetchEbayStatus(): Promise<EbayConnectionStatus> {
  return fetchJson<EbayConnectionStatus>(`${basePath}/api/ebay/status`);
}

export type EbayCategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
};

export type EbayCategoryAspectField = {
  name: string;
  required: boolean;
  values: string[];
  selectionOnly: boolean;
};

export async function fetchEbayCategoryAspects(categoryId: string): Promise<EbayCategoryAspectField[]> {
  const id = encodeURIComponent(categoryId.trim());
  const data = await fetchJson<{ aspects?: EbayCategoryAspectField[] }>(
    `${basePath}/api/ebay/categories/${id}/aspects`,
  );
  return data.aspects ?? [];
}

export type EbayListingOptions = {
  marketplaceId: string;
  environment: "sandbox" | "production" | null;
  createListingEnabled: boolean;
  fulfillmentPolicies: Array<{ id: string; name: string }>;
  paymentPolicies: Array<{ id: string; name: string }>;
  returnPolicies: Array<{ id: string; name: string }>;
  defaults: {
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
  };
};

export async function fetchEbayCategorySuggestions(query: string): Promise<EbayCategorySuggestion[]> {
  const q = encodeURIComponent(query.trim());
  const data = await fetchJson<{ categories?: EbayCategorySuggestion[] }>(
    `${basePath}/api/ebay/categories/suggest?q=${q}`,
  );
  return data.categories ?? [];
}

export async function fetchEbayListingOptions(): Promise<EbayListingOptions> {
  return fetchJson<EbayListingOptions>(`${basePath}/api/ebay/listing-options`);
}

export async function createAuditEbayListing(opts: {
  auditId: number;
  primaryCategoryId: string;
  quantity?: number;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  itemAspects?: Record<string, string>;
}): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  warning?: string;
}> {
  const data = await fetchJson<{
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    warning?: string;
  }>(`${basePath}/api/audits/${opts.auditId}/publish/ebay/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      primaryCategoryId: opts.primaryCategoryId,
      quantity: opts.quantity ?? 1,
      condition: "NEW",
      fulfillmentPolicyId: opts.fulfillmentPolicyId,
      paymentPolicyId: opts.paymentPolicyId,
      returnPolicyId: opts.returnPolicyId,
      itemAspects: opts.itemAspects,
    }),
  });
  return {
    ok: true,
    message: data.message ?? "Published to eBay.",
    listingUrl: data.listingUrl,
    warning: data.warning,
  };
}

export async function publishAuditToEbay(opts: { auditId: number }): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  warning?: string;
}> {
  const data = await fetchJson<{
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    warning?: string;
  }>(`${basePath}/api/audits/${opts.auditId}/publish/ebay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    ok: true,
    message: data.message ?? "Published to eBay.",
    listingUrl: data.listingUrl,
    warning: data.warning,
  };
}
