import type { Request } from "express";
import { and, eq, or, isNull, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  competitorsTable,
  userProfilesTable,
  productProfilesTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
} from "@workspace/db";
import {
  getAccountOwnerId,
  getActiveWorkspaceId,
  getWorkspaceCtx,
  loadWorkedProjects,
  viewOwnIdFilter,
  workspaceOwnerFilter,
} from "./workspace-route-helpers";
import { buildProductSuggestions, type ProductSuggestionInput } from "./product-suggestions.js";
import { mapProductPriority, priorityFromStoredLevel } from "./product-priority.js";
import {
  getProductOrderStats,
  resolveRevenueCurrency,
} from "./product-orders.js";
import {
  listProductMarketplaces,
} from "./product-marketplaces.js";
import { pickProjectThumbnail } from "./scoped-recents-load.js";
import {
  type ProductSourceType,
  parseProductSourceType,
  PRODUCT_SOURCE_TRY_ORDER,
  auditAsinScopeFilter,
} from "./product-source.js";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin, filterTokenizedWooCommerceKeywords } from "./woocommerce-import-utils.js";
import { resolveDescriptionHtml } from "./resolve-listing-content.js";
import { readGeneratedContent } from "./listing-export-shared.js";
import { maybeRefreshStoreProductImages } from "./store-product-image-refresh.js";
import { maybeRefreshStoreProductListing, reloadAuditRow } from "./store-product-listing-refresh.js";

type ProductStatus = "active" | "in_progress" | "draft" | "failed";

export type ProductDetailPayload = {
  id: number;
  name: string;
  title: string;
  sku: string;
  imageUrl: string | null;
  imageUrls?: string[];
  brandName: string | null;
  category: string | null;
  status: ProductStatus;
  statusLabel: string;
  stageLabel: string;
  priorityLabel: string;
  priorityLevel: "low" | "medium" | "high";
  progressPercent: number;
  currentStep: number | null;
  createdAt: string;
  updatedAt: string;
  workflowUrl: string;
  detailUrl: string;
  sourceType: ProductSourceType;
  sourceTypeLabel: string;
  statsAuditId: number | null;
  manager: { name: string; initials: string };
  referenceLinks: Array<{ label: string; url: string }>;
  driveFolder: string;
  driveFolderUrl: string;
  workflowSteps: Array<{ id: number; label: string; completed: boolean; active: boolean }>;
  stats: {
    totalOrders: number;
    revenue: number | null;
    revenueCurrency: string;
    marketplacesActive: number;
    listingScore: number;
    competitorCount: number;
    imageCount: number;
    keywordCount: number;
  };
  aiSuggestions: string[];
  isShopifyImport?: boolean;
  isWooCommerceImport?: boolean;
  referenceUrl?: string | null;
  listingTitle?: string;
  bulletPoints?: string[];
  targetKeywords?: string[];
  descriptionHtml?: string;
  listingPrice?: number | null;
  listingCurrency?: string | null;
};

const WORKFLOW_STEP_LABELS = ["Upload", "Listing", "Graphics", "A+ Content", "Export"];

const SOURCE_TYPE_LABELS: Record<ProductSourceType, string> = {
  listing: "Build Your Brand",
  audit: "Audit Listing",
  graphics: "Create Graphics",
  video: "Create Video",
  ads: "Manage Ads",
};

function deriveSku(productName: string, id: number, prefix?: string): string {
  if (prefix) return `${prefix}-${String(id).padStart(4, "0")}`;
  const parts = productName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase());
  const skuPrefix = parts.join("-") || "PRD";
  return `${skuPrefix}-${String(id).padStart(4, "0")}`;
}

function mapProductStatus(status: string, currentStep: number | null): { status: ProductStatus; label: string } {
  if (status === "complete" || status === "completed") return { status: "active", label: "Active" };
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (status === "draft" && (currentStep ?? 1) > 1) {
    return { status: "in_progress", label: "In progress" };
  }
  if (status === "pending" || status === "generating" || status === "processing") {
    return { status: "in_progress", label: "In progress" };
  }
  return { status: "draft", label: "Draft" };
}

function mapStageLabel(status: string, currentStep: number | null): string {
  if (status === "complete" || status === "completed") return "Live";
  const step = Math.min(5, Math.max(1, currentStep ?? 1));
  if (step >= 5) return "Ready to export";
  return WORKFLOW_STEP_LABELS[step - 1] ?? "Upload";
}

function managerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function calcProgress(status: string, currentStep: number | null): number {
  if (status === "complete" || status === "completed") return 100;
  return Math.min(100, Math.round(((currentStep ?? 1) / 5) * 100));
}

function countImages(row: {
  imageUrls?: string[] | null;
  imageRecords?: unknown[] | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): number {
  const urls = new Set<string>();
  for (const u of row.imageUrls ?? []) {
    if (u?.trim()) urls.add(u.trim());
  }
  for (const rec of row.imageRecords ?? []) {
    const url = (rec as { currentUrl?: string }).currentUrl;
    if (url?.trim()) urls.add(url.trim());
  }
  const g = row.generatedImages;
  if (g) {
    for (const u of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (u?.trim()) urls.add(u.trim());
    }
  }
  return urls.size;
}

function genericWorkflowSteps(
  labels: string[],
  status: string,
): ProductDetailPayload["workflowSteps"] {
  const completed = status === "complete" || status === "completed" || status === "active";
  const inProgress = status === "generating" || status === "processing" || status === "pending";
  return labels.map((label, index) => ({
    id: index + 1,
    label,
    completed: completed || (inProgress && index === 0),
    active: !completed && inProgress && index === (completed ? -1 : inProgress ? 1 : 0),
  }));
}

function genericProgress(status: string): number {
  if (status === "complete" || status === "completed" || status === "active") return 100;
  if (status === "generating" || status === "processing" || status === "pending") return 55;
  if (status === "failed") return 0;
  return 25;
}

async function auditScopeWhere(req: Request, sourceType: "listing" | "audit") {
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const feature = sourceType === "audit" ? "audits" : "build_brand";
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), feature, worked, "audit", auditsTable);
  return and(
    eq(auditsTable.userId, ownerId),
    or(
      eq(auditsTable.workspaceId, workspaceId),
      and(isNull(auditsTable.workspaceId), eq(auditsTable.userId, ownerId)),
    ),
    eq(auditsTable.isDeleted, 0),
    sql`${auditsTable.status} != 'archived'`,
    sourceType === "listing"
      ? auditAsinScopeFilter("listing", auditsTable.asin)
      : auditAsinScopeFilter("audit", auditsTable.asin),
    ownFilter,
  );
}

async function projectScopeWhere(
  req: Request,
  feature: "graphics" | "videos" | "ads",
  table: typeof graphicsProjectsTable | typeof videosProjectsTable | typeof adsProjectsTable,
  type: "graphics" | "video" | "ads",
) {
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), feature, worked, type, table);
  return and(
    workspaceOwnerFilter(table, table, ownerId, workspaceId),
    eq(table.isDeleted, 0),
    ownFilter,
  );
}

async function loadAuditDetail(
  req: Request,
  id: number,
  sourceType: "listing" | "audit",
): Promise<ProductDetailPayload | null> {
  const where = await auditScopeWhere(req, sourceType);
  const [row] = await db.select().from(auditsTable).where(and(where, eq(auditsTable.id, id))).limit(1);
  if (!row) return null;

  const workspaceId = getActiveWorkspaceId(req);

  const competitors = await db
    .select({
      id: competitorsTable.id,
      productName: competitorsTable.productName,
      asin: competitorsTable.asin,
    })
    .from(competitorsTable)
    .where(and(eq(competitorsTable.auditId, id), eq(competitorsTable.isDeleted, 0)));

  const managerUserId = row.createdByUserId ?? row.userId;
  const [managerProfile] = await db
    .select({ fullName: userProfilesTable.fullName, companyName: userProfilesTable.companyName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, managerUserId))
    .limit(1);

  const managerName = managerProfile?.fullName?.trim()
    || managerProfile?.companyName?.trim()
    || "Account Owner";

  const [profile] = await db
    .select()
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, id))
    .limit(1);

  const isShopifyImport = isShopifyImportAsin(row.asin);
  const isWooCommerceImport = isWooCommerceImportAsin(row.asin);
  const isStoreImport = isShopifyImport || isWooCommerceImport;
  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Project";
  const sku = profile?.sku?.trim() || deriveSku(name, row.id, sourceType === "audit" ? "AUD" : undefined);
  const displayManagerName = profile?.assignedManager?.trim() || managerName;
  const mapped = mapProductStatus(row.status, row.currentStep);
  const stageLabel = isShopifyImport
    ? "Imported from Shopify"
    : isWooCommerceImport
      ? "Imported from WooCommerce"
    : sourceType === "audit"
      ? (row.status === "complete" ? "Audit Results" : "Audit in progress")
      : mapStageLabel(row.status, row.currentStep);
  const progress = sourceType === "audit"
    ? (row.status === "complete" ? 100 : row.overallScore ? Math.min(95, row.overallScore) : 40)
    : calcProgress(row.status, row.currentStep);
  const workflowUrl = sourceType === "audit"
    ? `/audits/${row.id}`
    : `/audits/workflow?resume=${row.id}`;

  const marketplaceStats = await listProductMarketplaces(id);

  const shopifyListing = marketplaceStats.listings.find((listing) => listing.marketplace === "Shopify");
  const wooListing = marketplaceStats.listings.find((listing) => listing.marketplace === "WooCommerce");
  const storeListingUrl = profile?.referenceLinks?.trim()
    || wooListing?.listingUrl?.trim()
    || shopifyListing?.listingUrl?.trim()
    || null;

  const refreshedUrls = await maybeRefreshStoreProductImages({
    auditId: id,
    workspaceId,
    asin: row.asin,
    imageUrls: row.imageUrls as string[] | null,
    listingUrl: storeListingUrl,
  });
  if (refreshedUrls) {
    row.imageUrls = refreshedUrls;
  }

  if (isWooCommerceImport) {
    const listingRefreshed = await maybeRefreshStoreProductListing({
      auditId: id,
      workspaceId,
      asin: row.asin,
    });
    if (listingRefreshed) {
      const refreshedRow = await reloadAuditRow(id);
      if (refreshedRow) {
        Object.assign(row, refreshedRow);
      }
    }
  }

  const referenceLinks: Array<{ label: string; url: string }> = [];
  if (isShopifyImport) {
    const shopifyUrl = profile?.referenceLinks?.trim() || shopifyListing?.listingUrl?.trim();
    if (shopifyUrl) {
      referenceLinks.push({
        label: "Shopify",
        url: shopifyUrl,
      });
    }
  } else if (isWooCommerceImport) {
    const wooUrl = profile?.referenceLinks?.trim() || wooListing?.listingUrl?.trim();
    if (wooUrl) {
      referenceLinks.push({
        label: "WooCommerce",
        url: wooUrl,
      });
    }
  } else if (row.asin?.trim()) {
    referenceLinks.push({
      label: "Amazon Ref",
      url: `https://www.amazon.in/dp/${row.asin.trim()}`,
    });
  }
  competitors.forEach((c, i) => {
    const label = c.productName?.trim() || `Competitor ${String.fromCharCode(65 + i)}`;
    const competitorAsin = c.asin?.trim();
    const url = competitorAsin && !isShopifyImportAsin(competitorAsin) && !isWooCommerceImportAsin(competitorAsin)
      ? `https://www.amazon.in/dp/${competitorAsin}`
      : "#";
    referenceLinks.push({ label, url });
  });

  const brand = row.brandName?.trim() || "Brand";
  const aiSuggestions = buildProductSuggestions({
    productName: row.productName,
    title: row.title,
    brandName: row.brandName,
    category: row.category,
    bulletPoints: row.bulletPoints,
    generatedContent: row.generatedContent as ProductSuggestionInput["generatedContent"],
    targetKeywords: row.targetKeywords,
    imageUrls: row.imageUrls,
    imageRecords: row.imageRecords as ProductSuggestionInput["imageRecords"],
    generatedImages: row.generatedImages as ProductSuggestionInput["generatedImages"],
    currentStep: row.currentStep,
    status: row.status,
    overallScore: row.overallScore,
    result: row.result,
    competitorCount: competitors.length,
  });

  const priority = priorityFromStoredLevel(profile?.priority)
    ?? mapProductPriority({
      overallScore: row.overallScore,
      status: row.status,
      currentStep: row.currentStep,
      aiSuggestionCount: aiSuggestions.length,
    });

  const orderStats = await getProductOrderStats(id);
  const revenueCurrency = resolveRevenueCurrency({
    orderCurrency: orderStats.currency,
    listingCurrencies: marketplaceStats.listings.map((listing) => listing.currency),
  });
  const storeLive = marketplaceStats.listings.some(
    (listing) => (listing.marketplace === "Shopify" || listing.marketplace === "WooCommerce")
      && listing.status === "live",
  );
  const displayStatus = storeLive ? "active" as const : mapped.status;
  const displayStatusLabel = storeLive ? "Live" : (mapped.status === "active" ? "Live" : mapped.label);
  const effectiveSourceType = isStoreImport ? "listing" : sourceType;
  const storeReferenceUrl = isShopifyImport
    ? (profile?.referenceLinks?.trim()
      || marketplaceStats.listings.find((l) => l.marketplace === "Shopify")?.listingUrl?.trim()
      || null)
    : isWooCommerceImport
      ? (profile?.referenceLinks?.trim()
        || marketplaceStats.listings.find((l) => l.marketplace === "WooCommerce")?.listingUrl?.trim()
        || null)
      : null;
  const amazonListing = marketplaceStats.listings.find((listing) => listing.marketplace === "Amazon");
  const storeListing = shopifyListing ?? wooListing;
  const generated = readGeneratedContent(row);
  const listingBullets = (row.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const listingKeywords = (row.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const bulletPoints = isWooCommerceImport
    ? []
    : listingBullets.length > 0
      ? listingBullets
      : (generated?.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const targetKeywords = isWooCommerceImport
    ? filterTokenizedWooCommerceKeywords(
      listingKeywords,
      row.storeDescriptionHtml?.trim() || resolveDescriptionHtml(row),
    )
    : listingKeywords.length > 0
      ? listingKeywords
      : (generated?.keywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const pricedListing = [shopifyListing, wooListing, amazonListing].find(
    (listing) => listing?.price != null && listing.price > 0,
  );
  const listingPrice = pricedListing?.price ?? null;
  const imageUrls = (row.imageUrls as string[] ?? [])
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean)
    .slice(0, 9);

  return {
    id: row.id,
    name,
    title: row.title?.trim() || name,
    sku,
    imageUrl: pickProjectThumbnail({
      imageUrls: row.imageUrls,
      imageRecords: row.imageRecords as Array<{ currentUrl?: string }> | null,
      generatedImages: row.generatedImages as ProductSuggestionInput["generatedImages"],
    }),
    imageUrls,
    brandName: row.brandName ?? null,
    category: row.category ?? null,
    status: displayStatus,
    statusLabel: displayStatusLabel,
    stageLabel,
    priorityLabel: priority.label,
    priorityLevel: priority.level,
    progressPercent: progress,
    currentStep: row.currentStep ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    workflowUrl: isStoreImport ? `/audits/workflow?resume=${row.id}` : workflowUrl,
    detailUrl: `/products/${row.id}?source=${effectiveSourceType}`,
    sourceType: effectiveSourceType,
    sourceTypeLabel: isShopifyImport
      ? "Shopify Import"
      : isWooCommerceImport
        ? "WooCommerce Import"
        : SOURCE_TYPE_LABELS[sourceType],
    isShopifyImport,
    isWooCommerceImport,
    referenceUrl: storeReferenceUrl,
    listingTitle: row.title?.trim() || name,
    bulletPoints,
    targetKeywords,
    descriptionHtml: resolveDescriptionHtml(row),
    listingPrice,
    listingCurrency: pricedListing?.currency ?? storeListing?.currency ?? null,
    statsAuditId: row.id,
    manager: {
      name: displayManagerName,
      initials: managerInitials(displayManagerName),
    },
    referenceLinks,
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: WORKFLOW_STEP_LABELS.map((label, index) => ({
      id: index + 1,
      label,
      completed: (row.currentStep ?? 1) > index + 1 || row.status === "complete",
      active: (row.currentStep ?? 1) === index + 1 && row.status !== "complete",
    })),
    stats: {
      totalOrders: orderStats.totalOrders,
      revenue: orderStats.revenue > 0 ? orderStats.revenue : null,
      revenueCurrency,
      marketplacesActive: marketplaceStats.activeCount,
      listingScore: (row.overallScore ?? 0) > 0 ? row.overallScore! : 0,
      competitorCount: competitors.length,
      imageCount: countImages(row),
      keywordCount: (row.targetKeywords ?? []).length,
    },
    aiSuggestions,
  };
}

async function loadGraphicsDetail(req: Request, id: number): Promise<ProductDetailPayload | null> {
  const where = await projectScopeWhere(req, "graphics", graphicsProjectsTable, "graphics");
  const [row] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(where, eq(graphicsProjectsTable.id, id)))
    .limit(1);
  if (!row) return null;

  const name = row.name?.trim() || row.productName?.trim() || "Untitled Project";
  const mapped = mapProductStatus(row.status, null);
  const workflowUrl = `/projects/${row.id}`;
  const brand = row.productName?.trim() || "Brand";
  const statsAuditId = row.auditId ?? null;

  let stats = {
    totalOrders: 0,
    revenue: null as number | null,
    revenueCurrency: "USD",
    marketplacesActive: 0,
    listingScore: 0,
    competitorCount: 0,
    imageCount: row.generatedCount ?? 0,
    keywordCount: 0,
  };

  if (statsAuditId) {
    const orderStats = await getProductOrderStats(statsAuditId);
    const marketplaceStats = await listProductMarketplaces(statsAuditId);
    const revenueCurrency = resolveRevenueCurrency({
      orderCurrency: orderStats.currency,
      listingCurrencies: marketplaceStats.listings.map((listing) => listing.currency),
    });
    stats = {
      totalOrders: orderStats.totalOrders,
      revenue: orderStats.revenue > 0 ? orderStats.revenue : null,
      revenueCurrency,
      marketplacesActive: marketplaceStats.activeCount,
      listingScore: 0,
      competitorCount: 0,
      imageCount: row.generatedCount ?? 0,
      keywordCount: 0,
    };
  }

  return {
    id: row.id,
    name,
    title: name,
    sku: deriveSku(name, row.id, "GFX"),
    imageUrl: pickProjectThumbnail({
      sourceImageUrls: row.sourceImageUrls,
      imageRecords: row.imageRecords as Array<{ currentUrl?: string }> | null,
    }),
    brandName: brand,
    category: row.category ?? null,
    status: mapped.status,
    statusLabel: mapped.label,
    stageLabel: row.status === "completed" ? "Graphics ready" : "Graphics",
    priorityLabel: "Medium Priority",
    priorityLevel: "medium",
    progressPercent: genericProgress(row.status),
    currentStep: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    workflowUrl,
    detailUrl: `/products/${row.id}?source=graphics`,
    sourceType: "graphics",
    sourceTypeLabel: SOURCE_TYPE_LABELS.graphics,
    statsAuditId,
    manager: { name: "Account Owner", initials: "AO" },
    referenceLinks: [],
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: genericWorkflowSteps(
      ["Upload assets", "Generate graphics", "Customize", "Download"],
      row.status,
    ),
    stats,
    aiSuggestions: [
      "Generate lifestyle and infographic images in the Graphics workflow",
      "Use consistent brand colors across all generated visuals",
      "Add more source images for better AI output quality",
    ],
  };
}

async function loadVideoDetail(req: Request, id: number): Promise<ProductDetailPayload | null> {
  const where = await projectScopeWhere(req, "videos", videosProjectsTable, "video");
  const [row] = await db
    .select()
    .from(videosProjectsTable)
    .where(and(where, eq(videosProjectsTable.id, id)))
    .limit(1);
  if (!row) return null;

  const name = row.name?.trim() || row.productName?.trim() || "Untitled Video";
  const mapped = mapProductStatus(row.status, null);
  const workflowUrl = `/videos`;
  const brand = row.productName?.trim() || "Brand";

  return {
    id: row.id,
    name,
    title: name,
    sku: deriveSku(name, row.id, "VID"),
    imageUrl: pickProjectThumbnail({ thumbnailUrl: row.thumbnailUrl }),
    brandName: brand,
    category: row.category ?? null,
    status: mapped.status,
    statusLabel: mapped.label,
    stageLabel: row.status === "completed" ? "Video ready" : "Video production",
    priorityLabel: "Medium Priority",
    priorityLevel: "medium",
    progressPercent: genericProgress(row.status),
    currentStep: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    workflowUrl,
    detailUrl: `/products/${row.id}?source=video`,
    sourceType: "video",
    sourceTypeLabel: SOURCE_TYPE_LABELS.video,
    statsAuditId: row.auditId ?? null,
    manager: { name: "Account Owner", initials: "AO" },
    referenceLinks: [],
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: genericWorkflowSteps(
      ["Add product", "AI generates", "Customize", "Download"],
      row.status,
    ),
    stats: {
      totalOrders: 0,
      revenue: null,
      revenueCurrency: "USD",
      marketplacesActive: 0,
      listingScore: 0,
      competitorCount: 0,
      imageCount: row.thumbnailUrl ? 1 : 0,
      keywordCount: 0,
    },
    aiSuggestions: [
      "Choose a video style that matches your Amazon listing tone",
      "Add high-quality product images before generating the video",
      "Review script and scenes before final export",
    ],
  };
}

async function loadAdsDetail(req: Request, id: number): Promise<ProductDetailPayload | null> {
  const where = await projectScopeWhere(req, "ads", adsProjectsTable, "ads");
  const [row] = await db
    .select()
    .from(adsProjectsTable)
    .where(and(where, eq(adsProjectsTable.id, id)))
    .limit(1);
  if (!row) return null;

  const name = row.name?.trim() || row.productName?.trim() || "Untitled Campaign";
  const mapped = mapProductStatus(row.status, null);
  const workflowUrl = `/ads`;
  const brand = row.productName?.trim() || "Brand";

  return {
    id: row.id,
    name,
    title: name,
    sku: deriveSku(name, row.id, "ADS"),
    imageUrl: null,
    brandName: brand,
    category: row.category ?? null,
    status: mapped.status,
    statusLabel: mapped.label,
    stageLabel: row.status === "active" ? "Campaign live" : "Campaign setup",
    priorityLabel: "High Priority",
    priorityLevel: "high",
    progressPercent: genericProgress(row.status),
    currentStep: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    workflowUrl,
    detailUrl: `/products/${row.id}?source=ads`,
    sourceType: "ads",
    sourceTypeLabel: SOURCE_TYPE_LABELS.ads,
    statsAuditId: row.auditId ?? null,
    manager: { name: "Account Owner", initials: "AO" },
    referenceLinks: row.platform
      ? [{ label: row.platform, url: "#" }]
      : [],
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: genericWorkflowSteps(
      ["Set targeting", "Create creatives", "Launch campaign", "Optimize"],
      row.status,
    ),
    stats: {
      totalOrders: 0,
      revenue: null,
      revenueCurrency: "USD",
      marketplacesActive: row.platform ? 1 : 0,
      listingScore: 0,
      competitorCount: 0,
      imageCount: Array.isArray(row.creativeUrls) ? row.creativeUrls.length : 0,
      keywordCount: Array.isArray(row.targeting) ? row.targeting.length : 0,
    },
    aiSuggestions: [
      "Review ACOS and ROAS weekly to reduce wasted ad spend",
      "Test multiple ad creatives to find top performers",
      "Align campaign keywords with your listing search terms",
    ],
  };
}

export async function loadProductDetail(
  req: Request,
  id: number,
  sourceType?: ProductSourceType | null,
): Promise<ProductDetailPayload | null> {
  if (sourceType) {
    const direct = await loadProductDetailBySource(req, id, sourceType);
    if (direct) return direct;
  }

  for (const candidate of PRODUCT_SOURCE_TRY_ORDER) {
    if (candidate === sourceType) continue;
    const detail = await loadProductDetailBySource(req, id, candidate);
    if (detail) return detail;
  }
  return null;
}

async function loadProductDetailBySource(
  req: Request,
  id: number,
  sourceType: ProductSourceType,
): Promise<ProductDetailPayload | null> {
  switch (sourceType) {
    case "listing":
    case "audit":
      return loadAuditDetail(req, id, sourceType);
    case "graphics":
      return loadGraphicsDetail(req, id);
    case "video":
      return loadVideoDetail(req, id);
    case "ads":
      return loadAdsDetail(req, id);
    default:
      return null;
  }
}

export async function resolveStatsAuditId(
  req: Request,
  id: number,
  sourceType?: ProductSourceType | null,
): Promise<number | null> {
  const parsed = sourceType ?? parseProductSourceType(
    typeof req.query.source === "string" ? req.query.source : null,
  );
  const detail = await loadProductDetail(req, id, parsed ?? undefined);
  return detail?.statsAuditId ?? null;
}

export function parseProductSourceFromRequest(req: Request): ProductSourceType | null {
  return parseProductSourceType(typeof req.query.source === "string" ? req.query.source : null);
}
