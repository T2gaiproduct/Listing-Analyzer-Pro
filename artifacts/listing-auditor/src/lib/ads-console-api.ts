import { fetchJson } from "./api-fetch";
import { withDemoQuery } from "./ads-console-demo";

const basePath = import.meta.env.BASE_PATH ?? "";

export type AdsConsoleCampaign = {
  campaignId: string;
  name: string;
  state: string;
  targetingType: string;
  sponsoredType: string;
  portfolioId?: string;
  portfolioName?: string;
  budget: number;
  baseBudget?: number;
  budgetType: string;
  startDate?: string;
  todaySpend?: number;
  biddingStrategy?: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cvr?: number;
  adSales?: number;
  roas?: number;
  acos?: number;
  purchases?: number;
};

export type AdsConsoleCampaignsQuery = {
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  name?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  demo?: boolean;
};

export type AdsConsoleCampaignsResponse = {
  campaigns: AdsConsoleCampaign[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
  profileId?: string;
};

export type AdsConsoleTargetKind = "keyword" | "product" | "other";

export type AdsConsoleTarget = {
  targetId: string;
  targetText: string;
  targetKind: AdsConsoleTargetKind;
  state: string;
  matchType?: string;
  bid?: number;
  baseBid?: number;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  sponsoredType: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  purchases?: number;
  ctr?: number;
  cpc?: number;
  cvr?: number;
  adSales?: number;
  roas?: number;
  acos?: number;
  previousBid?: number;
  lastBidChange?: string;
  topOfSearchImpressions?: number;
  oldTags?: string;
  /** @deprecated use targetId */
  keywordId?: string;
  /** @deprecated use targetText */
  keywordText?: string;
};

export type AdsConsoleTargetsQuery = {
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  name?: string;
  targetType?: "all" | "keyword" | "product" | "other";
  page?: number;
  pageSize?: number;
  sort?: string;
  demo?: boolean;
};

export type AdsConsoleTargetsResponse = {
  targets: AdsConsoleTarget[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
  profileId?: string;
};

export type AdsConsoleProductAd = {
  adId: string;
  asin?: string;
  sku?: string;
  state: string;
  campaignId?: string;
  adGroupId?: string;
};

export type AdsConsoleNegativeTarget = {
  negativeTargetId: string;
  negativeTarget: string;
  targetKind: "keyword" | "product";
  matchType: string;
  type: string;
  state: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  sponsoredType: string;
  /** @deprecated use negativeTargetId */
  keywordId?: string;
  /** @deprecated use negativeTarget */
  keywordText?: string;
};

export type AdsConsoleNegativeTargetsQuery = {
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  name?: string;
  targetType?: "all" | "keyword" | "product";
  page?: number;
  pageSize?: number;
  sort?: string;
  demo?: boolean;
};

export type AdsConsoleNegativeTargetsResponse = {
  negativeTargets: AdsConsoleNegativeTarget[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
  profileId?: string;
};

export type AdsConsolePlacement = {
  campaignId: string;
  campaignName: string;
  placement: string;
  percentage?: number;
  state: string;
};

export type AdsConsoleSearchTerm = {
  searchTermId: string;
  searchTerm: string;
  termKind?: "auto" | "auto_product" | "manual";
  sponsoredType?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  impressions?: number;
  clicks?: number;
  purchases?: number;
  spend?: number;
  cpc?: number;
  ctr?: number;
  orders?: number;
  costCents?: number;
};

export type AdsConsoleSearchTermsQuery = {
  dateFrom?: string;
  dateTo?: string;
  name?: string;
  termType?: "all" | "auto" | "auto_product" | "manual";
  page?: number;
  pageSize?: number;
  sort?: string;
  demo?: boolean;
};

export type AdsConsoleSearchTermsResponse = {
  searchTerms: AdsConsoleSearchTerm[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
  profileId?: string;
};

function buildCampaignsQueryString(query: AdsConsoleCampaignsQuery): string {
  const params = withDemoQuery(new URLSearchParams(), query.demo);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.state) params.set("state", query.state);
  if (query.name) params.set("name", query.name);
  if (query.page != null) params.set("page", String(query.page));
  if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAdsConsoleCampaigns(
  query: AdsConsoleCampaignsQuery = {},
): Promise<AdsConsoleCampaignsResponse> {
  return fetchJson(`${basePath}/api/ads/console/campaigns${buildCampaignsQueryString(query)}`);
}

export async function fetchAdsConsoleTargets(
  query: AdsConsoleTargetsQuery = {},
): Promise<AdsConsoleTargetsResponse> {
  const params = withDemoQuery(new URLSearchParams(), query.demo);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.state) params.set("state", query.state);
  if (query.name) params.set("name", query.name);
  if (query.targetType) params.set("targetType", query.targetType);
  if (query.page != null) params.set("page", String(query.page));
  if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return fetchJson(`${basePath}/api/ads/console/targets${qs ? `?${qs}` : ""}`);
}

export async function fetchAdsConsoleSearchTerms(
  query: AdsConsoleSearchTermsQuery = {},
): Promise<AdsConsoleSearchTermsResponse> {
  const params = withDemoQuery(new URLSearchParams(), query.demo);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.name) params.set("name", query.name);
  if (query.termType) params.set("termType", query.termType);
  if (query.page != null) params.set("page", String(query.page));
  if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return fetchJson(`${basePath}/api/ads/console/search-terms${qs ? `?${qs}` : ""}`);
}

export async function fetchAdsConsoleProductAds(): Promise<{ productAds: AdsConsoleProductAd[] }> {
  return fetchJson(`${basePath}/api/ads/console/product-ads`);
}

export async function fetchAdsConsolePlacements(): Promise<{ placements: AdsConsolePlacement[] }> {
  return fetchJson(`${basePath}/api/ads/console/placements`);
}

export async function fetchAdsConsoleNegativeTargets(
  query: AdsConsoleNegativeTargetsQuery = {},
): Promise<AdsConsoleNegativeTargetsResponse> {
  const params = withDemoQuery(new URLSearchParams(), query.demo);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.state) params.set("state", query.state);
  if (query.name) params.set("name", query.name);
  if (query.targetType) params.set("targetType", query.targetType);
  if (query.page != null) params.set("page", String(query.page));
  if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return fetchJson(`${basePath}/api/ads/console/negative-targets${qs ? `?${qs}` : ""}`);
}

export async function bulkUpdateAdsCampaigns(input: {
  campaignIds: string[];
  action: "enable" | "pause" | "archive" | "budget";
  dailyBudget?: number;
}): Promise<{ updated: number; errors: string[] }> {
  return fetchJson(`${basePath}/api/ads/console/campaigns/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function defaultCampaignDateRange(): { dateFrom: string; dateTo: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(start), dateTo: fmt(end) };
}
