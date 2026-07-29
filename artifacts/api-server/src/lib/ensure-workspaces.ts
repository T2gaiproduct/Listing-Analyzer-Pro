import { eq, and, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
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
import { legacyRolePermissions } from "@workspace/workspace-permissions";

const SYSTEM_ROLES = [
  { name: "Viewer", legacyRoleKey: "viewer" },
  { name: "Editor", legacyRoleKey: "editor" },
  { name: "Admin", legacyRoleKey: "admin" },
] as const;

async function ensureSystemRoles(workspaceId: number): Promise<Record<string, number>> {
  const roleIds: Record<string, number> = {};
  for (const def of SYSTEM_ROLES) {
    const [existing] = await db
      .select()
      .from(workspaceRolesTable)
      .where(and(
        eq(workspaceRolesTable.workspaceId, workspaceId),
        eq(workspaceRolesTable.legacyRoleKey, def.legacyRoleKey),
      ))
      .limit(1);

    if (existing) {
      roleIds[def.legacyRoleKey] = existing.id;
      continue;
    }

    const [created] = await db.insert(workspaceRolesTable).values({
      workspaceId,
      name: def.name,
      description: `System ${def.name} role (legacy compatible)`,
      permissions: legacyRolePermissions(def.legacyRoleKey),
      isSystem: true,
      legacyRoleKey: def.legacyRoleKey,
    }).returning();
    roleIds[def.legacyRoleKey] = created!.id;
  }
  return roleIds;
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
    await ensureSystemRoles(existing.id);
    return existing.id;
  }

  const [ws] = await db.insert(workspacesTable).values({
    accountOwnerId,
    name: "Default Workspace",
    description: "Migrated from your original account",
    isDefault: true,
    preserveLegacyPermissions: true,
  }).returning();

  await ensureSystemRoles(ws!.id);
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

async function migrateTeamMembersToWorkspace(accountOwnerId: string, workspaceId: number): Promise<void> {
  const roleIds = await ensureSystemRoles(workspaceId);
  const members = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, accountOwnerId), eq(teamMembersTable.isDeleted, 0)));

  for (const m of members) {
    const legacyRole = (m.role === "admin" || m.role === "editor" || m.role === "viewer") ? m.role : "editor";
    const [existing] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        m.memberUserId
          ? eq(workspaceMembersTable.userId, m.memberUserId)
          : eq(workspaceMembersTable.invitedEmail, m.invitedEmail),
      ))
      .limit(1);

    if (existing) continue;

    await db.insert(workspaceMembersTable).values({
      workspaceId,
      userId: m.memberUserId,
      invitedEmail: m.invitedEmail,
      invitedName: m.invitedName,
      roleId: roleIds[legacyRole],
      legacyRole,
      status: m.status,
      inviteToken: m.inviteToken || `mig_${randomBytes(16).toString("hex")}`,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
    });
  }
}

/**
 * Idempotent migration: one default workspace per account owner, backfill workspace_id on data.
 */
export async function ensureWorkspacesMigrated(): Promise<void> {
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
    const workspaceId = await ensureDefaultWorkspace(accountOwnerId);
    await backfillWorkspaceData(accountOwnerId, workspaceId);
    await migrateTeamMembersToWorkspace(accountOwnerId, workspaceId);
  }
}

export async function getDefaultWorkspaceId(accountOwnerId: string): Promise<number | null> {
  const [ws] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDefault, true),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);
  return ws?.id ?? null;
}
