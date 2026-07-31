import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceRolesTable,
  workspaceMembersTable,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
  pinnedProjectsTable,
  subscriptionsTable,
  teamMembersTable,
} from "@workspace/db";
import { ensureTeamMembersRoleId } from "./ensure-account-roles.js";

/** Remove auto-seeded Viewer/Editor/Admin templates; members keep legacyRole fallback. */
async function purgeLegacySystemRoles(): Promise<void> {
  const systemRoles = await db
    .select({ id: workspaceRolesTable.id })
    .from(workspaceRolesTable)
    .where(eq(workspaceRolesTable.isSystem, true));

  for (const role of systemRoles) {
    await db.update(workspaceMembersTable)
      .set({ roleId: null })
      .where(eq(workspaceMembersTable.roleId, role.id));
    await db.delete(workspaceRolesTable).where(eq(workspaceRolesTable.id, role.id));
  }
}

async function hasUnmigratedLegacyData(accountOwnerId: string): Promise<boolean> {
  const unmigratedChecks = await Promise.all([
    db.select({ id: auditsTable.id }).from(auditsTable)
      .where(and(eq(auditsTable.userId, accountOwnerId), isNull(auditsTable.workspaceId))).limit(1),
    db.select({ id: graphicsProjectsTable.id }).from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, accountOwnerId), isNull(graphicsProjectsTable.workspaceId))).limit(1),
    db.select({ id: videosProjectsTable.id }).from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, accountOwnerId), isNull(videosProjectsTable.workspaceId))).limit(1),
    db.select({ id: adsProjectsTable.id }).from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, accountOwnerId), isNull(adsProjectsTable.workspaceId))).limit(1),
    db.select({ id: pinnedProjectsTable.id }).from(pinnedProjectsTable)
      .where(and(eq(pinnedProjectsTable.userId, accountOwnerId), isNull(pinnedProjectsTable.workspaceId))).limit(1),
  ]);

  return unmigratedChecks.some(([row]) => row != null);
}

async function accountNeedsWorkspaceMigration(accountOwnerId: string): Promise<boolean> {
  const [existingWs] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);
  if (existingWs) {
    return hasUnmigratedLegacyData(accountOwnerId);
  }

  // User deleted all workspaces — do not recreate Default Workspace.
  const [everHadWorkspace] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.accountOwnerId, accountOwnerId))
    .limit(1);
  if (everHadWorkspace) return false;

  return hasUnmigratedLegacyData(accountOwnerId);
}

async function ensureDefaultWorkspace(accountOwnerId: string): Promise<number> {
  const [existing] = await db
    .select()
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDefault, true),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [ws] = await db.insert(workspacesTable).values({
    accountOwnerId,
    name: "Default Workspace",
    description: "Migrated from your original account",
    isDefault: true,
    preserveLegacyPermissions: true,
  }).returning();

  return ws!.id;
}

async function backfillWorkspaceData(accountOwnerId: string, workspaceId: number): Promise<void> {
  await db.update(auditsTable)
    .set({ workspaceId })
    .where(and(eq(auditsTable.userId, accountOwnerId), isNull(auditsTable.workspaceId)));

  await db.update(graphicsProjectsTable)
    .set({ workspaceId })
    .where(and(eq(graphicsProjectsTable.userId, accountOwnerId), isNull(graphicsProjectsTable.workspaceId)));

  await db.update(videosProjectsTable)
    .set({ workspaceId })
    .where(and(eq(videosProjectsTable.userId, accountOwnerId), isNull(videosProjectsTable.workspaceId)));

  await db.update(adsProjectsTable)
    .set({ workspaceId })
    .where(and(eq(adsProjectsTable.userId, accountOwnerId), isNull(adsProjectsTable.workspaceId)));

  await db.update(pinnedProjectsTable)
    .set({ workspaceId })
    .where(and(eq(pinnedProjectsTable.userId, accountOwnerId), isNull(pinnedProjectsTable.workspaceId)));
}

const migratedOwners = new Set<string>();
let legacyRolesPurged = false;

/**
 * Idempotent migration: backfill workspace_id on legacy data. New accounts start with no workspace.
 * Team member workspace sync runs on invite accept / workspace list — not here.
 */
export async function ensureWorkspacesMigrated(): Promise<void> {
  if (!legacyRolesPurged) {
    await purgeLegacySystemRoles();
    legacyRolesPurged = true;
  }

  const subs = await db.select({ userId: subscriptionsTable.userId }).from(subscriptionsTable);
  const auditOwners = await db
    .selectDistinct({ userId: auditsTable.userId })
    .from(auditsTable)
    .where(sql`${auditsTable.userId} <> ''`);

  const ownerIds = new Set<string>();
  for (const s of subs) if (s.userId) ownerIds.add(s.userId);
  for (const a of auditOwners) if (a.userId) ownerIds.add(a.userId);

  const teamOwners = await db
    .selectDistinct({ ownerUserId: teamMembersTable.ownerUserId })
    .from(teamMembersTable);
  for (const t of teamOwners) ownerIds.add(t.ownerUserId);

  for (const accountOwnerId of ownerIds) {
    if (migratedOwners.has(accountOwnerId)) continue;
    if (!(await accountNeedsWorkspaceMigration(accountOwnerId))) {
      migratedOwners.add(accountOwnerId);
      continue;
    }
    const workspaceId = await ensureDefaultWorkspace(accountOwnerId);
    await backfillWorkspaceData(accountOwnerId, workspaceId);
    migratedOwners.add(accountOwnerId);
  }
}

/** Ensure team_members.role_id exists before reads that include roleId. */
export async function ensureTeamMembersSchema(): Promise<void> {
  await ensureTeamMembersRoleId();
}

/**
 * New subscribers get a default workspace so dashboard and project flows work on first login.
 * Skips accounts that deleted all workspaces intentionally (any workspace row ever existed).
 */
export async function ensureSubscriberDefaultWorkspace(accountOwnerId: string): Promise<number | null> {
  const [activeWs] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);
  if (activeWs) return activeWs.id;

  const [everHadWorkspace] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.accountOwnerId, accountOwnerId))
    .limit(1);
  if (everHadWorkspace) return null;

  const [sub] = await db
    .select({ status: subscriptionsTable.status })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, accountOwnerId))
    .limit(1);
  if (!sub || sub.status !== "active") return null;

  const [ws] = await db.insert(workspacesTable).values({
    accountOwnerId,
    name: "My Workspace",
    description: null,
    isDefault: true,
    preserveLegacyPermissions: true,
  }).returning();

  return ws!.id;
}

export async function getDefaultWorkspaceId(accountOwnerId: string): Promise<number | null> {
  const [defaultWs] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDefault, true),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);
  if (defaultWs) return defaultWs.id;

  const [firstActive] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .orderBy(workspacesTable.createdAt)
    .limit(1);
  return firstActive?.id ?? null;
}
