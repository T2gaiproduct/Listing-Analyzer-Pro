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

export async function fetchAdsConsoleCampaigns(): Promise<{ campaigns: AdsConsoleCampaign[] }> {
  return fetchJson(`${basePath}/api/ads/console/campaigns`);
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
