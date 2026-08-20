import type { AdsConsoleCampaignRow, AdsConsoleTargetRow } from "./amazon-ads-console.js";
import type { CampaignConsoleListOptions, CampaignConsoleListResult } from "./amazon-ads-console.js";
import type { TargetConsoleListOptions, TargetConsoleListResult } from "./amazon-ads-console.js";

export function isAdsConsoleDemoEnabled(): boolean {
  return process.env.ADS_CONSOLE_DEMO === "1" || process.env.ADS_CONSOLE_DEMO === "true";
}

export function isAdsConsoleDemoRequest(query: Record<string, unknown>): boolean {
  if (isAdsConsoleDemoEnabled()) return true;
  const demo = query.demo;
  return demo === "1" || demo === "true";
}

const DEMO_CAMPAIGNS: AdsConsoleCampaignRow[] = [
  {
    campaignId: "demo-camp-001",
    name: "SP | Brand Defense | Exact",
    state: "ENABLED",
    targetingType: "MANUAL",
    sponsoredType: "Sponsored Products",
    portfolioName: "Core SKUs",
    budget: 45,
    baseBudget: 40,
    budgetType: "DAILY",
    startDate: "2025-11-01",
    todaySpend: 12.34,
    biddingStrategy: "LEGACY_FOR_SALES",
    impressions: 8420,
    clicks: 312,
    spend: 186.42,
    purchases: 28,
    adSales: 942.5,
    ctr: 312 / 8420,
    cpc: 186.42 / 312,
    cvr: 28 / 312,
    roas: 942.5 / 186.42,
    acos: 186.42 / 942.5,
  },
  {
    campaignId: "demo-camp-002",
    name: "SP | Category Conquest | Broad",
    state: "ENABLED",
    targetingType: "MANUAL",
    sponsoredType: "Sponsored Products",
    portfolioName: "Growth",
    budget: 75,
    baseBudget: 75,
    budgetType: "DAILY",
    startDate: "2025-09-15",
    todaySpend: 22.1,
    biddingStrategy: "AUTO_FOR_SALES",
    impressions: 15230,
    clicks: 498,
    spend: 312.88,
    purchases: 41,
    adSales: 1284.2,
    ctr: 498 / 15230,
    cpc: 312.88 / 498,
    cvr: 41 / 498,
    roas: 1284.2 / 312.88,
    acos: 312.88 / 1284.2,
  },
  {
    campaignId: "demo-camp-003",
    name: "SP | Auto Discovery",
    state: "PAUSED",
    targetingType: "AUTO",
    sponsoredType: "Sponsored Products",
    budget: 25,
    baseBudget: 25,
    budgetType: "DAILY",
    startDate: "2026-01-10",
    todaySpend: 0,
    impressions: 2100,
    clicks: 44,
    spend: 28.6,
    purchases: 3,
    adSales: 89.97,
    ctr: 44 / 2100,
    cpc: 28.6 / 44,
    cvr: 3 / 44,
    roas: 89.97 / 28.6,
    acos: 28.6 / 89.97,
  },
  {
    campaignId: "demo-camp-004",
    name: "SP | Competitor ASINs",
    state: "ENABLED",
    targetingType: "MANUAL",
    sponsoredType: "Sponsored Products",
    portfolioName: "Conquest",
    budget: 60,
    baseBudget: 55,
    budgetType: "DAILY",
    startDate: "2025-12-01",
    todaySpend: 18.75,
    impressions: 6240,
    clicks: 201,
    spend: 145.2,
    purchases: 19,
    adSales: 612.8,
    ctr: 201 / 6240,
    cpc: 145.2 / 201,
    cvr: 19 / 201,
    roas: 612.8 / 145.2,
    acos: 145.2 / 612.8,
  },
];

function enrichDemoTargets(rows: AdsConsoleTargetRow[]): AdsConsoleTargetRow[] {
  const tagPool = ["brand", "conquest", "auto", "exact", "growth", "paused-test"];
  return rows.map((row, i) => ({
    ...row,
    previousBid: row.previousBid ?? (row.bid != null ? Math.max(row.bid - 0.05, 0.2) : undefined),
    lastBidChange: row.lastBidChange ?? `2026-08-${String(1 + (i % 18)).padStart(2, "0")}`,
    topOfSearchImpressions:
      row.topOfSearchImpressions ??
      (row.impressions != null ? Math.round(row.impressions * (0.08 + (i % 5) * 0.02)) : undefined),
    oldTags: row.oldTags ?? tagPool.slice(i % 3, (i % 3) + 2).join(", "),
  }));
}

const RAW_DEMO_TARGETS: AdsConsoleTargetRow[] = [
  {
    targetId: "demo-kw-001",
    targetText: "wireless earbuds",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "EXACT",
    bid: 1.25,
    baseBid: 1.1,
    campaignId: "demo-camp-001",
    campaignName: "SP | Brand Defense | Exact",
    adGroupId: "demo-ag-001",
    adGroupName: "Brand Exact Core",
    sponsoredType: "Sponsored Products",
    impressions: 4200,
    clicks: 168,
    spend: 198.4,
    purchases: 22,
    adSales: 780.5,
    ctr: 168 / 4200,
    cpc: 198.4 / 168,
    cvr: 22 / 168,
    roas: 780.5 / 198.4,
    acos: 198.4 / 780.5,
  },
  {
    targetId: "demo-kw-002",
    targetText: "bluetooth headphones noise cancelling",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "PHRASE",
    bid: 0.95,
    baseBid: 0.85,
    campaignId: "demo-camp-002",
    campaignName: "SP | Category Conquest | Broad",
    adGroupId: "demo-ag-002",
    adGroupName: "Category Phrase",
    sponsoredType: "Sponsored Products",
    impressions: 3100,
    clicks: 92,
    spend: 78.2,
    purchases: 8,
    adSales: 256.4,
    ctr: 92 / 3100,
    cpc: 78.2 / 92,
    cvr: 8 / 92,
    roas: 256.4 / 78.2,
    acos: 78.2 / 256.4,
  },
  {
    targetId: "demo-kw-003",
    targetText: "ear buds for running",
    targetKind: "keyword",
    state: "PAUSED",
    matchType: "BROAD",
    bid: 0.72,
    baseBid: 0.72,
    campaignId: "demo-camp-002",
    campaignName: "SP | Category Conquest | Broad",
    adGroupId: "demo-ag-003",
    adGroupName: "Broad Discovery",
    sponsoredType: "Sponsored Products",
    impressions: 890,
    clicks: 18,
    spend: 11.4,
    purchases: 1,
    adSales: 29.99,
    ctr: 18 / 890,
    cpc: 11.4 / 18,
    cvr: 1 / 18,
    roas: 29.99 / 11.4,
    acos: 11.4 / 29.99,
  },
  {
    targetId: "demo-kw-004",
    targetText: "brand name earbuds pro",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "EXACT",
    bid: 1.45,
    baseBid: 1.35,
    campaignId: "demo-camp-001",
    campaignName: "SP | Brand Defense | Exact",
    adGroupId: "demo-ag-001",
    adGroupName: "Brand Exact Core",
    sponsoredType: "Sponsored Products",
    impressions: 2800,
    clicks: 112,
    spend: 142.8,
    purchases: 14,
    adSales: 489.6,
    ctr: 112 / 2800,
    cpc: 142.8 / 112,
    cvr: 14 / 112,
    roas: 489.6 / 142.8,
    acos: 142.8 / 489.6,
  },
  {
    targetId: "demo-kw-005",
    targetText: "workout earbuds waterproof",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "PHRASE",
    bid: 0.88,
    baseBid: 0.8,
    campaignId: "demo-camp-003",
    campaignName: "SP | Auto Discovery",
    adGroupId: "demo-ag-004",
    adGroupName: "Auto Close Match",
    sponsoredType: "Sponsored Products",
    impressions: 1540,
    clicks: 41,
    spend: 32.1,
    purchases: 4,
    adSales: 119.96,
    ctr: 41 / 1540,
    cpc: 32.1 / 41,
    cvr: 4 / 41,
    roas: 119.96 / 32.1,
    acos: 32.1 / 119.96,
  },
  {
    targetId: "demo-prod-001",
    targetText: "ASIN: B0COMPETITOR1",
    targetKind: "product",
    state: "ENABLED",
    matchType: "MANUAL",
    bid: 1.05,
    baseBid: 0.95,
    campaignId: "demo-camp-004",
    campaignName: "SP | Competitor ASINs",
    adGroupId: "demo-ag-005",
    adGroupName: "Competitor Targets",
    sponsoredType: "Sponsored Products",
    impressions: 1920,
    clicks: 58,
    spend: 54.6,
    purchases: 6,
    adSales: 198.5,
    ctr: 58 / 1920,
    cpc: 54.6 / 58,
    cvr: 6 / 58,
    roas: 198.5 / 54.6,
    acos: 54.6 / 198.5,
  },
  {
    targetId: "demo-prod-002",
    targetText: "ASIN: B0COMPETITOR2",
    targetKind: "product",
    state: "ENABLED",
    matchType: "MANUAL",
    bid: 0.98,
    baseBid: 0.98,
    campaignId: "demo-camp-004",
    campaignName: "SP | Competitor ASINs",
    adGroupId: "demo-ag-005",
    adGroupName: "Competitor Targets",
    sponsoredType: "Sponsored Products",
    impressions: 1340,
    clicks: 44,
    spend: 41.2,
    purchases: 5,
    adSales: 164.95,
    ctr: 44 / 1340,
    cpc: 41.2 / 44,
    cvr: 5 / 44,
    roas: 164.95 / 41.2,
    acos: 41.2 / 164.95,
  },
  {
    targetId: "demo-prod-003",
    targetText: "CATEGORY: Electronics › Headphones",
    targetKind: "product",
    state: "PAUSED",
    matchType: "MANUAL",
    bid: 0.65,
    baseBid: 0.65,
    campaignId: "demo-camp-002",
    campaignName: "SP | Category Conquest | Broad",
    adGroupId: "demo-ag-006",
    adGroupName: "Category Targets",
    sponsoredType: "Sponsored Products",
    impressions: 760,
    clicks: 12,
    spend: 7.8,
    purchases: 0,
    adSales: 0,
    ctr: 12 / 760,
    cpc: 7.8 / 12,
    cvr: 0,
    roas: 0,
  },
  {
    targetId: "demo-other-001",
    targetText: "close-match",
    targetKind: "other",
    state: "ENABLED",
    matchType: "AUTO",
    bid: 0.55,
    baseBid: 0.5,
    campaignId: "demo-camp-003",
    campaignName: "SP | Auto Discovery",
    adGroupId: "demo-ag-004",
    adGroupName: "Auto Close Match",
    sponsoredType: "Sponsored Products",
    impressions: 2200,
    clicks: 66,
    spend: 28.9,
    purchases: 3,
    adSales: 89.97,
    ctr: 66 / 2200,
    cpc: 28.9 / 66,
    cvr: 3 / 66,
    roas: 89.97 / 28.9,
    acos: 28.9 / 89.97,
  },
  {
    targetId: "demo-other-002",
    targetText: "substitutes",
    targetKind: "other",
    state: "ENABLED",
    matchType: "AUTO",
    bid: 0.48,
    baseBid: 0.45,
    campaignId: "demo-camp-003",
    campaignName: "SP | Auto Discovery",
    adGroupId: "demo-ag-007",
    adGroupName: "Auto Substitutes",
    sponsoredType: "Sponsored Products",
    impressions: 980,
    clicks: 21,
    spend: 9.4,
    purchases: 1,
    adSales: 24.99,
    ctr: 21 / 980,
    cpc: 9.4 / 21,
    cvr: 1 / 21,
    roas: 24.99 / 9.4,
    acos: 9.4 / 24.99,
  },
  {
    targetId: "demo-kw-006",
    targetText: "anc earbuds",
    targetKind: "keyword",
    state: "ARCHIVED",
    matchType: "EXACT",
    bid: 0.6,
    baseBid: 0.6,
    campaignId: "demo-camp-001",
    campaignName: "SP | Brand Defense | Exact",
    adGroupId: "demo-ag-001",
    adGroupName: "Brand Exact Core",
    sponsoredType: "Sponsored Products",
    impressions: 120,
    clicks: 2,
    spend: 1.2,
    purchases: 0,
    adSales: 0,
    ctr: 2 / 120,
    cpc: 0.6,
    cvr: 0,
  },
  {
    targetId: "demo-kw-007",
    targetText: "gym earbuds",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "BROAD",
    bid: 0.82,
    baseBid: 0.75,
    campaignId: "demo-camp-002",
    campaignName: "SP | Category Conquest | Broad",
    adGroupId: "demo-ag-003",
    adGroupName: "Broad Discovery",
    sponsoredType: "Sponsored Products",
    impressions: 2450,
    clicks: 73,
    spend: 56.4,
    purchases: 7,
    adSales: 223.3,
    ctr: 73 / 2450,
    cpc: 56.4 / 73,
    cvr: 7 / 73,
    roas: 223.3 / 56.4,
    acos: 56.4 / 223.3,
  },
  {
    targetId: "demo-kw-008",
    targetText: "usb c earbuds",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "PHRASE",
    bid: 0.91,
    baseBid: 0.88,
    campaignId: "demo-camp-001",
    campaignName: "SP | Brand Defense | Exact",
    adGroupId: "demo-ag-008",
    adGroupName: "Accessory Keywords",
    sponsoredType: "Sponsored Products",
    impressions: 1680,
    clicks: 52,
    spend: 44.8,
    purchases: 6,
    adSales: 179.94,
    ctr: 52 / 1680,
    cpc: 44.8 / 52,
    cvr: 6 / 52,
    roas: 179.94 / 44.8,
    acos: 44.8 / 179.94,
  },
  {
    targetId: "demo-prod-004",
    targetText: "ASIN: B0COMPETITOR3",
    targetKind: "product",
    state: "ENABLED",
    matchType: "MANUAL",
    bid: 1.12,
    baseBid: 1.0,
    campaignId: "demo-camp-004",
    campaignName: "SP | Competitor ASINs",
    adGroupId: "demo-ag-005",
    adGroupName: "Competitor Targets",
    sponsoredType: "Sponsored Products",
    impressions: 890,
    clicks: 29,
    spend: 30.5,
    purchases: 3,
    adSales: 104.97,
    ctr: 29 / 890,
    cpc: 30.5 / 29,
    cvr: 3 / 29,
    roas: 104.97 / 30.5,
    acos: 30.5 / 104.97,
  },
  {
    targetId: "demo-kw-009",
    targetText: "small earbuds comfortable",
    targetKind: "keyword",
    state: "ENABLED",
    matchType: "BROAD",
    bid: 0.77,
    baseBid: 0.7,
    campaignId: "demo-camp-002",
    campaignName: "SP | Category Conquest | Broad",
    adGroupId: "demo-ag-003",
    adGroupName: "Broad Discovery",
    sponsoredType: "Sponsored Products",
    impressions: 1980,
    clicks: 61,
    spend: 42.3,
    purchases: 5,
    adSales: 149.95,
    ctr: 61 / 1980,
    cpc: 42.3 / 61,
    cvr: 5 / 61,
    roas: 149.95 / 42.3,
    acos: 42.3 / 149.95,
  },
  {
    targetId: "demo-other-003",
    targetText: "loose-match",
    targetKind: "other",
    state: "PAUSED",
    matchType: "AUTO",
    bid: 0.42,
    baseBid: 0.42,
    campaignId: "demo-camp-003",
    campaignName: "SP | Auto Discovery",
    adGroupId: "demo-ag-007",
    adGroupName: "Auto Substitutes",
    sponsoredType: "Sponsored Products",
    impressions: 540,
    clicks: 9,
    spend: 3.8,
    purchases: 0,
    adSales: 0,
    ctr: 9 / 540,
    cpc: 3.8 / 9,
    cvr: 0,
  },
];

const DEMO_TARGETS = enrichDemoTargets(RAW_DEMO_TARGETS);

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, page, pageSize };
}

export function listDemoCampaignsFiltered(opts: CampaignConsoleListOptions): CampaignConsoleListResult {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));

  if (!opts.dateFrom?.trim() || !opts.dateTo?.trim()) {
    return { campaigns: [], total: 0, page, pageSize, requiresFilters: true };
  }

  let rows = [...DEMO_CAMPAIGNS];
  const stateInclude = opts.state?.length ? opts.state : ["ENABLED", "PAUSED", "ARCHIVED"];
  rows = rows.filter((r) => stateInclude.includes(r.state.toUpperCase()));

  const nameQuery = opts.name?.trim().toLowerCase();
  if (nameQuery) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(nameQuery));
  }

  const sort = opts.sort?.trim() || "-spend";
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  const mul = desc ? -1 : 1;
  rows.sort((a, b) => {
    const av = field === "name" ? a.name.toLowerCase() : (a.spend ?? 0);
    const bv = field === "name" ? b.name.toLowerCase() : (b.spend ?? 0);
    if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });

  const { items, total } = paginate(rows, page, pageSize);
  return { campaigns: items, total, page, pageSize, requiresFilters: false };
}

export function listDemoTargetsFiltered(opts: TargetConsoleListOptions): TargetConsoleListResult {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));

  if (!opts.dateFrom?.trim() || !opts.dateTo?.trim()) {
    return { targets: [], total: 0, page, pageSize, requiresFilters: true };
  }

  let rows = [...DEMO_TARGETS];
  const targetType = opts.targetType ?? "all";
  if (targetType !== "all") {
    rows = rows.filter((r) => r.targetKind === targetType);
  }

  const stateInclude = opts.state?.length ? opts.state : ["ENABLED", "PAUSED", "ARCHIVED"];
  rows = rows.filter((r) => stateInclude.includes(r.state.toUpperCase()));

  const nameQuery = opts.name?.trim().toLowerCase();
  if (nameQuery) {
    rows = rows.filter(
      (r) =>
        r.targetText.toLowerCase().includes(nameQuery) ||
        (r.campaignName ?? "").toLowerCase().includes(nameQuery),
    );
  }

  const sort = opts.sort?.trim() || "-spend";
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  const mul = desc ? -1 : 1;
  rows.sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (field === "targetText") {
      av = a.targetText.toLowerCase();
      bv = b.targetText.toLowerCase();
    } else if (field === "campaignName") {
      av = (a.campaignName ?? "").toLowerCase();
      bv = (b.campaignName ?? "").toLowerCase();
    } else {
      av = a.spend ?? 0;
      bv = b.spend ?? 0;
    }
    if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });

  const { items, total } = paginate(rows, page, pageSize);
  return { targets: items, total, page, pageSize, requiresFilters: false };
}
