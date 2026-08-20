import {
  adsApiRequest,
  fetchSearchTermReportRows,
  fetchSpCampaignReportMetricsMap,
  fetchSpKeywordTargetingReportMetricsMap,
  fetchSpTargetClauseReportMetricsMap,
  type AmazonSearchTermRow,
  type SpCampaignReportMetrics,
  type SpPerformanceMetrics,
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

export type AdsConsoleTargetKind = "keyword" | "product" | "other";

export type AdsConsoleTargetRow = {
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

async function listCampaignNamesMap(ctx: AdsConsoleApiContext): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const campaigns = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      campaigns?: Array<{ campaignId?: string; name?: string }>;
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
      },
    });
    return { items: response.campaigns ?? [], nextToken: response.nextToken };
  }, 20);
  for (const c of campaigns) {
    if (c.campaignId && c.name) map.set(c.campaignId, c.name);
  }
  return map;
}

async function listAdGroupNamesMap(ctx: AdsConsoleApiContext): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const adGroups = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      adGroups?: Array<{ adGroupId?: string; name?: string }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/adGroups/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spAdGroup.v3+json",
      accept: "application/vnd.spAdGroup.v3+json",
      body: {
        stateFilter: { include: ["ENABLED", "PAUSED", "ARCHIVED"] },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.adGroups ?? [], nextToken: response.nextToken };
  }, 20);
  for (const g of adGroups) {
    if (g.adGroupId && g.name) map.set(g.adGroupId, g.name);
  }
  return map;
}

function formatProductTargetExpression(
  expression?: Array<{ type?: string; value?: string }>,
): { text: string; kind: AdsConsoleTargetKind } {
  if (!expression?.length) return { text: "—", kind: "other" };
  const parts = expression.map((e) => {
    const type = e.type ?? "TARGET";
    const value = e.value ?? "";
    return value ? `${type}: ${value}` : type;
  });
  const joined = parts.join(" · ");
  const upper = joined.toUpperCase();
  const kind: AdsConsoleTargetKind =
    upper.includes("ASIN") || upper.includes("CATEGORY") || upper.includes("PRODUCT")
      ? "product"
      : "other";
  return { text: joined, kind };
}

function applyTargetMetrics(row: AdsConsoleTargetRow, metrics?: SpPerformanceMetrics): AdsConsoleTargetRow {
  if (!metrics) return row;
  return {
    ...row,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    spend: metrics.spend,
    purchases: metrics.purchases,
    adSales: metrics.sales,
    ctr: metrics.ctr,
    cpc: metrics.cpc,
    cvr: metrics.cvr,
    roas: metrics.roas,
    acos: metrics.acos,
  };
}

function sortTargetRows(rows: AdsConsoleTargetRow[], sort?: string): AdsConsoleTargetRow[] {
  const key = sort?.trim() || "-spend";
  const desc = key.startsWith("-");
  const field = desc ? key.slice(1) : key;
  const mul = desc ? -1 : 1;

  const getValue = (row: AdsConsoleTargetRow): number | string => {
    switch (field) {
      case "spend":
        return row.spend ?? 0;
      case "clicks":
        return row.clicks ?? 0;
      case "impressions":
        return row.impressions ?? 0;
      case "targetText":
        return row.targetText.toLowerCase();
      case "campaignName":
        return (row.campaignName ?? "").toLowerCase();
      case "roas":
        return row.roas ?? 0;
      case "acos":
        return row.acos ?? 0;
      default:
        return row.spend ?? 0;
    }
  };

  return [...rows].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });
}

export type TargetConsoleListOptions = {
  dateFrom?: string;
  dateTo?: string;
  state?: string[];
  name?: string;
  targetType?: "all" | "keyword" | "product" | "other";
  page?: number;
  pageSize?: number;
  sort?: string;
};

export type TargetConsoleListResult = {
  targets: AdsConsoleTargetRow[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
};

async function listSpKeywordTargetsRaw(
  ctx: AdsConsoleApiContext,
  stateInclude: string[],
): Promise<AdsConsoleTargetRow[]> {
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
        stateFilter: { include: stateInclude },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.keywords ?? [], nextToken: response.nextToken };
  }, 20);

  return keywords.map((k) => {
    const targetId = k.keywordId ?? "";
    const targetText = k.keywordText ?? "";
    return {
      targetId,
      targetText,
      targetKind: "keyword" as const,
      state: k.state ?? "UNKNOWN",
      matchType: k.matchType ?? "—",
      bid: k.bid,
      baseBid: k.bid,
      campaignId: k.campaignId,
      adGroupId: k.adGroupId,
      sponsoredType: "Sponsored Products",
      keywordId: targetId,
      keywordText: targetText,
    };
  }).filter((k) => k.targetId);
}

async function listSpProductTargetsRaw(
  ctx: AdsConsoleApiContext,
  stateInclude: string[],
): Promise<AdsConsoleTargetRow[]> {
  const clauses = await listAllPages(async (nextToken) => {
    const response = await adsApiRequest<{
      targetingClauses?: Array<{
        targetId?: string;
        expression?: Array<{ type?: string; value?: string }>;
        expressionType?: string;
        state?: string;
        bid?: number;
        campaignId?: string;
        adGroupId?: string;
      }>;
      nextToken?: string;
    }>({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      method: "POST",
      path: "/sp/targets/list",
      marketplaceCode: ctx.marketplaceCode,
      contentType: "application/vnd.spTargetingClause.v3+json",
      accept: "application/vnd.spTargetingClause.v3+json",
      body: {
        stateFilter: { include: stateInclude },
        maxResults: 100,
        nextToken,
      },
    });
    return { items: response.targetingClauses ?? [], nextToken: response.nextToken };
  }, 20);

  return clauses.map((t) => {
    const { text, kind } = formatProductTargetExpression(t.expression);
    const targetId = t.targetId ?? "";
    return {
      targetId,
      targetText: text,
      targetKind: kind,
      state: t.state ?? "UNKNOWN",
      matchType: t.expressionType ?? "—",
      bid: t.bid,
      baseBid: t.bid,
      campaignId: t.campaignId,
      adGroupId: t.adGroupId,
      sponsoredType: "Sponsored Products",
    };
  }).filter((t) => t.targetId);
}

export async function listSpTargetsForConsoleFiltered(
  ctx: AdsConsoleApiContext,
  opts: TargetConsoleListOptions,
): Promise<TargetConsoleListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));

  if (!opts.dateFrom?.trim() || !opts.dateTo?.trim()) {
    return { targets: [], total: 0, page, pageSize, requiresFilters: true };
  }

  const dateFrom = opts.dateFrom.trim();
  const dateTo = opts.dateTo.trim();
  const stateInclude = opts.state?.length
    ? opts.state
    : ["ENABLED", "PAUSED", "ARCHIVED"];
  const targetType = opts.targetType ?? "all";

  const includeKeywords = targetType === "all" || targetType === "keyword";
  const includeProductClauses = targetType === "all" || targetType === "product" || targetType === "other";

  const [campaignNames, adGroupNames, keywordRows, productRows, keywordMetrics, productMetrics] =
    await Promise.all([
      listCampaignNamesMap(ctx),
      listAdGroupNamesMap(ctx),
      includeKeywords ? listSpKeywordTargetsRaw(ctx, stateInclude) : Promise.resolve([]),
      includeProductClauses ? listSpProductTargetsRaw(ctx, stateInclude) : Promise.resolve([]),
      includeKeywords
        ? fetchSpKeywordTargetingReportMetricsMap({
            settings: ctx.settings,
            refreshToken: ctx.refreshToken,
            profileId: ctx.profileId,
            marketplaceCode: ctx.marketplaceCode,
            startDate: dateFrom,
            endDate: dateTo,
            timeoutMs: 90000,
          })
        : Promise.resolve(new Map<string, SpPerformanceMetrics>()),
      includeProductClauses
        ? fetchSpTargetClauseReportMetricsMap({
            settings: ctx.settings,
            refreshToken: ctx.refreshToken,
            profileId: ctx.profileId,
            marketplaceCode: ctx.marketplaceCode,
            startDate: dateFrom,
            endDate: dateTo,
            timeoutMs: 90000,
          })
        : Promise.resolve(new Map<string, SpPerformanceMetrics>()),
    ]);

  let rows: AdsConsoleTargetRow[] = [];

  for (const row of keywordRows) {
    const enriched = applyTargetMetrics(row, keywordMetrics.get(row.targetId));
    rows.push({
      ...enriched,
      campaignName: row.campaignId ? campaignNames.get(row.campaignId) : undefined,
      adGroupName: row.adGroupId ? adGroupNames.get(row.adGroupId) : undefined,
    });
  }

  for (const row of productRows) {
    if (targetType === "product" && row.targetKind !== "product") continue;
    if (targetType === "other" && row.targetKind !== "other") continue;
    const enriched = applyTargetMetrics(row, productMetrics.get(row.targetId));
    rows.push({
      ...enriched,
      campaignName: row.campaignId ? campaignNames.get(row.campaignId) : undefined,
      adGroupName: row.adGroupId ? adGroupNames.get(row.adGroupId) : undefined,
    });
  }

  const nameQuery = opts.name?.trim().toLowerCase();
  if (nameQuery) {
    rows = rows.filter(
      (r) =>
        r.targetText.toLowerCase().includes(nameQuery) ||
        (r.campaignName ?? "").toLowerCase().includes(nameQuery),
    );
  }

  rows = sortTargetRows(rows, opts.sort);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const targets = rows.slice(start, start + pageSize);

  return { targets, total, page, pageSize, requiresFilters: false };
}

export async function listSpTargetsForConsole(ctx: AdsConsoleApiContext): Promise<AdsConsoleTargetRow[]> {
  const result = await listSpTargetsForConsoleFiltered(ctx, {
    dateFrom: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
    targetType: "keyword",
    page: 1,
    pageSize: 100,
  });
  return result.targets;
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

export type CampaignConsoleListOptions = {
  dateFrom?: string;
  dateTo?: string;
  state?: string[];
  name?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
};

export type CampaignConsoleListResult = {
  campaigns: AdsConsoleCampaignRow[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
};

function sortCampaignRows(rows: AdsConsoleCampaignRow[], sort?: string): AdsConsoleCampaignRow[] {
  const key = sort?.trim() || "-spend";
  const desc = key.startsWith("-");
  const field = desc ? key.slice(1) : key;
  const mul = desc ? -1 : 1;

  const getValue = (row: AdsConsoleCampaignRow): number | string => {
    switch (field) {
      case "spend":
        return row.spend ?? 0;
      case "clicks":
        return row.clicks ?? 0;
      case "impressions":
        return row.impressions ?? 0;
      case "name":
        return row.name.toLowerCase();
      case "roas":
        return row.roas ?? 0;
      case "acos":
        return row.acos ?? 0;
      default:
        return row.spend ?? 0;
    }
  };

  return [...rows].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });
}

function mapSpCampaignToRow(
  c: {
    campaignId?: string;
    name?: string;
    state?: string;
    targetingType?: string;
    budget?: { budget?: number; budgetType?: string };
    startDate?: string;
    portfolioId?: string;
    dynamicBidding?: { strategy?: string };
  },
  portfolios: Map<string, string>,
  metrics?: {
    impressions?: number;
    clicks?: number;
    spend?: number;
    purchases?: number;
    sales?: number;
    ctr?: number;
    cpc?: number;
    cvr?: number;
    roas?: number;
    acos?: number;
  },
  todaySpend?: number,
): AdsConsoleCampaignRow {
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
    todaySpend,
    currencyCode: undefined,
    biddingStrategy: c.dynamicBidding?.strategy,
    impressions: metrics?.impressions,
    clicks: metrics?.clicks,
    spend: metrics?.spend,
    purchases: metrics?.purchases,
    adSales: metrics?.sales,
    ctr: metrics?.ctr,
    cpc: metrics?.cpc,
    cvr: metrics?.cvr,
    roas: metrics?.roas,
    acos: metrics?.acos,
  };
}

export async function listSpCampaignsForConsoleFiltered(
  ctx: AdsConsoleApiContext,
  opts: CampaignConsoleListOptions,
): Promise<CampaignConsoleListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));

  if (!opts.dateFrom?.trim() || !opts.dateTo?.trim()) {
    return { campaigns: [], total: 0, page, pageSize, requiresFilters: true };
  }

  const dateFrom = opts.dateFrom.trim();
  const dateTo = opts.dateTo.trim();
  const stateInclude = opts.state?.length
    ? opts.state
    : ["ENABLED", "PAUSED", "ARCHIVED"];

  const portfolios = await listPortfoliosMap(ctx);

  const campaignsRaw = await listAllPages(async (nextToken) => {
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
        stateFilter: { include: stateInclude },
        maxResults: 100,
        nextToken,
        includeExtendedDataFields: true,
      },
    });

    return {
      items: response.campaigns ?? [],
      nextToken: response.nextToken,
    };
  }, 20);

  const todayStr = new Date().toISOString().slice(0, 10);
  const includeToday = dateFrom <= todayStr && todayStr <= dateTo;

  const [metricsMap, todayMap] = await Promise.all([
    fetchSpCampaignReportMetricsMap({
      settings: ctx.settings,
      refreshToken: ctx.refreshToken,
      profileId: ctx.profileId,
      marketplaceCode: ctx.marketplaceCode,
      startDate: dateFrom,
      endDate: dateTo,
      timeoutMs: 90000,
    }),
    includeToday
      ? fetchSpCampaignReportMetricsMap({
          settings: ctx.settings,
          refreshToken: ctx.refreshToken,
          profileId: ctx.profileId,
          marketplaceCode: ctx.marketplaceCode,
          startDate: todayStr,
          endDate: todayStr,
          timeoutMs: 60000,
        })
      : Promise.resolve(new Map<string, SpCampaignReportMetrics>()),
  ]);

  let rows = campaignsRaw
    .map((c) => {
      const id = c.campaignId ?? "";
      const metrics = metricsMap.get(id);
      const todayMetrics = todayMap.get(id);
      return mapSpCampaignToRow(c, portfolios, metrics, todayMetrics?.spend);
    })
    .filter((c) => c.campaignId);

  const nameQuery = opts.name?.trim().toLowerCase();
  if (nameQuery) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(nameQuery));
  }

  rows = sortCampaignRows(rows, opts.sort);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const campaigns = rows.slice(start, start + pageSize);

  return { campaigns, total, page, pageSize, requiresFilters: false };
}

function formatAdsDate(raw?: string): string | undefined {
  if (!raw || raw.length < 8) return raw;
  if (raw.includes("-")) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
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
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const result = await listSearchTermsForConsoleFiltered(ctx, {
    dateFrom: start,
    dateTo: end,
    page: 1,
    pageSize: 100,
  });
  return result.searchTerms;
}

export type SearchTermConsoleListOptions = {
  dateFrom?: string;
  dateTo?: string;
  name?: string;
  termType?: "all" | "auto" | "auto_product" | "manual";
  page?: number;
  pageSize?: number;
  sort?: string;
};

export type SearchTermConsoleListResult = {
  searchTerms: AmazonSearchTermRow[];
  total: number;
  page: number;
  pageSize: number;
  requiresFilters: boolean;
};

function sortSearchTermRows(rows: AmazonSearchTermRow[], sort?: string): AmazonSearchTermRow[] {
  const key = sort?.trim() || "-spend";
  const desc = key.startsWith("-");
  const field = desc ? key.slice(1) : key;
  const mul = desc ? -1 : 1;

  const getValue = (row: AmazonSearchTermRow): number | string => {
    switch (field) {
      case "spend":
        return row.spend ?? (row.costCents ?? 0) / 100;
      case "clicks":
        return row.clicks ?? 0;
      case "impressions":
        return row.impressions ?? 0;
      case "searchTerm":
        return row.searchTerm.toLowerCase();
      case "cpc":
        return row.cpc ?? 0;
      default:
        return row.spend ?? (row.costCents ?? 0) / 100;
    }
  };

  return [...rows].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });
}

export async function listSearchTermsForConsoleFiltered(
  ctx: AdsConsoleApiContext,
  opts: SearchTermConsoleListOptions,
): Promise<SearchTermConsoleListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));

  if (!opts.dateFrom?.trim() || !opts.dateTo?.trim()) {
    return { searchTerms: [], total: 0, page, pageSize, requiresFilters: true };
  }

  const rows = await fetchSearchTermReportRows({
    settings: ctx.settings,
    refreshToken: ctx.refreshToken,
    profileId: ctx.profileId,
    marketplaceCode: ctx.marketplaceCode,
    startDate: opts.dateFrom.trim(),
    endDate: opts.dateTo.trim(),
    timeoutMs: 90000,
  });

  let filtered = rows.map((r) => ({
    ...r,
    searchTermId: r.searchTermId ?? r.searchTerm,
    sponsoredType: r.sponsoredType ?? "Sponsored Products",
    purchases: r.purchases ?? r.orders,
  }));

  const termType = opts.termType ?? "all";
  if (termType !== "all") {
    filtered = filtered.filter((r) => r.termKind === termType);
  }

  const nameQuery = opts.name?.trim().toLowerCase();
  if (nameQuery) {
    filtered = filtered.filter(
      (r) =>
        r.searchTerm.toLowerCase().includes(nameQuery) ||
        (r.campaignName ?? "").toLowerCase().includes(nameQuery),
    );
  }

  filtered = sortSearchTermRows(filtered, opts.sort);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const searchTerms = filtered.slice(start, start + pageSize);

  return { searchTerms, total, page, pageSize, requiresFilters: false };
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
