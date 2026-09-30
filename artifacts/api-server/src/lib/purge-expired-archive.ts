import { and, eq, or, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  competitorsTable,
  graphicsProjectsTable,
  teamMembersTable,
  videosProjectsTable,
  adsProjectsTable,
  workspacesTable,
} from "@workspace/db";
import { archiveRetentionMs } from "./archive-retention.js";
import {
  permanentlyDeleteArchivedItemForRetention,
  type ArchivePermanentDeleteType,
} from "./archive-permanent-delete.js";
import { createNotification } from "./notifications.js";
import { logger } from "./logger.js";

const WARN_DAYS_BEFORE = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function retentionCutoffDate(now = new Date()): Date {
  return new Date(now.getTime() - archiveRetentionMs());
}

function warnWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - archiveRetentionMs() + WARN_DAYS_BEFORE * DAY_MS);
}

function warnWindowEnd(now = new Date()): Date {
  return new Date(now.getTime() - archiveRetentionMs() + (WARN_DAYS_BEFORE + 1) * DAY_MS);
}

export type PurgeExpiredArchiveResult = {
  purged: Record<ArchivePermanentDeleteType, number>;
  warningsSent: number;
  errors: number;
};

async function sendRetentionWarning(
  userId: string,
  label: string,
  daysLeft: number,
): Promise<void> {
  await createNotification({
    userId,
    type: "project_archived",
    title: "Archive item will be deleted soon",
    message: `"${label}" will be permanently deleted in about ${daysLeft} day${daysLeft === 1 ? "" : "s"} unless you restore it from Archive.`,
    link: "/archive",
  });
}

export async function purgeExpiredArchiveItems(now = new Date()): Promise<PurgeExpiredArchiveResult> {
  const cutoff = retentionCutoffDate(now);
  const warnStart = warnWindowStart(now);
  const warnEnd = warnWindowEnd(now);
  const purged: PurgeExpiredArchiveResult["purged"] = {
    audit: 0,
    project: 0,
    video: 0,
    ad: 0,
    competitor: 0,
    teamMember: 0,
    workspace: 0,
  };
  let warningsSent = 0;
  let errors = 0;

  const expiredAudits = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
    })
    .from(auditsTable)
    .where(
      and(
        or(eq(auditsTable.isDeleted, 1), eq(auditsTable.status, "archived")),
        sql`COALESCE(${auditsTable.deletedAt}, ${auditsTable.updatedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredAudits) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("audit", row.id, row.userId);
      if (ok) purged.audit += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "audit", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredProjects = await db
    .select({
      id: graphicsProjectsTable.id,
      userId: graphicsProjectsTable.userId,
      name: graphicsProjectsTable.name,
      productName: graphicsProjectsTable.productName,
    })
    .from(graphicsProjectsTable)
    .where(
      and(
        or(eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.status, "archived")),
        sql`COALESCE(${graphicsProjectsTable.deletedAt}, ${graphicsProjectsTable.updatedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredProjects) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("project", row.id, row.userId);
      if (ok) purged.project += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "project", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredVideos = await db
    .select({ id: videosProjectsTable.id, userId: videosProjectsTable.userId, name: videosProjectsTable.name })
    .from(videosProjectsTable)
    .where(
      and(
        or(eq(videosProjectsTable.isDeleted, 1), eq(videosProjectsTable.status, "archived")),
        sql`COALESCE(${videosProjectsTable.deletedAt}, ${videosProjectsTable.updatedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredVideos) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("video", row.id, row.userId);
      if (ok) purged.video += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "video", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredAds = await db
    .select({ id: adsProjectsTable.id, userId: adsProjectsTable.userId, name: adsProjectsTable.name })
    .from(adsProjectsTable)
    .where(
      and(
        or(eq(adsProjectsTable.isDeleted, 1), eq(adsProjectsTable.status, "archived")),
        sql`COALESCE(${adsProjectsTable.deletedAt}, ${adsProjectsTable.updatedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredAds) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("ad", row.id, row.userId);
      if (ok) purged.ad += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "ad", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredCompetitors = await db
    .select({
      id: competitorsTable.id,
      userId: auditsTable.userId,
    })
    .from(competitorsTable)
    .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
    .where(
      and(
        eq(competitorsTable.isDeleted, 1),
        sql`COALESCE(${competitorsTable.deletedAt}, ${competitorsTable.createdAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredCompetitors) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("competitor", row.id, row.userId);
      if (ok) purged.competitor += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "competitor", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredTeam = await db
    .select({
      id: teamMembersTable.id,
      ownerUserId: teamMembersTable.ownerUserId,
    })
    .from(teamMembersTable)
    .where(
      and(
        eq(teamMembersTable.isDeleted, 1),
        sql`COALESCE(${teamMembersTable.deletedAt}, ${teamMembersTable.invitedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredTeam) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("teamMember", row.id, row.ownerUserId);
      if (ok) purged.teamMember += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "teamMember", id: row.id }, "Archive retention purge failed");
    }
  }

  const expiredWorkspaces = await db
    .select({
      id: workspacesTable.id,
      accountOwnerId: workspacesTable.accountOwnerId,
      name: workspacesTable.name,
    })
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.isDeleted, 1),
        sql`COALESCE(${workspacesTable.deletedAt}, ${workspacesTable.updatedAt}) < ${cutoff}`,
      ),
    );

  for (const row of expiredWorkspaces) {
    try {
      const ok = await permanentlyDeleteArchivedItemForRetention("workspace", row.id, row.accountOwnerId);
      if (ok) purged.workspace += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, type: "workspace", id: row.id }, "Archive retention purge failed");
    }
  }

  // 7-day warning window (in-app + email via createNotification preferences)
  const warnAudits = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
    })
    .from(auditsTable)
    .where(
      and(
        or(eq(auditsTable.isDeleted, 1), eq(auditsTable.status, "archived")),
        sql`COALESCE(${auditsTable.deletedAt}, ${auditsTable.updatedAt}) >= ${warnStart}`,
        sql`COALESCE(${auditsTable.deletedAt}, ${auditsTable.updatedAt}) < ${warnEnd}`,
      ),
    );

  for (const row of warnAudits) {
    try {
      await sendRetentionWarning(row.userId, row.productName ?? `Audit #${row.id}`, WARN_DAYS_BEFORE);
      warningsSent += 1;
    } catch (err) {
      logger.error({ err, id: row.id }, "Archive retention warning failed");
    }
  }

  const warnProjects = await db
    .select({
      id: graphicsProjectsTable.id,
      userId: graphicsProjectsTable.userId,
      name: graphicsProjectsTable.name,
      productName: graphicsProjectsTable.productName,
    })
    .from(graphicsProjectsTable)
    .where(
      and(
        or(eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.status, "archived")),
        sql`COALESCE(${graphicsProjectsTable.deletedAt}, ${graphicsProjectsTable.updatedAt}) >= ${warnStart}`,
        sql`COALESCE(${graphicsProjectsTable.deletedAt}, ${graphicsProjectsTable.updatedAt}) < ${warnEnd}`,
      ),
    );

  for (const row of warnProjects) {
    try {
      const label = row.name ?? row.productName ?? `Project #${row.id}`;
      await sendRetentionWarning(row.userId, label, WARN_DAYS_BEFORE);
      warningsSent += 1;
    } catch (err) {
      logger.error({ err, id: row.id }, "Archive retention warning failed");
    }
  }

  const warnWorkspaces = await db
    .select({
      id: workspacesTable.id,
      accountOwnerId: workspacesTable.accountOwnerId,
      name: workspacesTable.name,
    })
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.isDeleted, 1),
        sql`COALESCE(${workspacesTable.deletedAt}, ${workspacesTable.updatedAt}) >= ${warnStart}`,
        sql`COALESCE(${workspacesTable.deletedAt}, ${workspacesTable.updatedAt}) < ${warnEnd}`,
      ),
    );

  for (const row of warnWorkspaces) {
    try {
      await sendRetentionWarning(row.accountOwnerId, row.name ?? `Workspace #${row.id}`, WARN_DAYS_BEFORE);
      warningsSent += 1;
    } catch (err) {
      logger.error({ err, id: row.id }, "Archive retention warning failed");
    }
  }

  const totalPurged = Object.values(purged).reduce((a, b) => a + b, 0);
  logger.info({ purged, warningsSent, errors, totalPurged, cutoff }, "Archive retention job finished");

  return { purged, warningsSent, errors };
}
