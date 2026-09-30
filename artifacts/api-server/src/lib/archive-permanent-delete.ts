import { and, eq, or, type SQL } from "drizzle-orm";
import {
  db,
  auditsTable,
  competitorsTable,
  graphicsProjectsTable,
  teamMembersTable,
  videosProjectsTable,
  adsProjectsTable,
  workspacesTable,
  workspaceMembersTable,
} from "@workspace/db";
import { returnWorkspaceCreditsToAccountOnArchive } from "./workspace-credits.js";
import { createNotification } from "./notifications.js";
import { archiveRetentionPolicySummary } from "./archive-retention.js";

export type ArchivePermanentDeleteType =
  | "audit"
  | "project"
  | "video"
  | "ad"
  | "competitor"
  | "teamMember"
  | "workspace";

export type ArchivePermanentDeleteContext = {
  ownerId: string;
  admin?: boolean;
  wsClause?: (col: { workspaceId: unknown }) => SQL | undefined;
  /** Clerk user to notify (defaults to ownerId). */
  notifyUserId?: string;
  /** When false, skip in-app/email (caller handles). */
  notify?: boolean;
  /** retention = automatic purge after 30 days */
  source?: "manual" | "retention";
};

function scopedAnd(...clauses: (SQL | undefined)[]): SQL {
  const defined = clauses.filter((c): c is SQL => c != null);
  return defined.length === 1 ? defined[0]! : and(...defined)!;
}

const archivedProjectCond = {
  audit: or(eq(auditsTable.isDeleted, 1), eq(auditsTable.status, "archived")),
  graphics: or(eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.status, "archived")),
  video: or(eq(videosProjectsTable.isDeleted, 1), eq(videosProjectsTable.status, "archived")),
  ad: or(eq(adsProjectsTable.isDeleted, 1), eq(adsProjectsTable.status, "archived")),
};

export async function permanentlyDeleteArchivedItem(
  type: ArchivePermanentDeleteType,
  id: number,
  ctx: ArchivePermanentDeleteContext,
): Promise<{ ok: true; notifyUserId: string } | { ok: false; error: string; status: number }> {
  const { ownerId, admin = false, wsClause } = ctx;
  const notifyUserId = ctx.notifyUserId ?? ownerId;
  const shouldNotify = ctx.notify !== false;
  const source = ctx.source ?? "manual";

  let result: unknown;
  switch (type) {
    case "audit": {
      const where = admin
        ? scopedAnd(eq(auditsTable.id, id), archivedProjectCond.audit, wsClause?.(auditsTable))
        : scopedAnd(
          eq(auditsTable.id, id),
          archivedProjectCond.audit,
          eq(auditsTable.userId, ownerId),
          wsClause?.(auditsTable),
        );
      const [item] = await db.delete(auditsTable).where(where).returning();
      result = item;
      break;
    }
    case "project": {
      const where = admin
        ? scopedAnd(eq(graphicsProjectsTable.id, id), archivedProjectCond.graphics, wsClause?.(graphicsProjectsTable))
        : scopedAnd(
          eq(graphicsProjectsTable.id, id),
          archivedProjectCond.graphics,
          eq(graphicsProjectsTable.userId, ownerId),
          wsClause?.(graphicsProjectsTable),
        );
      const [item] = await db.delete(graphicsProjectsTable).where(where).returning();
      result = item;
      break;
    }
    case "video": {
      const where = admin
        ? scopedAnd(eq(videosProjectsTable.id, id), archivedProjectCond.video, wsClause?.(videosProjectsTable))
        : scopedAnd(
          eq(videosProjectsTable.id, id),
          archivedProjectCond.video,
          eq(videosProjectsTable.userId, ownerId),
          wsClause?.(videosProjectsTable),
        );
      const [item] = await db.delete(videosProjectsTable).where(where).returning();
      result = item;
      break;
    }
    case "ad": {
      const where = admin
        ? scopedAnd(eq(adsProjectsTable.id, id), archivedProjectCond.ad, wsClause?.(adsProjectsTable))
        : scopedAnd(
          eq(adsProjectsTable.id, id),
          archivedProjectCond.ad,
          eq(adsProjectsTable.userId, ownerId),
          wsClause?.(adsProjectsTable),
        );
      const [item] = await db.delete(adsProjectsTable).where(where).returning();
      result = item;
      break;
    }
    case "competitor": {
      if (admin) {
        const [item] = await db
          .delete(competitorsTable)
          .where(and(eq(competitorsTable.id, id), eq(competitorsTable.isDeleted, 1)))
          .returning();
        result = item;
      } else {
        const rows = await db
          .select({ competitorId: competitorsTable.id })
          .from(competitorsTable)
          .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
          .where(
            scopedAnd(
              eq(competitorsTable.id, id),
              eq(competitorsTable.isDeleted, 1),
              eq(auditsTable.userId, ownerId),
              wsClause?.(auditsTable),
            ),
          );
        if (rows.length === 0) {
          return { ok: false, error: "Item not found", status: 404 };
        }
        const [item] = await db.delete(competitorsTable).where(eq(competitorsTable.id, id)).returning();
        result = item;
      }
      break;
    }
    case "teamMember": {
      const [item] = await db
        .delete(teamMembersTable)
        .where(
          and(
            eq(teamMembersTable.id, id),
            eq(teamMembersTable.isDeleted, 1),
            eq(teamMembersTable.ownerUserId, ownerId),
          ),
        )
        .returning();
      result = item;
      break;
    }
    case "workspace": {
      const [archived] = await db
        .select()
        .from(workspacesTable)
        .where(
          and(
            eq(workspacesTable.id, id),
            eq(workspacesTable.accountOwnerId, ownerId),
            eq(workspacesTable.isDeleted, 1),
          ),
        )
        .limit(1);
      if (!archived) {
        return { ok: false, error: "Item not found", status: 404 };
      }
      try {
        await returnWorkspaceCreditsToAccountOnArchive(ownerId, id);
      } catch (err) {
        console.error("[archive] return workspace credits before permanent delete failed", err);
        return { ok: false, error: "Failed to return workspace credits to your account", status: 500 };
      }
      await db.delete(workspaceMembersTable).where(eq(workspaceMembersTable.workspaceId, id));
      const [item] = await db.delete(workspacesTable).where(eq(workspacesTable.id, id)).returning();
      result = item;
      break;
    }
    default:
      return { ok: false, error: "Unknown type", status: 400 };
  }

  if (!result) {
    return { ok: false, error: "Item not found", status: 404 };
  }

  if (shouldNotify) {
    const retentionNote =
      source === "retention"
        ? ` ${archiveRetentionPolicySummary()}`
        : "";
    await createNotification({
      userId: notifyUserId,
      type: "project_deleted",
      title: type === "workspace" ? "Workspace permanently deleted" : "Project permanently deleted",
      message:
        source === "retention"
          ? type === "workspace"
            ? `Your workspace was automatically removed from Archive after the retention period.${retentionNote}`
            : `Your ${type} was automatically removed from Archive after the retention period.${retentionNote}`
          : type === "workspace"
            ? "Your workspace was permanently removed from the Archive."
            : `Your ${type} project was permanently removed from the Archive.`,
      link: "/archive",
    });
  }

  return { ok: true, notifyUserId };
}

/** System purge (cron): no workspace scope; row must already be archived. */
export async function permanentlyDeleteArchivedItemForRetention(
  type: ArchivePermanentDeleteType,
  id: number,
  ownerId: string,
): Promise<boolean> {
  const outcome = await permanentlyDeleteArchivedItem(type, id, {
    ownerId,
    admin: true,
    notifyUserId: ownerId,
    source: "retention",
  });
  return outcome.ok;
}
