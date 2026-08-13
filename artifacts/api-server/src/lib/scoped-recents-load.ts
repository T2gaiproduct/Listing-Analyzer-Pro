import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
} from "@workspace/db";
import { getMemberWorkedProjects } from "./member-projects";
import type { TeamAuthedRequest } from "../middlewares/team-auth";

function isUsableImageUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  return true;
}

/** Include rows scoped to the workspace plus legacy rows with no workspace_id yet. */
function workspaceScopeFilter(
  ownerColumn: { userId: unknown },
  workspaceColumn: { workspaceId: unknown },
  ownerId: string,
  workspaceId: number,
): SQL {
  return and(
    eq(ownerColumn.userId as never, ownerId),
    or(
      eq(workspaceColumn.workspaceId as never, workspaceId),
      isNull(workspaceColumn.workspaceId as never),
    ),
  )!;
}

function memberIdFilter(
  restrictToWorked: boolean,
  ids: number[],
  idColumn: { id: unknown },
): SQL | undefined {
  if (!restrictToWorked) return undefined;
  if (ids.length === 0) return sql`false`;
  return inArray(idColumn.id as never, ids);
}

export function pickProjectThumbnail(opts: {
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
  if (isUsableImageUrl(opts.thumbnailUrl)) candidates.push(opts.thumbnailUrl.trim());
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
  return candidates[0] ?? null;
}

export async function loadScopedRecents(
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

  const auditIds = worked?.auditIds ?? [];
  const graphicsIds = worked?.graphicsIds ?? [];
  const videoIds = worked?.videoIds ?? [];
  const adsIds = worked?.adsIds ?? [];

  const auditMemberFilter = memberIdFilter(restrictToWorked, auditIds, auditsTable);
  const graphicsMemberFilter = memberIdFilter(restrictToWorked, graphicsIds, graphicsProjectsTable);
  const videoMemberFilter = memberIdFilter(restrictToWorked, videoIds, videosProjectsTable);
  const adsMemberFilter = memberIdFilter(restrictToWorked, adsIds, adsProjectsTable);

  const [audits, graphics, videos, ads] = await Promise.all([
    db
      .select({
        id: auditsTable.id,
        name: auditsTable.projectName,
        productName: auditsTable.productName,
        asin: auditsTable.asin,
        category: auditsTable.category,
        brandName: auditsTable.brandName,
        status: auditsTable.status,
        currentStep: auditsTable.currentStep,
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
          workspaceScopeFilter(auditsTable, auditsTable, ownerUserId, workspaceId),
          eq(auditsTable.isDeleted, 0),
          sql`${auditsTable.status} != 'archived'`,
          auditMemberFilter,
        ),
      )
      .orderBy(desc(auditsTable.updatedAt))
      .limit(limit),
    db
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
          workspaceScopeFilter(graphicsProjectsTable, graphicsProjectsTable, ownerUserId, workspaceId),
          eq(graphicsProjectsTable.isDeleted, 0),
          sql`${graphicsProjectsTable.status} != 'archived'`,
          sql`${graphicsProjectsTable.auditId} IS NULL`,
          graphicsMemberFilter,
        ),
      )
      .orderBy(desc(graphicsProjectsTable.updatedAt))
      .limit(limit),
    db
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
          workspaceScopeFilter(videosProjectsTable, videosProjectsTable, ownerUserId, workspaceId),
          eq(videosProjectsTable.isDeleted, 0),
          sql`${videosProjectsTable.status} != 'archived'`,
          videoMemberFilter,
        ),
      )
      .orderBy(desc(videosProjectsTable.updatedAt))
      .limit(limit),
    db
      .select({
        id: adsProjectsTable.id,
        name: adsProjectsTable.name,
        status: adsProjectsTable.status,
        platform: adsProjectsTable.platform,
        createdAt: adsProjectsTable.createdAt,
        updatedAt: adsProjectsTable.updatedAt,
      })
      .from(adsProjectsTable)
      .where(
        and(
          workspaceScopeFilter(adsProjectsTable, adsProjectsTable, ownerUserId, workspaceId),
          eq(adsProjectsTable.isDeleted, 0),
          sql`${adsProjectsTable.status} != 'archived'`,
          adsMemberFilter,
        ),
      )
      .orderBy(desc(adsProjectsTable.updatedAt))
      .limit(limit),
  ]);

  return { audits, graphics, videos, ads, worked };
}
