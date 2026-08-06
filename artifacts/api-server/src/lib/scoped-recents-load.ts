import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
} from "@workspace/db";
import { workspaceOwnerFilter } from "./workspace-route-helpers";
import { getMemberWorkedProjects } from "./member-projects";
import type { TeamAuthedRequest } from "../middlewares/team-auth";

function isUsableImageUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  return true;
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
) {
  const isMember = team.isTeamMember;
  const worked = isMember ? await getMemberWorkedProjects(memberUserId, team) : null;

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
              workspaceOwnerFilter(auditsTable, auditsTable, ownerUserId, workspaceId),
              eq(auditsTable.isDeleted, 0),
              sql`${auditsTable.status} != 'archived'`,
              ...(isMember ? [inArray(auditsTable.id, auditIds)] : []),
            ),
          )
          .orderBy(desc(auditsTable.updatedAt))
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
          .orderBy(desc(graphicsProjectsTable.updatedAt))
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
          .orderBy(desc(videosProjectsTable.updatedAt))
          .limit(limit),
    isMember && adsIds.length === 0
      ? Promise.resolve([])
      : db
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
              workspaceOwnerFilter(adsProjectsTable, adsProjectsTable, ownerUserId, workspaceId),
              eq(adsProjectsTable.isDeleted, 0),
              sql`${adsProjectsTable.status} != 'archived'`,
              ...(isMember ? [inArray(adsProjectsTable.id, adsIds)] : []),
            ),
          )
          .orderBy(desc(adsProjectsTable.updatedAt))
          .limit(limit),
  ]);

  return { audits, graphics, videos, ads, worked };
}
