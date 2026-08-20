import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  adsProjectsTable,
  type AdsKeywordEntry,
  type AdsSourcesSnapshot,
} from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  requireWorkspaceAction,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
  workspaceOwnerFilter,
  buildTeamAwareCreditCtx,
} from "../lib/workspace-route-helpers";
import { resolveAmazonConnectionForWorkspace } from "../lib/resolve-amazon-settings.js";
import {
  canUseAmazonAds,
  getAmazonAdsWorkspaceSettings,
  saveAmazonAdsProfile,
} from "../lib/amazon-ads-connection.js";
import {
  createSponsoredProductsCampaign,
  fetchKeywordRecommendationsForAsins,
  fetchSearchTermReportRows,
  listAmazonAdsProfiles,
  listExistingSpKeywords,
} from "../lib/amazon-ads-api.js";
import {
  bulkUpdateSpCampaigns,
  listSearchTermsForConsoleFiltered,
  listSpCampaignsForConsoleFiltered,
  listSpNegativeTargetsForConsole,
  listSpPlacementsForConsoleFiltered,
  listSpProductAdsForConsole,
  listSpTargetsForConsoleFiltered,
  type AdsConsoleApiContext,
} from "../lib/amazon-ads-console.js";
import {
  isAdsConsoleDemoRequest,
  listDemoCampaignsFiltered,
  listDemoPlacementsFiltered,
  listDemoSearchTermsFiltered,
  listDemoTargetsFiltered,
} from "../lib/ads-console-demo-data.js";
import {
  expandKeywordsWithAi,
  mergeKeywordSources,
  scoreAndRankKeywords,
} from "../lib/ads-keyword-pipeline.js";
import { loadListingContextForAsin } from "../lib/ads-product-context.js";
import { getCreditCost, hasCreditsTeamAware, deductCreditsTeamAware } from "../lib/credits";
import { mapAiProviderError } from "../lib/ai-error-utils";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

function serializeProject(row: typeof adsProjectsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    productName: row.productName,
    category: row.category,
    asin: row.asin,
    status: row.status,
    platform: row.platform,
    currentStep: row.currentStep,
    auditId: row.auditId,
    amazonProfileId: row.amazonProfileId,
    amazonCampaignId: row.amazonCampaignId,
    amazonAdGroupId: row.amazonAdGroupId,
    dailyBudgetCents: row.dailyBudgetCents,
    budget: row.budget,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    targeting: row.targeting,
    keywordData: row.keywordData,
    sourcesSnapshot: row.sourcesSnapshot,
    creativeUrls: row.creativeUrls,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    workflowUrl: `/ads/${row.id}`,
    detailUrl: `/products/${row.id}?source=ads`,
  };
}

async function adsScopeWhere(req: Request, extra?: ReturnType<typeof eq>) {
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "ads", worked, "ads", adsProjectsTable);
  return and(
    workspaceOwnerFilter(adsProjectsTable, adsProjectsTable, ownerId, workspaceId),
    eq(adsProjectsTable.isDeleted, 0),
    ownFilter,
    extra,
  );
}

router.get("/ads/status", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: "Workspace required" });
    return;
  }

  if (isAdsConsoleDemoRequest(req.query as Record<string, unknown>)) {
    res.json({
      spApiReady: true,
      sellerConnected: true,
      profileSelected: true,
      profileId: "demo-profile",
      profileName: "Demo Ads Profile (US)",
      profileCountryCode: "US",
      canGatherData: true,
      canCreateOnAmazon: false,
      demoMode: true,
    });
    return;
  }

  const readiness = await canUseAmazonAds(workspaceId);
  const adsSettings = await getAmazonAdsWorkspaceSettings(workspaceId);

  res.json({
    spApiReady: readiness.spApiReady,
    sellerConnected: readiness.sellerConnected,
    profileSelected: readiness.profileSelected,
    profileId: adsSettings?.profileId ?? readiness.profileId,
    profileName: adsSettings?.profileName,
    profileCountryCode: adsSettings?.profileCountryCode,
    canGatherData: readiness.spApiReady && readiness.sellerConnected && readiness.profileSelected,
    canCreateOnAmazon: readiness.spApiReady && readiness.sellerConnected && readiness.profileSelected,
  });
});

router.get("/ads/profiles", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  const userId = (req as AuthedRequest).userId;
  if (!workspaceId) {
    res.status(400).json({ error: "Workspace required" });
    return;
  }

  const conn = await resolveAmazonConnectionForWorkspace({ workspaceId, userId, req });
  if (!conn) {
    res.status(400).json({ error: "Connect Amazon on Marketplaces before selecting an Ads profile." });
    return;
  }

  try {
    const profiles = await listAmazonAdsProfiles({
      settings: conn.settings,
      refreshToken: conn.refreshToken,
      marketplaceCode: conn.settings.defaultMarketplace,
    });
    res.json({
      profiles: profiles.map((p) => ({
        profileId: String(p.profileId),
        countryCode: p.countryCode,
        currencyCode: p.currencyCode,
        timezone: p.timezone,
        name: p.accountInfo?.name,
        accountType: p.accountInfo?.type,
        marketplaceId: p.accountInfo?.marketplaceStringId,
      })),
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Could not list Amazon Ads profiles.",
    });
  }
});

router.post("/ads/profile", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "edit"), async (req, res): Promise<void> => {
  const workspaceId = getActiveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: "Workspace required" });
    return;
  }

  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId.trim() : "";
  if (!profileId) {
    res.status(400).json({ error: "profileId is required" });
    return;
  }

  const saved = await saveAmazonAdsProfile(workspaceId, {
    profileId,
    profileCountryCode: typeof req.body?.profileCountryCode === "string" ? req.body.profileCountryCode : undefined,
    profileCurrencyCode: typeof req.body?.profileCurrencyCode === "string" ? req.body.profileCurrencyCode : undefined,
    profileName: typeof req.body?.profileName === "string" ? req.body.profileName : undefined,
  });

  res.json({ ok: true, profile: saved });
});

router.get("/ads/projects", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req))
    .orderBy(desc(adsProjectsTable.updatedAt))
    .limit(100);

  res.json({ projects: rows.map(serializeProject) });
});

router.post("/ads/projects", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "create"), async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const team = (req as { team?: { teamId?: string } }).team;

  const asin = typeof req.body?.asin === "string" ? req.body.asin.trim().toUpperCase() : "";
  if (!asin || asin.length < 10) {
    res.status(400).json({ error: "A valid product ASIN is required." });
    return;
  }

  const productName = typeof req.body?.productName === "string"
    ? req.body.productName.trim()
    : asin;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : `${productName} Campaign`;
  const auditId = typeof req.body?.auditId === "number" ? req.body.auditId : undefined;
  const amazonProfileId = typeof req.body?.amazonProfileId === "string"
    ? req.body.amazonProfileId.trim()
    : (await getAmazonAdsWorkspaceSettings(workspaceId!))?.profileId;

  const [row] = await db.insert(adsProjectsTable).values({
    userId: ownerId,
    workspaceId,
    teamId: team?.teamId,
    auditId,
    name,
    productName,
    asin,
    category: typeof req.body?.category === "string" ? req.body.category : undefined,
    amazonProfileId,
    status: "draft",
    currentStep: 1,
  }).returning();

  res.status(201).json({ project: serializeProject(row) });
});

router.get("/ads/projects/:id", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!row) {
    res.status(404).json({ error: "Ads project not found" });
    return;
  }

  res.json({ project: serializeProject(row) });
});

router.patch("/ads/projects/:id", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!existing) {
    res.status(404).json({ error: "Ads project not found" });
    return;
  }

  const updates: Partial<typeof adsProjectsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof req.body?.name === "string") updates.name = req.body.name.trim();
  if (typeof req.body?.currentStep === "number") updates.currentStep = req.body.currentStep;
  if (typeof req.body?.dailyBudgetCents === "number") updates.dailyBudgetCents = req.body.dailyBudgetCents;
  if (Array.isArray(req.body?.keywordData)) {
    updates.keywordData = req.body.keywordData as AdsKeywordEntry[];
    updates.targeting = (req.body.keywordData as AdsKeywordEntry[])
      .filter((k) => k.selected)
      .map((k) => k.keyword);
  }
  if (typeof req.body?.amazonProfileId === "string") updates.amazonProfileId = req.body.amazonProfileId.trim();

  const [row] = await db
    .update(adsProjectsTable)
    .set(updates)
    .where(eq(adsProjectsTable.id, id))
    .returning();

  res.json({ project: serializeProject(row) });
});

router.post("/ads/projects/:id/gather", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);

  const [project] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!project || !project.asin) {
    res.status(404).json({ error: "Ads project not found" });
    return;
  }

  const profileId = project.amazonProfileId
    ?? (workspaceId ? (await getAmazonAdsWorkspaceSettings(workspaceId))?.profileId : undefined);

  const listing = await loadListingContextForAsin({
    workspaceId,
    userId,
    asin: project.asin,
    auditId: project.auditId,
  });

  let recommendations: Awaited<ReturnType<typeof fetchKeywordRecommendationsForAsins>> = [];
  let existingKeywords: Awaited<ReturnType<typeof listExistingSpKeywords>> = [];
  let searchTerms: Awaited<ReturnType<typeof fetchSearchTermReportRows>> = [];
  const warnings: string[] = [];

  if (workspaceId && profileId) {
    const conn = await resolveAmazonConnectionForWorkspace({ workspaceId, userId, req });
    if (conn) {
      try {
        recommendations = await fetchKeywordRecommendationsForAsins({
          settings: conn.settings,
          refreshToken: conn.refreshToken,
          profileId,
          asins: [project.asin],
          marketplaceCode: conn.settings.defaultMarketplace,
        });
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : "Keyword recommendations failed");
      }

      try {
        existingKeywords = await listExistingSpKeywords({
          settings: conn.settings,
          refreshToken: conn.refreshToken,
          profileId,
          marketplaceCode: conn.settings.defaultMarketplace,
        });
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : "Existing campaign keywords failed");
      }

      try {
        searchTerms = await fetchSearchTermReportRows({
          settings: conn.settings,
          refreshToken: conn.refreshToken,
          profileId,
          marketplaceCode: conn.settings.defaultMarketplace,
        });
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : "Search term report failed");
      }
    } else {
      warnings.push("Amazon SP-API connection required for Ads API data.");
    }
  } else {
    warnings.push("Select an Amazon Ads profile to fetch recommendations and reports.");
  }

  const snapshot = mergeKeywordSources({
    recommendations,
    existingKeywords,
    searchTerms,
    listing,
  });
  if (warnings.length) {
    snapshot.warnings = [...(snapshot.warnings ?? []), ...warnings];
  }

  const [row] = await db
    .update(adsProjectsTable)
    .set({
      sourcesSnapshot: snapshot,
      productName: listing.title?.trim() || project.productName,
      currentStep: 2,
      updatedAt: new Date(),
    })
    .where(eq(adsProjectsTable.id, id))
    .returning();

  res.json({ project: serializeProject(row), snapshot });
});

router.post("/ads/projects/:id/expand", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const creditCtx = buildTeamAwareCreditCtx(req);

  const [project] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!project?.asin || !project.sourcesSnapshot) {
    res.status(400).json({ error: "Gather keyword data before AI expansion." });
    return;
  }

  const cost = await getCreditCost("ads");
  if (!await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired)) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  try {
    const aiKeywords = await expandKeywordsWithAi(project.sourcesSnapshot, project.asin);
    const keywordData = scoreAndRankKeywords(project.sourcesSnapshot, aiKeywords);

    const [row] = await db
      .update(adsProjectsTable)
      .set({
        keywordData,
        targeting: keywordData.filter((k) => k.selected).map((k) => k.keyword),
        currentStep: 3,
        updatedAt: new Date(),
      })
      .where(eq(adsProjectsTable.id, id))
      .returning();

    await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "ads", { projectId: id });

    res.json({ project: serializeProject(row), keywordData });
  } catch (err) {
    const { httpStatus, message } = mapAiProviderError(err);
    res.status(httpStatus).json({ error: message });
  }
});

router.post("/ads/projects/:id/score", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);

  const [project] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!project?.sourcesSnapshot) {
    res.status(400).json({ error: "Gather keyword data first." });
    return;
  }

  const aiKeywords = (project.keywordData ?? [])
    .filter((k) => k.sources.includes("ai_expansion"))
    .map((k) => ({ keyword: k.keyword, matchType: k.matchType, note: k.aiNote }));

  const keywordData = scoreAndRankKeywords(project.sourcesSnapshot, aiKeywords);

  const [row] = await db
    .update(adsProjectsTable)
    .set({
      keywordData,
      targeting: keywordData.filter((k) => k.selected).map((k) => k.keyword),
      currentStep: 3,
      updatedAt: new Date(),
    })
    .where(eq(adsProjectsTable.id, id))
    .returning();

  res.json({ project: serializeProject(row), keywordData });
});

router.post("/ads/projects/:id/create-campaign", requireAuth, resolveTeamAndWorkspace, requireWorkspaceAction("ads", "create"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = (req as AuthedRequest).userId;
  const workspaceId = getActiveWorkspaceId(req);
  const creditCtx = buildTeamAwareCreditCtx(req);

  const [project] = await db
    .select()
    .from(adsProjectsTable)
    .where(await adsScopeWhere(req, eq(adsProjectsTable.id, id)));

  if (!project?.asin) {
    res.status(404).json({ error: "Ads project not found" });
    return;
  }

  const keywordData = (req.body?.keywordData as AdsKeywordEntry[] | undefined) ?? project.keywordData ?? [];
  const selected = keywordData.filter((k) => k.selected);
  if (!selected.length) {
    res.status(400).json({ error: "Select at least one keyword before creating the campaign." });
    return;
  }

  const profileId = project.amazonProfileId
    ?? (workspaceId ? (await getAmazonAdsWorkspaceSettings(workspaceId))?.profileId : undefined);

  if (!workspaceId || !profileId) {
    res.status(400).json({ error: "Amazon Ads profile is required." });
    return;
  }

  const conn = await resolveAmazonConnectionForWorkspace({ workspaceId, userId, req });
  if (!conn) {
    res.status(400).json({ error: "Connect Amazon on Marketplaces first." });
    return;
  }

  const cost = await getCreditCost("ads");
  if (!await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired)) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const dailyBudgetCents = typeof req.body?.dailyBudgetCents === "number"
    ? req.body.dailyBudgetCents
    : project.dailyBudgetCents ?? 1000;

  try {
    const result = await createSponsoredProductsCampaign({
      settings: conn.settings,
      refreshToken: conn.refreshToken,
      profileId,
      marketplaceCode: conn.settings.defaultMarketplace,
      campaignName: project.name,
      dailyBudgetCents,
      asin: project.asin,
      keywords: selected.map((k) => ({
        keyword: k.keyword,
        matchType: k.matchType,
        bidCents: k.suggestedBidCents,
      })),
    });

    const [row] = await db
      .update(adsProjectsTable)
      .set({
        status: "active",
        amazonCampaignId: result.campaignId,
        amazonAdGroupId: result.adGroupId,
        dailyBudgetCents,
        keywordData,
        targeting: selected.map((k) => k.keyword),
        currentStep: 4,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(adsProjectsTable.id, id))
      .returning();

    await deductCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired, cost.activityName, "ads", { projectId: id });

    res.json({
      project: serializeProject(row),
      amazon: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Campaign creation failed";
    await db
      .update(adsProjectsTable)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(adsProjectsTable.id, id));
    res.status(400).json({ error: message });
  }
});

async function resolveAdsConsoleContext(req: Request): Promise<{
  ctx: AdsConsoleApiContext;
  workspaceId: number;
} | { error: string; status: number }> {
  const workspaceId = getActiveWorkspaceId(req);
  const userId = (req as AuthedRequest).userId;
  if (!workspaceId) return { error: "Workspace required", status: 400 };

  const readiness = await canUseAmazonAds(workspaceId);
  if (!readiness.spApiReady || !readiness.sellerConnected || !readiness.profileSelected) {
    return {
      error: "Connect Amazon on Marketplaces and select an Ads profile before using the ads console.",
      status: 400,
    };
  }

  const conn = await resolveAmazonConnectionForWorkspace({ workspaceId, userId, req });
  if (!conn) {
    return { error: "Amazon connection not found for this workspace.", status: 400 };
  }

  const adsSettings = await getAmazonAdsWorkspaceSettings(workspaceId);
  const profileId = adsSettings?.profileId?.trim();
  if (!profileId) {
    return { error: "Select an Amazon Ads profile on Marketplaces.", status: 400 };
  }

  return {
    workspaceId,
    ctx: {
      settings: conn.settings,
      refreshToken: conn.refreshToken,
      profileId,
      marketplaceCode: conn.settings.defaultMarketplace,
    },
  };
}

router.get("/ads/console/campaigns", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined;
  const pageSize = typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : undefined;
  const stateRaw = typeof req.query.state === "string" ? req.query.state : undefined;
  const state = stateRaw
    ? stateRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : undefined;

  if (isAdsConsoleDemoRequest(req.query as Record<string, unknown>)) {
    const result = listDemoCampaignsFiltered({
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
    });
    res.json({ ...result, profileId: "demo-profile", demoMode: true });
    return;
  }

  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const result = await listSpCampaignsForConsoleFiltered(resolved.ctx, {
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
    });
    res.json({ ...result, profileId: resolved.ctx.profileId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load campaigns" });
  }
});

router.get("/ads/console/targets", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined;
  const pageSize = typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : undefined;
  const stateRaw = typeof req.query.state === "string" ? req.query.state : undefined;
  const state = stateRaw
    ? stateRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : undefined;
  const targetTypeRaw = typeof req.query.targetType === "string" ? req.query.targetType : "all";
  const targetType =
    targetTypeRaw === "keyword" || targetTypeRaw === "product" || targetTypeRaw === "other"
      ? targetTypeRaw
      : "all";

  if (isAdsConsoleDemoRequest(req.query as Record<string, unknown>)) {
    const result = listDemoTargetsFiltered({
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
      targetType,
    });
    res.json({ ...result, profileId: "demo-profile", demoMode: true });
    return;
  }

  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const result = await listSpTargetsForConsoleFiltered(resolved.ctx, {
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
      targetType,
    });
    res.json({ ...result, profileId: resolved.ctx.profileId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load targets" });
  }
});

router.get("/ads/console/search-terms", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined;
  const pageSize = typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : undefined;
  const termTypeRaw = typeof req.query.termType === "string" ? req.query.termType : "all";
  const termType =
    termTypeRaw === "auto" || termTypeRaw === "auto_product" || termTypeRaw === "manual"
      ? termTypeRaw
      : "all";

  if (isAdsConsoleDemoRequest(req.query as Record<string, unknown>)) {
    const result = listDemoSearchTermsFiltered({
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      termType,
    });
    res.json({ ...result, profileId: "demo-profile", demoMode: true });
    return;
  }

  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const result = await listSearchTermsForConsoleFiltered(resolved.ctx, {
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      termType,
    });
    res.json({ ...result, profileId: resolved.ctx.profileId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load search terms" });
  }
});

router.get("/ads/console/product-ads", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const productAds = await listSpProductAdsForConsole(resolved.ctx);
    res.json({ productAds });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load product ads" });
  }
});

router.get("/ads/console/placements", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined;
  const pageSize = typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : undefined;
  const stateRaw = typeof req.query.state === "string" ? req.query.state : undefined;
  const state = stateRaw
    ? stateRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : undefined;
  const placementTypeRaw = typeof req.query.placementType === "string" ? req.query.placementType : "all";
  const placementType = placementTypeRaw === "amazon_business" ? "amazon_business" : "all";

  if (isAdsConsoleDemoRequest(req.query as Record<string, unknown>)) {
    const result = listDemoPlacementsFiltered({
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
      placementType,
    });
    res.json({ ...result, profileId: "demo-profile", demoMode: true });
    return;
  }

  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const result = await listSpPlacementsForConsoleFiltered(resolved.ctx, {
      dateFrom,
      dateTo,
      name,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      state,
      placementType,
    });
    res.json({ ...result, profileId: resolved.ctx.profileId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load placements" });
  }
});

router.get("/ads/console/negative-targets", requireAuth, resolveTeamAndWorkspace, async (req, res): Promise<void> => {
  const resolved = await resolveAdsConsoleContext(req);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  try {
    const negativeTargets = await listSpNegativeTargetsForConsole(resolved.ctx);
    res.json({ negativeTargets });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load negative targets" });
  }
});

router.post(
  "/ads/console/campaigns/bulk",
  requireAuth,
  resolveTeamAndWorkspace,
  requireWorkspaceAction("ads", "edit"),
  async (req, res): Promise<void> => {
    const resolved = await resolveAdsConsoleContext(req);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }

    const campaignIds = Array.isArray(req.body?.campaignIds)
      ? req.body.campaignIds.map(String).filter(Boolean)
      : [];
    const action = req.body?.action as "enable" | "pause" | "archive" | "budget";
    const dailyBudget = typeof req.body?.dailyBudget === "number" ? req.body.dailyBudget : undefined;

    if (!action || !["enable", "pause", "archive", "budget"].includes(action)) {
      res.status(400).json({ error: "Invalid bulk action" });
      return;
    }

    try {
      const result = await bulkUpdateSpCampaigns(resolved.ctx, {
        campaignIds,
        action,
        dailyBudget,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bulk update failed" });
    }
  },
);

export default router;
