import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
} from "@workspace/db";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { workspaceOwnerFilter } from "./workspace-route-helpers";
import {
  getMemberWorkedProjects,
  type MemberWorkedProjects,
} from "./member-projects";
import { isShopifyImportAsin } from "./shopify-import-utils.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export function activitySortTime(
  worked: MemberWorkedProjects | null,
  itemType: string,
  id: number,
  createdAt: Date | null,
  updatedAt?: Date | null,
): number {
  if (worked) {
    const dbType = itemType === "listing" ? "audit" : itemType;
    const last = worked.lastActivityAt.get(`${dbType}-${id}`);
    if (last) return last.getTime();
  }
  if (updatedAt) return new Date(updatedAt).getTime();
  return createdAt ? new Date(createdAt).getTime() : 0;
}

export function recentsTypeLabel(type: string): string {
  switch (type) {
    case "audit": return "Audit Results";
    case "listing": return "Build Your Brand";
    case "graphics": return "Create Graphics";
    case "video": return "Create Videos";
    case "ads": return "Manage Ads";
    default: return "Project";
  }
}

export function classifyAuditRecentsItem(a: {
  id: number;
  asin?: string | null;
}): { type: "audit" | "listing"; url: string; typeLabel: string } {
  const isShopifyImport = isShopifyImportAsin(a.asin);
  const isWooCommerceImport = isWooCommerceImportAsin(a.asin);
  const isAuditListing = !!a.asin?.trim() && !isShopifyImport && !isWooCommerceImport;
  const type = isAuditListing ? "audit" as const : "listing" as const;
  return {
    type,
    url: isAuditListing ? `/audits/${a.id}` : `/audits/workflow?resume=${a.id}`,
    typeLabel: isShopifyImport
      ? "Shopify Import"
      : isWooCommerceImport
        ? "WooCommerce Import"
        : recentsTypeLabel(type),
  };
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  return true;
}

function imageUrlPriority(url: string): number {
  if (url.startsWith("/api/images/")) return 100;
  if (url.startsWith("https://")) return 80;
  if (url.startsWith("http://")) return 70;
  if (url.startsWith("/")) return 60;
  if (url.startsWith("data:image/")) return 5;
  if (url.startsWith("blob:")) return 1;
  return 50;
}

export function pickRecentsThumbnail(opts: {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  sourceImageUrls?: string[] | null;
  thumbnailUrl?: string | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): string | null {
  const candidates: string[] = [];

  for (const rec of opts.imageRecords ?? []) {
    if (isUsableImageUrl(rec.currentUrl)) candidates.push(rec.currentUrl.trim());
  }
  for (const url of opts.imageUrls ?? []) {
    if (isUsableImageUrl(url)) candidates.push(url.trim());
  }
  for (const url of opts.sourceImageUrls ?? []) {
    if (isUsableImageUrl(url)) candidates.push(url.trim());
  }
  const generated = opts.generatedImages;
  if (generated) {
    for (const url of [
      ...(generated.main ?? []),
      ...(generated.lifestyle ?? []),
      ...(generated.infographic ?? []),
    ]) {
      if (isUsableImageUrl(url)) candidates.push(url.trim());
    }
  }
  if (isUsableImageUrl(opts.thumbnailUrl)) candidates.push(opts.thumbnailUrl.trim());

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => imageUrlPriority(b) - imageUrlPriority(a));
  return candidates[0] ?? null;
}

export type RecentsScopedData = Awaited<ReturnType<typeof loadRecentsScoped>>;

export async function loadRecentsScoped(
  ownerUserId: string,
  memberUserId: string,
  team: TeamAuthedRequest["team"],
  workspaceId: number,
  limit: number,
  options?: {
    restrictToWorkedProjects?: boolean;
    workspaceMemberId?: number;
  },
) {
  const restrictToWorked = options?.restrictToWorkedProjects ?? team.isTeamMember;
  const worked = restrictToWorked
    ? await getMemberWorkedProjects(memberUserId, team, {
      workspaceId,
      workspaceMemberId: options?.workspaceMemberId,
    })
    : null;
  const isMember = restrictToWorked;

  const auditIds = worked?.auditIds ?? [];
  const graphicsIds = worked?.graphicsIds ?? [];
  const videoIds = worked?.videoIds ?? [];
  const adsIds = worked?.adsIds ?? [];

  const [audits, graphics, videos, ads] = await Promise.all([
    isMember && auditIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: auditsTable.id,
            name: auditsTable.projectName,
            productName: auditsTable.productName,
            asin: auditsTable.asin,
            category: auditsTable.category,
            status: auditsTable.status,
            overallScore: auditsTable.overallScore,
            imageUrls: auditsTable.imageUrls,
            imageRecords: auditsTable.imageRecords,
            generatedImages: auditsTable.generatedImages,
            createdAt: auditsTable.createdAt,
            updatedAt: auditsTable.updatedAt,
          })
          .from(auditsTable)
          .where(
            and(
              workspaceOwnerFilter(auditsTable, auditsTable, ownerUserId, workspaceId),
              eq(auditsTable.isDeleted, 0),
              sql`${auditsTable.status} != 'archived'`,
              ...(isMember ? [inArray(auditsTable.id, auditIds)] : []),
            ),
          )
          .orderBy(desc(auditsTable.createdAt))
          .limit(limit),
    isMember && graphicsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: graphicsProjectsTable.id,
            name: graphicsProjectsTable.name,
            category: graphicsProjectsTable.category,
            status: graphicsProjectsTable.status,
            sourceImageUrls: graphicsProjectsTable.sourceImageUrls,
            imageRecords: graphicsProjectsTable.imageRecords,
            createdAt: graphicsProjectsTable.createdAt,
            updatedAt: graphicsProjectsTable.updatedAt,
          })
          .from(graphicsProjectsTable)
          .where(
            and(
              workspaceOwnerFilter(graphicsProjectsTable, graphicsProjectsTable, ownerUserId, workspaceId),
              eq(graphicsProjectsTable.isDeleted, 0),
              sql`${graphicsProjectsTable.status} != 'archived'`,
              sql`${graphicsProjectsTable.auditId} IS NULL`,
              ...(isMember ? [inArray(graphicsProjectsTable.id, graphicsIds)] : []),
            ),
          )
          .orderBy(desc(graphicsProjectsTable.createdAt))
          .limit(limit),
    isMember && videoIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: videosProjectsTable.id,
            name: videosProjectsTable.name,
            status: videosProjectsTable.status,
            thumbnailUrl: videosProjectsTable.thumbnailUrl,
            createdAt: videosProjectsTable.createdAt,
            updatedAt: videosProjectsTable.updatedAt,
          })
          .from(videosProjectsTable)
          .where(
            and(
              workspaceOwnerFilter(videosProjectsTable, videosProjectsTable, ownerUserId, workspaceId),
              eq(videosProjectsTable.isDeleted, 0),
              sql`${videosProjectsTable.status} != 'archived'`,
              ...(isMember ? [inArray(videosProjectsTable.id, videoIds)] : []),
            ),
          )
          .orderBy(desc(videosProjectsTable.createdAt))
          .limit(limit),
    isMember && adsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: adsProjectsTable.id,
            name: adsProjectsTable.name,
            status: adsProjectsTable.status,
            createdAt: adsProjectsTable.createdAt,
            updatedAt: adsProjectsTable.updatedAt,
          })
          .from(adsProjectsTable)
          .where(
            and(
              workspaceOwnerFilter(adsProjectsTable, adsProjectsTable, ownerUserId, workspaceId),
              eq(adsProjectsTable.isDeleted, 0),
              sql`${adsProjectsTable.status} != 'archived'`,
              ...(isMember ? [inArray(adsProjectsTable.id, adsIds)] : []),
            ),
          )
          .orderBy(desc(adsProjectsTable.createdAt))
          .limit(limit),
  ]);

  return { audits, graphics, videos, ads, worked };
}

export interface RecentsItem {
  type: string;
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  url: string;
  pinned: boolean;
  typeLabel: string;
  category: string | null;
  score: number | null;
  imageUrl: string | null;
}

export function buildRecentsItems(
  data: RecentsScopedData,
  pinnedSet?: Set<string>,
): RecentsItem[] {
  const pins = pinnedSet ?? new Set<string>();

  const items: RecentsItem[] = [
    ...data.audits.map((a) => {
      const classified = classifyAuditRecentsItem(a);
      return {
        type: classified.type,
        id: a.id,
        name: a.name || a.productName || "Untitled Project",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt ?? a.createdAt,
        url: classified.url,
        pinned: pins.has(`audit-${a.id}`),
        typeLabel: classified.typeLabel,
        category: a.category ?? null,
        score: a.overallScore ?? null,
        imageUrl: pickRecentsThumbnail({
          imageUrls: a.imageUrls,
          imageRecords: a.imageRecords,
          generatedImages: a.generatedImages as { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null,
        }),
      };
    }),
    ...data.graphics.map((g) => ({
      type: "graphics" as const,
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt ?? g.createdAt,
      url: `/projects/${g.id}`,
      pinned: pins.has(`graphics-${g.id}`),
      typeLabel: recentsTypeLabel("graphics"),
      category: g.category ?? null,
      score: null,
      imageUrl: pickRecentsThumbnail({ sourceImageUrls: g.sourceImageUrls, imageRecords: g.imageRecords }),
    })),
    ...data.videos.map((v) => ({
      type: "video" as const,
      id: v.id,
      name: v.name,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt ?? v.createdAt,
      url: `/videos/${v.id}`,
      pinned: pins.has(`video-${v.id}`),
      typeLabel: recentsTypeLabel("video"),
      category: null,
      score: null,
      imageUrl: pickRecentsThumbnail({ thumbnailUrl: v.thumbnailUrl }),
    })),
    ...data.ads.map((a) => ({
      type: "ads" as const,
      id: a.id,
      name: a.name,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt ?? a.createdAt,
      url: `/ads/${a.id}`,
      pinned: pins.has(`ads-${a.id}`),
      typeLabel: recentsTypeLabel("ads"),
      category: null,
      score: null,
      imageUrl: null,
    })),
  ];

  return items;
}

export function sortRecentsItems(
  items: RecentsItem[],
  worked: MemberWorkedProjects | null,
  prioritizePinned = true,
): void {
  items.sort((a, b) => {
    if (prioritizePinned && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = activitySortTime(worked, a.type, a.id, a.createdAt, a.updatedAt);
    const bTime = activitySortTime(worked, b.type, b.id, b.createdAt, b.updatedAt);
    return bTime - aTime;
  });
}

export type DashboardRecentProject = {
  type: string;
  id: number;
  name: string;
  typeLabel: string;
  statusLabel: string;
  statusColor: "orange" | "green" | "blue" | "red" | "gray";
  url: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  category: string | null;
};

function auditStatusLabel(status: string, overallScore: number | null): string {
  if (status === "pending" || status === "draft") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "archived") return "Archived";
  if (overallScore != null && overallScore >= 70) return "High Score";
  if (overallScore != null && overallScore < 50) return "Needs Work";
  return "Completed";
}

function projectStatusLabel(type: string, status: string, overallScore?: number | null): string {
  if (type === "audit" || type === "listing") {
    return auditStatusLabel(status, overallScore ?? null);
  }
  if (status === "generating" || status === "processing" || status === "draft") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "completed") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadgeColor(label: string): "orange" | "green" | "blue" | "red" | "gray" {
  if (label === "Needs Work") return "orange";
  if (label === "High Score" || label === "Completed") return "green";
  if (label === "In Progress") return "blue";
  if (label === "Failed") return "red";
  return "gray";
}

export function buildDashboardRecentProjects(
  data: RecentsScopedData,
  limit = 5,
): DashboardRecentProject[] {
  const statusByKey = new Map<string, { status: string; overallScore?: number | null }>();
  for (const a of data.audits) {
    statusByKey.set(`audit-${a.id}`, { status: a.status, overallScore: a.overallScore });
    statusByKey.set(`listing-${a.id}`, { status: a.status, overallScore: a.overallScore });
  }
  for (const g of data.graphics) {
    statusByKey.set(`graphics-${g.id}`, { status: g.status });
  }
  for (const v of data.videos) {
    statusByKey.set(`video-${v.id}`, { status: v.status });
  }
  for (const a of data.ads) {
    statusByKey.set(`ads-${a.id}`, { status: a.status });
  }

  const items = buildRecentsItems(data);
  sortRecentsItems(items, data.worked, false);

  return items.slice(0, limit).map((item) => {
    const statusInfo = statusByKey.get(`${item.type}-${item.id}`);
    const statusLabel = projectStatusLabel(
      item.type,
      statusInfo?.status ?? "completed",
      statusInfo?.overallScore,
    );
    return {
      type: item.type,
      id: item.id,
      name: item.name,
      typeLabel: item.typeLabel,
      statusLabel,
      statusColor: statusBadgeColor(statusLabel),
      url: item.url,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      imageUrl: item.imageUrl,
      category: item.category,
    };
  });
}
