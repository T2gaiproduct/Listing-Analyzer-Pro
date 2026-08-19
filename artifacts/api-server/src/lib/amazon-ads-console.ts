import {
  adsApiRequest,
  fetchSearchTermReportRows,
  type AmazonSearchTermRow,
} from "./amazon-ads-api.js";
import type { AmazonSpSettings } from "./amazon-sp-settings.js";

export type AdsConsoleApiContext = {
  settings: AmazonSpSettings;
  refreshToken: string;
  profileId: string;
  marketplaceCode?: string;
};

export type AdsConsoleCampaignRow = {
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
  currencyCode?: string;
};

export type AdsConsoleTargetRow = {
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

export type AdsConsoleProductAdRow = {
  adId: string;
  asin?: string;
  sku?: string;
  state: string;
  campaignId?: string;
  adGroupId?: string;
};

export type AdsConsoleNegativeTargetRow = {
  keywordId: string;
  keywordText: string;
  matchType: string;
  state: string;
  campaignId?: string;
  adGroupId?: string;
};

export type AdsConsolePlacementRow = {
  campaignId: string;
  campaignName: string;
  placement: string;
  percentage?: number;
  state: string;
};

async function listAllPages<T>(
  fetchPage: (nextToken?: string) => Promise<{ items: T[]; nextToken?: string }>,
  maxPages = 10,
): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(nextToken);
    all.push(...page.items);
    if (!page.nextToken) break;
    nextToken = page.nextToken;
  }
  return all;
}

export async function listPortfoliosMap(ctx: AdsConsoleApiContext): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const response = await adsApiRequest<{
      portfolios?: Array<{ portfolioId?: string; name?: string }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/portfolios/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spPortfolio.v3+json",
      accept: "application/vnd.spPortfolio.v3+json",
      body: { stateFilter: { include: ["ENABLED"] }, maxResults: 100 },
    });
    for (const p of response.portfolios ?? []) {
      if (p.portfolioId && p.name) map.set(p.portfolioId, p.name);
    }
  } catch {
    // portfolios optional
  }
  return map;
}

export async function listSpCampaignsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsoleCampaignRow[]> {
  const portfolios = await listPortfoliosMap(ctx);

  const campaigns = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      campaigns?: Array<{
        campaignId?: string;
        name?: string;
        state?: string;
        targetingType?: string;
        budget?: { budget?: number; budgetType?: string };
        startDate?: string;
        portfolioId?: string;
        dynamicBidding?: { strategy?: string };
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/campaigns/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spCampaign.v3+json",
      accept: "application/vnd.spCampaign.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED", "ARCHIVED"] },
        maxResults: 100,
        nextToken,
        includeExtendedDataFields: true,
      },
    });

    return {
      items: response.campaigns ?? [],
      nextToken: response.nextToken,
    };
  });

  return campaigns.map((c) => {
    const budget = c.budget?.budget ?? 0;
    const portfolioId = c.portfolioId;
    return {
      campaignId: c.campaignId ?? "",
      name: c.name ?? "—",
      state: c.state ?? "UNKNOWN",
      targetingType: c.targetingType ?? "—",
      sponsoredType: "Sponsored Products",
      portfolioId,
      portfolioName: portfolioId ? portfolios.get(portfolioId) : undefined,
      budget,
      baseBudget: budget,
      budgetType: c.budget?.budgetType ?? "DAILY",
      startDate: formatAdsDate(c.startDate),
      todaySpend: undefined,
      currencyCode: ctx.settings.defaultMarketplace,
    };
  }).filter((c) => c.campaignId);
}

function formatAdsDate(raw?: string): string | undefined {
  if (!raw || raw.length < 8) return raw;
  if (raw.includes("-")) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export async function listSpTargetsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsoleTargetRow[]> {
  const keywords = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      keywords?: Array<{
        keywordId?: string;
        keywordText?: string;
        matchType?: string;
        state?: string;
        bid?: number;
        campaignId?: string;
        adGroupId?: string;
        impressions?: number;
        clicks?: number;
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/keywords/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spKeyword.v3+json",
      accept: "application/vnd.spKeyword.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED", "ARCHIVED"] },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.keywords ?? [], nextToken: response.nextToken };
  });

  return keywords.map((k) => ({
    keywordId: k.keywordId ?? "",
    keywordText: k.keywordText ?? "",
    matchType: k.matchType ?? "—",
    state: k.state ?? "UNKNOWN",
    bid: k.bid,
    campaignId: k.campaignId,
    adGroupId: k.adGroupId,
    impressions: k.impressions,
    clicks: k.clicks,
  })).filter((k) => k.keywordId);
}

export async function listSpProductAdsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsoleProductAdRow[]> {
  const ads = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      productAds?: Array<{
        adId?: string;
        asin?: string;
        sku?: string;
        state?: string;
        campaignId?: string;
        adGroupId?: string;
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/productAds/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spProductAd.v3+json",
      accept: "application/vnd.spProductAd.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED", "ARCHIVED"] },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.productAds ?? [], nextToken: response.nextToken };
  });

  return ads.map((a) => ({
    adId: a.adId ?? "",
    asin: a.asin,
    sku: a.sku,
    state: a.state ?? "UNKNOWN",
    campaignId: a.campaignId,
    adGroupId: a.adGroupId,
  })).filter((a) => a.adId);
}

export async function listSpNegativeTargetsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsoleNegativeTargetRow[]> {
  const negatives = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      negativeKeywords?: Array<{
        keywordId?: string;
        keywordText?: string;
        matchType?: string;
        state?: string;
        campaignId?: string;
        adGroupId?: string;
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/negativeKeywords/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spNegativeKeyword.v3+json",
      accept: "application/vnd.spNegativeKeyword.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED", "ARCHIVED"] },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.negativeKeywords ?? [], nextToken: response.nextToken };
  });

  return negatives.map((k) => ({
    keywordId: k.keywordId ?? "",
    keywordText: k.keywordText ?? "",
    matchType: k.matchType ?? "—",
    state: k.state ?? "UNKNOWN",
    campaignId: k.campaignId,
    adGroupId: k.adGroupId,
  })).filter((k) => k.keywordId);
}

export async function listSpPlacementsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsolePlacementRow[]> {
  const campaigns = await listSpCampaignsForConsole(ctx);
  const rows: AdsConsolePlacementRow[] = [];

  const rawCampaigns = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      campaigns?: Array<{
        campaignId?: string;
        name?: string;
        state?: string;
        dynamicBidding?: {
          placementBidding?: Array<{ placement?: string; percentage?: number }>;
        };
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/campaigns/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spCampaign.v3+json",
      accept: "application/vnd.spCampaign.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED"] },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.campaigns ?? [], nextToken: response.nextToken };
  });

  for (const c of rawCampaigns) {
    const placements = c.dynamicBidding?.placementBidding ?? [];
    if (placements.length === 0) {
      rows.push({
        campaignId: c.campaignId ?? "",
        campaignName: c.name ?? "—",
        placement: "—",
        state: c.state ?? "UNKNOWN",
      });
      continue;
    }
    for (const p of placements) {
      rows.push({
        campaignId: c.campaignId ?? "",
        campaignName: c.name ?? "—",
        placement: p.placement ?? "—",
        percentage: p.percentage,
        state: c.state ?? "UNKNOWN",
      });
    }
  }

  if (rows.length === 0 && campaigns.length > 0) {
    return campaigns.map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.name,
      placement: "—",
      state: c.state,
    }));
  }

  return rows;
}

export async function listSearchTermsForConsole(ctx: AdsConsoleApiContext): Promise<AmazonSearchTermRow[]> {
  return fetchSearchTermReportRows({
    settings: ctx.settings,
    refreshToken: ctx.refreshToken,
    profileId: ctx.profileId,
    marketplaceCode: ctx.marketplaceCode,
    timeoutMs: 60000,
  });
}

export async function bulkUpdateSpCampaigns(
  ctx: AdsConsoleApiContext,
  input: {
    campaignIds: string[];
    action: "enable" | "pause" | "archive" | "budget";
    dailyBudget?: number;
  },
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  if (!input.campaignIds.length) return { updated: 0, errors: ["No campaigns selected"] };

  if (input.action === "budget") {
    if (!input.dailyBudget || input.dailyBudget <= 0) {
      return { updated: 0, errors: ["Daily budget must be greater than zero"] };
    }
    const campaigns = input.campaignIds.map((campaignId) => ({
      campaignId,
      budget: { budgetType: "DAILY", budget: input.dailyBudget },
    }));
    const res = await adsApiRequest<{
      campaigns?: { success?: Array<{ campaignId?: string }>; error?: Array<{ errors?: Array<{ errorValue?: string }> }> };
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "PUT",
      path: "/sp/campaigns",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spCampaign.v3+json",
      accept: "application/vnd.spCampaign.v3+json",
      body: { campaigns },
    });
    const success = res.campaigns?.success?.length ?? 0;
    const errItems = res.campaigns?.error ?? [];
    for (const e of errItems) {
      errors.push(e.errors?.[0]?.errorValue ?? "Budget update failed");
    }
    return { updated: success, errors };
  }

  const stateMap = { enable: "ENABLED", pause: "PAUSED", archive: "ARCHIVED" } as const;
  const state = stateMap[input.action];
  const campaigns = input.campaignIds.map((campaignId) => ({ campaignId, state }));
  const res = await adsApiRequest<{
    campaigns?: { success?: Array<{ campaignId?: string }>; error?: Array<{ errors?: Array<{ errorValue?: string }> }> };
  }>({
    settings: ctx.settings,
    refreshToken: ctx.refreshToken,
    profileId: ctx.profileId,
    method: "PUT",
    path: "/sp/campaigns",
    marketplaceCode: ctx.marketplaceCode,
    contentType: "application/vnd.spCampaign.v3+json",
    accept: "application/vnd.spCampaign.v3+json",
    body: { campaigns },
  });
  const success = res.campaigns?.success?.length ?? 0;
  const errItems = res.campaigns?.error ?? [];
  for (const e of errItems) {
    errors.push(e.errors?.[0]?.errorValue ?? "State update failed");
  }
  return { updated: success, errors };
}
