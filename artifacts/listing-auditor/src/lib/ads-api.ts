import { fetchJson } from "./api-fetch";
import { isAdsConsoleDemoMode, withDemoQuery } from "./ads-console-demo";

const basePath = import.meta.env.BASE_PATH ?? "";

export type AdsKeywordMatchType = "EXACT" | "PHRASE" | "BROAD";

export type AdsKeywordEntry = {
  keyword: string;
  matchType: AdsKeywordMatchType;
  score: number;
  sources: string[];
  suggestedBidCents?: number;
  impressions?: number;
  clicks?: number;
  orders?: number;
  costCents?: number;
  selected: boolean;
  aiNote?: string;
};

export type AdsSourcesSnapshot = {
  amazonRecommendations?: Array<{ keyword: string; suggestedBidCents?: number; rank?: number }>;
  existingCampaignKeywords?: Array<{
    keyword: string;
    matchType?: string;
    campaignId?: string;
    adGroupId?: string;
    impressions?: number;
    clicks?: number;
  }>;
  searchTermReport?: Array<{
    searchTerm: string;
    impressions?: number;
    clicks?: number;
    orders?: number;
    costCents?: number;
  }>;
  listingKeywords?: string[];
  productTitle?: string;
  productBullets?: string[];
  gatheredAt?: string;
  warnings?: string[];
};

export type AdsProject = {
  id: number;
  name: string;
  productName: string;
  category?: string | null;
  asin?: string | null;
  status: string;
  platform: string;
  currentStep: number;
  auditId?: number | null;
  amazonProfileId?: string | null;
  amazonCampaignId?: string | null;
  amazonAdGroupId?: string | null;
  dailyBudgetCents?: number | null;
  keywordData?: AdsKeywordEntry[] | null;
  sourcesSnapshot?: AdsSourcesSnapshot | null;
  errorMessage?: string | null;
  workflowUrl: string;
  detailUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AdsStatusResponse = {
  spApiReady: boolean;
  sellerConnected: boolean;
  profileSelected: boolean;
  profileId?: string;
  profileName?: string;
  profileCountryCode?: string;
  canGatherData: boolean;
  canCreateOnAmazon: boolean;
};

export type AdsProfile = {
  profileId: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  name?: string;
  accountType?: string;
  marketplaceId?: string;
};

export async function fetchAdsStatus(demo?: boolean): Promise<AdsStatusResponse> {
  const params = withDemoQuery(new URLSearchParams(), demo);
  const qs = params.toString();
  return fetchJson(`${basePath}/api/ads/status${qs ? `?${qs}` : ""}`);
}

export async function fetchAdsProfiles(): Promise<{ profiles: AdsProfile[] }> {
  return fetchJson(`${basePath}/api/ads/profiles`);
}

export async function saveAdsProfile(input: {
  profileId: string;
  profileCountryCode?: string;
  profileCurrencyCode?: string;
  profileName?: string;
}): Promise<{ ok: boolean; profile: unknown }> {
  return fetchJson(`${basePath}/api/ads/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchAdsProjects(): Promise<{ projects: AdsProject[] }> {
  return fetchJson(`${basePath}/api/ads/projects`);
}

export async function createAdsProject(input: {
  asin: string;
  productName?: string;
  name?: string;
  auditId?: number;
  amazonProfileId?: string;
}): Promise<{ project: AdsProject }> {
  return fetchJson(`${basePath}/api/ads/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchAdsProject(id: number): Promise<{ project: AdsProject }> {
  return fetchJson(`${basePath}/api/ads/projects/${id}`);
}

export async function patchAdsProject(
  id: number,
  input: Partial<{
    name: string;
    currentStep: number;
    dailyBudgetCents: number;
    keywordData: AdsKeywordEntry[];
    amazonProfileId: string;
  }>,
): Promise<{ project: AdsProject }> {
  return fetchJson(`${basePath}/api/ads/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function gatherAdsProjectData(id: number): Promise<{
  project: AdsProject;
  snapshot: AdsSourcesSnapshot;
}> {
  return fetchJson(`${basePath}/api/ads/projects/${id}/gather`, { method: "POST" });
}

export async function expandAdsKeywords(id: number): Promise<{
  project: AdsProject;
  keywordData: AdsKeywordEntry[];
}> {
  return fetchJson(`${basePath}/api/ads/projects/${id}/expand`, { method: "POST" });
}

export async function scoreAdsKeywords(id: number): Promise<{
  project: AdsProject;
  keywordData: AdsKeywordEntry[];
}> {
  return fetchJson(`${basePath}/api/ads/projects/${id}/score`, { method: "POST" });
}

export async function createAmazonAdsCampaign(
  id: number,
  input?: { dailyBudgetCents?: number; keywordData?: AdsKeywordEntry[] },
): Promise<{ project: AdsProject; amazon: { campaignId: string; adGroupId: string; keywordIds: string[] } }> {
  return fetchJson(`${basePath}/api/ads/projects/${id}/create-campaign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}
