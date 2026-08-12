import type { Request } from "express";
import { loadScopedRecents, pickProjectThumbnail } from "./scoped-recents-load";
import { getAccountOwnerId, getActiveWorkspaceId, getWorkspaceCtx } from "./workspace-route-helpers";
import { resolveTeamContext } from "../middlewares/team-auth";
import { requireWorkspacePerm } from "./workspace-context";
import { listLiveChannelsForAudits, loadAuditCatalogExtras } from "./product-marketplaces.js";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export type ProductSourceType = "listing" | "audit" | "graphics" | "video" | "ads";

export type UnifiedProductListItem = {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  channels: string[];
  price: number | null;
  currency: string;
  stock: number | null;
  inStock: boolean | null;
  status: "active" | "in_progress" | "draft" | "failed";
  statusLabel: string;
  workflowUrl: string;
  detailUrl: string;
  sourceType: ProductSourceType;
  sourceTypeLabel: string;
  isShopifyImport: boolean;
  isWooCommerceImport: boolean;
  referenceUrl: string | null;
  auditScore: number | null;
  auditPending: boolean;
  createdAt: Date;
  updatedAt: Date;
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

function sourceTypeLabel(type: ProductSourceType): string {
  switch (type) {
    case "listing": return "Build Your Brand";
    case "audit": return "Audit Listing";
    case "graphics": return "Create Graphics";
    case "video": return "Create Video";
    case "ads": return "Manage Ads";
    default: return "Project";
  }
}

function mapAuditStatus(status: string, currentStep: number | null, hasScore: boolean): {
  status: UnifiedProductListItem["status"];
  label: string;
} {
  if (status === "complete") return { status: "active", label: "Active" };
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (hasScore && status === "pending") return { status: "in_progress", label: "In progress" };
  if (status === "draft" && (currentStep ?? 1) > 1) {
    return { status: "in_progress", label: "In progress" };
  }
  if (status === "pending") return { status: "in_progress", label: "In progress" };
  return { status: "draft", label: "Draft" };
}

function mapGenericStatus(status: string): {
  status: UnifiedProductListItem["status"];
  label: string;
} {
  if (status === "complete" || status === "completed" || status === "active") {
    return { status: "active", label: "Active" };
  }
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (status === "generating" || status === "processing" || status === "pending" || status === "paused") {
    return { status: "in_progress", label: "In progress" };
  }
  return { status: "draft", label: "Draft" };
}

export async function loadUnifiedProductList(
  req: Request & { userId: string },
  limit = 500,
): Promise<UnifiedProductListItem[]> {
  const userId = req.userId;
  const ownerUserId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const team = await resolveTeamContext(userId);
  const wsCtx = getWorkspaceCtx(req);

  const restrictToWorkedProjects = team.isTeamMember
    && !wsCtx.isAccountOwner
    && !requireWorkspacePerm(wsCtx, "build_brand", "viewGlobal")
    && !requireWorkspacePerm(wsCtx, "audits", "viewGlobal");

  const { audits, graphics, videos, ads } = await loadScopedRecents(
    ownerUserId,
    userId,
    team,
    workspaceId,
    limit,
    {
      restrictToWorkedProjects,
      workspaceMemberId: wsCtx.workspaceMemberId,
    },
  );

  const items: UnifiedProductListItem[] = [];

  for (const a of audits) {
    const isShopifyImport = isShopifyImportAsin(a.asin);
    const isWooCommerceImport = isWooCommerceImportAsin(a.asin);
    const isAuditListing = !!a.asin?.trim() && !isShopifyImport && !isWooCommerceImport;
    const sourceType: ProductSourceType = isAuditListing ? "audit" : "listing";
    const name = a.name?.trim() || a.productName?.trim() || "Untitled Project";
    const hasAuditScore = (a.overallScore ?? 0) > 0;
    const mapped = mapAuditStatus(a.status, a.currentStep ?? null, hasAuditScore);
    const workflowUrl = isAuditListing ? `/audits/${a.id}` : `/audits/workflow?resume=${a.id}`;
    const detailUrl = `/products/${a.id}?source=${sourceType}`;

    items.push({
      id: a.id,
      name,
      sku: deriveSku(name, a.id, isAuditListing ? "AUD" : undefined),
      imageUrl: pickProjectThumbnail({
        imageUrls: a.imageUrls,
        imageRecords: a.imageRecords as Array<{ currentUrl?: string }> | null,
        generatedImages: a.generatedImages as {
          main?: string[];
          infographic?: string[];
          lifestyle?: string[];
        } | null,
      }),
      channels: [],
      price: null,
      currency: "INR",
      stock: null,
      inStock: null,
      status: mapped.status,
      statusLabel: mapped.label,
      workflowUrl,
      detailUrl,
      sourceType,
      sourceTypeLabel: isShopifyImport
        ? "Shopify Import"
        : isWooCommerceImport
          ? "WooCommerce Import"
          : sourceTypeLabel(sourceType),
      isShopifyImport,
      isWooCommerceImport,
      referenceUrl: null,
      auditScore: hasAuditScore ? a.overallScore : null,
      auditPending: !hasAuditScore && a.status !== "failed",
      createdAt: a.createdAt,
      updatedAt: a.updatedAt ?? a.createdAt,
    });
  }

  for (const g of graphics) {
    const mapped = mapGenericStatus(g.status);
    items.push({
      id: g.id,
      name: g.name,
      sku: deriveSku(g.name, g.id, "GFX"),
      imageUrl: pickProjectThumbnail({
        sourceImageUrls: g.sourceImageUrls,
        imageRecords: g.imageRecords as Array<{ currentUrl?: string }> | null,
      }),
      channels: [],
      price: null,
      currency: "INR",
      stock: null,
      inStock: null,
      status: mapped.status,
      statusLabel: mapped.label,
      workflowUrl: `/projects/${g.id}`,
      detailUrl: `/products/${g.id}?source=graphics`,
      sourceType: "graphics",
      sourceTypeLabel: sourceTypeLabel("graphics"),
      isShopifyImport: false,
      isWooCommerceImport: false,
      referenceUrl: null,
      auditScore: null,
      auditPending: false,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt ?? g.createdAt,
    });
  }

  for (const v of videos) {
    const mapped = mapGenericStatus(v.status);
    items.push({
      id: v.id,
      name: v.name,
      sku: deriveSku(v.name, v.id, "VID"),
      imageUrl: pickProjectThumbnail({ thumbnailUrl: v.thumbnailUrl }),
      channels: [],
      price: null,
      currency: "INR",
      stock: null,
      inStock: null,
      status: mapped.status,
      statusLabel: mapped.label,
      workflowUrl: `/videos/${v.id}`,
      detailUrl: `/products/${v.id}?source=video`,
      sourceType: "video",
      sourceTypeLabel: sourceTypeLabel("video"),
      isShopifyImport: false,
      isWooCommerceImport: false,
      referenceUrl: null,
      auditScore: null,
      auditPending: false,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt ?? v.createdAt,
    });
  }

  for (const ad of ads) {
    const mapped = mapGenericStatus(ad.status);
    items.push({
      id: ad.id,
      name: ad.name,
      sku: deriveSku(ad.name, ad.id, "ADS"),
      imageUrl: null,
      channels: ad.platform ? [ad.platform] : [],
      price: null,
      currency: "INR",
      stock: null,
      inStock: null,
      status: mapped.status,
      statusLabel: mapped.label,
      workflowUrl: `/ads/${ad.id}`,
      detailUrl: `/products/${ad.id}?source=ads`,
      sourceType: "ads",
      sourceTypeLabel: sourceTypeLabel("ads"),
      isShopifyImport: false,
      isWooCommerceImport: false,
      referenceUrl: null,
      auditScore: null,
      auditPending: false,
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt ?? ad.createdAt,
    });
  }

  const auditItems = items.filter((item) => item.sourceType === "listing" || item.sourceType === "audit");
  if (auditItems.length > 0) {
    const auditIds = auditItems.map((item) => item.id);
    const [channelsByAuditId, catalogExtras] = await Promise.all([
      listLiveChannelsForAudits(auditIds),
      loadAuditCatalogExtras(auditIds),
    ]);

    for (const item of auditItems) {
      item.channels = channelsByAuditId.get(item.id) ?? [];
      const extras = catalogExtras.get(item.id);
      if (extras?.sku) item.sku = extras.sku;
      if (extras?.price != null) item.price = extras.price;
      if (extras?.stock != null) item.stock = extras.stock;
      if (extras?.inStock != null) item.inStock = extras.inStock;
      if (extras?.currency) item.currency = extras.currency;
      if (extras?.isLiveOnShopify) {
        item.status = "active";
        item.statusLabel = "Live";
        if (item.inStock == null) {
          item.inStock = true;
        }
      }
      if (extras?.isShopifyImport) {
        item.isShopifyImport = true;
        item.sourceType = "listing";
        item.sourceTypeLabel = "Shopify Import";
        item.workflowUrl = `/audits/workflow?resume=${item.id}`;
        item.detailUrl = `/products/${item.id}?source=listing`;
      }
      if (extras?.isWooCommerceImport) {
        item.isWooCommerceImport = true;
        item.sourceType = "listing";
        item.sourceTypeLabel = "WooCommerce Import";
        item.workflowUrl = `/audits/workflow?resume=${item.id}`;
        item.detailUrl = `/products/${item.id}?source=listing`;
      }
      if (extras?.referenceUrl) {
        item.referenceUrl = extras.referenceUrl;
      }
    }
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items.slice(0, limit);
}
