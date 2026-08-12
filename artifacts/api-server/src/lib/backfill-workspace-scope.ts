import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
} from "@workspace/db";

/** Assign legacy rows with null workspace_id to the active workspace so they stay visible. */
export async function backfillWorkspaceScopeForOwner(
  ownerUserId: string,
  workspaceId: number,
): Promise<void> {
  const ownerMatch = eq(auditsTable.userId, ownerUserId);
  const nullWorkspace = isNull(auditsTable.workspaceId);

  await db.update(auditsTable)
    .set({ workspaceId, updatedAt: new Date() })
    .where(and(ownerMatch, nullWorkspace, eq(auditsTable.isDeleted, 0)));

  await db.update(graphicsProjectsTable)
    .set({ workspaceId, updatedAt: new Date() })
    .where(and(
      eq(graphicsProjectsTable.userId, ownerUserId),
      isNull(graphicsProjectsTable.workspaceId),
      eq(graphicsProjectsTable.isDeleted, 0),
    ));

  await db.update(videosProjectsTable)
    .set({ workspaceId, updatedAt: new Date() })
    .where(and(
      eq(videosProjectsTable.userId, ownerUserId),
      isNull(videosProjectsTable.workspaceId),
      eq(videosProjectsTable.isDeleted, 0),
    ));

  await db.update(adsProjectsTable)
    .set({ workspaceId, updatedAt: new Date() })
    .where(and(
      eq(adsProjectsTable.userId, ownerUserId),
      isNull(adsProjectsTable.workspaceId),
      eq(adsProjectsTable.isDeleted, 0),
    ));
}
