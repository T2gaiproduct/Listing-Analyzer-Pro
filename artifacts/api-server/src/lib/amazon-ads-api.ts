import {
  spApiRegionForMarketplaceCode,
  type AmazonSpSettings,
} from "./amazon-sp-settings.js";
import { refreshAccessToken } from "./amazon-sp-api.js";

export type AmazonAdsRegion = "na" | "eu" | "fe";

const ADS_API_HOSTS: Record<AmazonAdsRegion, string> = {
  na: "https://advertising-api.amazon.com",
  eu: "https://advertising-api-eu.amazon.com",
  fe: "https://advertising-api-fe.amazon.com",
};

export type AmazonAdsProfile = {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo?: {
    id?: string;
    type?: string;
    name?: string;
    marketplaceStringId?: string;
  };
};

export type AmazonKeywordRecommendation = {
  keyword: string;
  suggestedBidCents?: number;
  rank?: number;
};

export type AmazonExistingKeyword = {
  keyword: string;
  matchType?: string;
  campaignId?: string;
  adGroupId?: string;
  impressions?: number;
  clicks?: number;
};

export type AmazonSearchTermRow = {
  searchTerm: string;
  impressions?: number;
  clicks?: number;
  orders?: number;
  costCents?: number;
};

function adsRegionForMarketplace(marketplaceCode: string): AmazonAdsRegion {
  const spRegion = spApiRegionForMarketplaceCode(marketplaceCode);
  if (spRegion === "eu") return "eu";
  if (spRegion === "fe") return "fe";
  return "na";
}

export async function adsApiRequest<T>(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  marketplaceCode?: string;
  contentType?: string;
  accept?: string;
  body?: unknown;
}): Promise<T> {
  const region = adsRegionForMarketplace(opts.marketplaceCode ?? opts.settings.defaultMarketplace);
  const host = ADS_API_HOSTS[region];
  const token = await refreshAccessToken(opts.settings, opts.refreshToken);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.access_token}`,
    "Amazon-Advertising-API-ClientId": opts.settings.clientId,
    "Amazon-Advertising-API-Scope": opts.profileId,
  };
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  if (opts.accept) headers.Accept = opts.accept;

  const res = await fetch(`${host}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    const err = json as { message?: string; details?: string; code?: string };
    throw new Error(
      err.message ?? err.details ?? err.code ?? `Amazon Ads API ${opts.path} failed (${res.status})`,
    );
  }

  return json as T;
}

export async function listAmazonAdsProfiles(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  marketplaceCode?: string;
}): Promise<AmazonAdsProfile[]> {
  const region = adsRegionForMarketplace(opts.marketplaceCode ?? opts.settings.defaultMarketplace);
  const host = ADS_API_HOSTS[region];
  const token = await refreshAccessToken(opts.settings, opts.refreshToken);

  const res = await fetch(`${host}/v2/profiles`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Amazon-Advertising-API-ClientId": opts.settings.clientId,
    },
  });

  const json = await res.json().catch(() => ({})) as AmazonAdsProfile[] | { code?: string; details?: string; message?: string };
  if (!res.ok) {
    const errBody = json as { code?: string; details?: string; message?: string };
    if (res.status === 401 || errBody.code === "UNAUTHORIZED") {
      throw new Error(
        "Amazon Advertising API access denied (401). In Amazon Developer Console, enable Advertising API on your SP-API app, then disconnect and reconnect your seller on Marketplaces.",
      );
    }
    throw new Error(
      errBody.details ?? errBody.message ?? `Could not list Amazon Ads profiles (${res.status})`,
    );
  }
  return Array.isArray(json) ? json : [];
}

export async function fetchKeywordRecommendationsForAsins(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  asins: string[];
  marketplaceCode?: string;
  maxRecommendations?: number;
}): Promise<AmazonKeywordRecommendation[]> {
  if (!opts.asins.length) return [];

  const body = {
    recommendationType: "KEYWORDS_FOR_ASINS",
    sortDimension: "CLICKS",
    maxRecommendations: String(opts.maxRecommendations ?? 100),
    locale: "en_US",
    asins: opts.asins.slice(0, 50),
    biddingStrategy: "LEGACY_FOR_SALES",
  };

  const response = await adsApiRequest<{
    keywordTargetList?: Array<{
      keyword?: string;
      bid?: number;
      searchTermImpressionRank?: number;
      recommendationId?: string;
    }>;
    recommendations?: Array<{
      keyword?: string;
      bid?: number;
      searchTermImpressionRank?: number;
    }>;
  }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/targets/keywords/recommendations",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spkeywordsrecommendation.v5+json",
    accept: "application/vnd.spkeywordsrecommendation.v5+json",
    body,
  });

  const items = response.keywordTargetList ?? response.recommendations ?? [];
  return items
    .map((item, index) => ({
      keyword: item.keyword?.trim() ?? "",
      suggestedBidCents: typeof item.bid === "number" ? Math.round(item.bid * 100) : undefined,
      rank: item.searchTermImpressionRank ?? index + 1,
    }))
    .filter((item) => item.keyword.length > 0);
}

export async function listExistingSpKeywords(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  marketplaceCode?: string;
}): Promise<AmazonExistingKeyword[]> {
  const response = await adsApiRequest<{
    keywords?: Array<{
      keywordId?: string;
      keywordText?: string;
      matchType?: string;
      campaignId?: string;
      adGroupId?: string;
      impressions?: number;
      clicks?: number;
    }>;
  }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/keywords/list",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spKeyword.v3+json",
    accept: "application/vnd.spKeyword.v3+json",
    body: {
      stateFilter: { include: ["ENABLED", "PAUSED"] },
      maxResults: 500,
    },
  });

  return (response.keywords ?? [])
    .map((row) => ({
      keyword: row.keywordText?.trim() ?? "",
      matchType: row.matchType,
      campaignId: row.campaignId,
      adGroupId: row.adGroupId,
      impressions: row.impressions,
      clicks: row.clicks,
    }))
    .filter((row) => row.keyword.length > 0);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSearchTermReportRows(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  marketplaceCode?: string;
  timeoutMs?: number;
}): Promise<AmazonSearchTermRow[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const create = await adsApiRequest<{ reportId?: string }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/reporting/reports",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.createasyncreportrequest.v3+json",
    accept: "application/vnd.createasyncreportrequest.v3+json",
    body: {
      name: `SellerLens search terms ${Date.now()}`,
      startDate: fmt(start),
      endDate: fmt(end),
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["searchTerm"],
        columns: ["searchTerm", "impressions", "clicks", "cost", "purchases30d"],
        reportTypeId: "spSearchTerm",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
      },
    },
  });

  const reportId = create.reportId;
  if (!reportId) return [];

  const deadline = Date.now() + (opts.timeoutMs ?? 45000);
  let downloadUrl: string | undefined;

  while (Date.now() < deadline) {
    const status = await adsApiRequest<{
      status?: string;
      url?: string;
      failureReason?: string;
    }>({
      settings: opts.settings,
      refreshToken: opts.refreshToken,
      profileId: opts.profileId,
      method: "GET",
      path: `/reporting/reports/${reportId}`,
      marketplaceCode: opts.marketplaceCode,
      accept: "application/vnd.getasyncreportresponse.v3+json",
    });

    if (status.status === "COMPLETED" && status.url) {
      downloadUrl = status.url;
      break;
    }
    if (status.status === "FAILED") {
      throw new Error(status.failureReason ?? "Search term report failed");
    }
    await sleep(3000);
  }

  if (!downloadUrl) return [];

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) return [];

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  let text: string;
  try {
    const zlib = await import("node:zlib");
    text = zlib.gunzipSync(buffer).toString("utf8");
  } catch {
    text = buffer.toString("utf8");
  }

  const lines = text.split("\n").filter(Boolean);
  const rows: AmazonSearchTermRow[] = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      const searchTerm = String(row.searchTerm ?? row.search_term ?? "").trim();
      if (!searchTerm) continue;
      rows.push({
        searchTerm,
        impressions: Number(row.impressions ?? 0) || undefined,
        clicks: Number(row.clicks ?? 0) || undefined,
        orders: Number(row.purchases30d ?? row.purchases ?? 0) || undefined,
        costCents: typeof row.cost === "number" ? Math.round(row.cost * 100) : undefined,
      });
    } catch {
      // skip malformed lines
    }
  }
  return rows;
}

export type CreateSpCampaignResult = {
  campaignId: string;
  adGroupId: string;
  keywordIds: string[];
};

export async function createSponsoredProductsCampaign(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  marketplaceCode?: string;
  campaignName: string;
  dailyBudgetCents: number;
  asin: string;
  keywords: Array<{ keyword: string; matchType: "EXACT" | "PHRASE" | "BROAD"; bidCents?: number }>;
}): Promise<CreateSpCampaignResult> {
  const dailyBudget = Math.max(opts.dailyBudgetCents / 100, 1);

  const campaignRes = await adsApiRequest<{
    campaigns?: { success?: Array<{ campaignId?: string }> };
  }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/campaigns",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spCampaign.v3+json",
    accept: "application/vnd.spCampaign.v3+json",
    body: {
      campaigns: [{
        name: opts.campaignName,
        state: "ENABLED",
        targetingType: "MANUAL",
        budget: { budgetType: "DAILY", budget: dailyBudget },
        dynamicBidding: { strategy: "LEGACY_FOR_SALES" },
      }],
    },
  });

  const campaignId = campaignRes.campaigns?.success?.[0]?.campaignId;
  if (!campaignId) throw new Error("Amazon did not return a campaign ID.");

  const adGroupRes = await adsApiRequest<{
    adGroups?: { success?: Array<{ adGroupId?: string }> };
  }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/adGroups",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spAdGroup.v3+json",
    accept: "application/vnd.spAdGroup.v3+json",
    body: {
      adGroups: [{
        campaignId,
        name: `${opts.campaignName} Ad Group`,
        state: "ENABLED",
        defaultBid: Math.max(dailyBudget / 10, 0.25),
      }],
    },
  });

  const adGroupId = adGroupRes.adGroups?.success?.[0]?.adGroupId;
  if (!adGroupId) throw new Error("Amazon did not return an ad group ID.");

  await adsApiRequest({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/productAds",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spProductAd.v3+json",
    accept: "application/vnd.spProductAd.v3+json",
    body: {
      productAds: [{
        campaignId,
        adGroupId,
        asin: opts.asin,
        state: "ENABLED",
      }],
    },
  });

  const keywordPayload = opts.keywords.map((kw) => ({
    campaignId,
    adGroupId,
    keywordText: kw.keyword,
    matchType: kw.matchType,
    state: "ENABLED",
    bid: kw.bidCents ? kw.bidCents / 100 : Math.max(dailyBudget / 10, 0.25),
  }));

  const keywordRes = await adsApiRequest<{
    keywords?: { success?: Array<{ keywordId?: string }> };
  }>({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    profileId: opts.profileId,
    method: "POST",
    path: "/sp/keywords",
    marketplaceCode: opts.marketplaceCode,
    contentType: "application/vnd.spKeyword.v3+json",
    accept: "application/vnd.spKeyword.v3+json",
    body: { keywords: keywordPayload },
  });

  const keywordIds = (keywordRes.keywords?.success ?? [])
    .map((k) => k.keywordId)
    .filter((id): id is string => Boolean(id));

  return { campaignId, adGroupId, keywordIds };
}
