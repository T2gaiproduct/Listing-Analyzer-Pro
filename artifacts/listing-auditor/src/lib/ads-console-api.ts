import { fetchJson } from "./api-fetch";

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
};

export type AdsConsoleCampaignsResponse = {
  campaigns: AdsConsoleCampaign[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
  profileId?: string;
};

export type AdsConsoleTarget = {
  keywordId: string;
  keywordText: string;
  matchType: string;
  state: string;
  bid?: number;
  campaignId?: string;
  adGroupId?: string;
  impressions?: number;
  clicks?: number;
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
  keywordId: string;
  keywordText: string;
  matchType: string;
  state: string;
  campaignId?: string;
  adGroupId?: string;
};

export type AdsConsolePlacement = {
  campaignId: string;
  campaignName: string;
  placement: string;
  percentage?: number;
  state: string;
};

export type AdsConsoleSearchTerm = {
  searchTerm: string;
  impressions?: number;
  clicks?: number;
  orders?: number;
  costCents?: number;
};

function buildCampaignsQueryString(query: AdsConsoleCampaignsQuery): string {
  const params = new URLSearchParams();
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

export async function fetchAdsConsoleTargets(): Promise<{ targets: AdsConsoleTarget[] }> {
  return fetchJson(`${basePath}/api/ads/console/targets`);
}

export async function fetchAdsConsoleSearchTerms(): Promise<{ searchTerms: AdsConsoleSearchTerm[] }> {
  return fetchJson(`${basePath}/api/ads/console/search-terms`);
}

export async function fetchAdsConsoleProductAds(): Promise<{ productAds: AdsConsoleProductAd[] }> {
  return fetchJson(`${basePath}/api/ads/console/product-ads`);
}

export async function fetchAdsConsolePlacements(): Promise<{ placements: AdsConsolePlacement[] }> {
  return fetchJson(`${basePath}/api/ads/console/placements`);
}

export async function fetchAdsConsoleNegativeTargets(): Promise<{ negativeTargets: AdsConsoleNegativeTarget[] }> {
  return fetchJson(`${basePath}/api/ads/console/negative-targets`);
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
