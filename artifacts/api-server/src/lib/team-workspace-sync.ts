import { randomBytes } from "crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable, teamMembersTable } from "@workspace/db";
import { getAccountRole } from "./ensure-account-roles.js";
import { ensureTeamMembersSchema } from "./ensure-workspaces.js";

function normalizeLegacyRole(role: string | null | undefined): string {
  if (role === "admin" || role === "editor" || role === "viewer") return role;
  return "editor";
}

export function isExplicitlyRemovedFromWorkspace(row: {
  status: string;
  isDeleted: number | null;
}): boolean {
  return row.isDeleted === 1 || row.status === "revoked";
}

function memberPatch(input: {
  memberUserId: string;
  invitedEmail: string;
  invitedName: string;
  roleId: number | null;
  legacyRole: string | null;
}) {
  return {
    status: "active" as const,
    userId: input.memberUserId,
    invitedEmail: input.invitedEmail.toLowerCase(),
    invitedName: input.invitedName,
    roleId: input.roleId,
    legacyRole: normalizeLegacyRole(input.legacyRole),
    acceptedAt: new Date(),
    isDeleted: 0,
    deletedAt: null,
  };
}

type TeamMemberSyncInput = {
  ownerUserId: string;
  memberUserId: string;
  invitedEmail: string;
  invitedName: string;
  roleId: number | null;
  legacyRole: string | null;
};

/** Mirror pending team invite into workspace_members (pending) on every workspace. */
export async function syncPendingTeamInviteToWorkspaces(input: {
  ownerUserId: string;
  invitedEmail: string;
  invitedName: string;
  roleId: number | null;
  legacyRole: string | null;
}): Promise<void> {
  const workspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, input.ownerUserId),
      eq(workspacesTable.isDeleted, 0),
    ));

  const emailLower = input.invitedEmail.toLowerCase();
  const legacyRole = normalizeLegacyRole(input.legacyRole);

  for (const ws of workspaces) {
    const [byEmail] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
      ))
      .limit(1);

    if (byEmail) {
      if (byEmail.status === "active" && byEmail.isDeleted === 0) continue;
      if (isExplicitlyRemovedFromWorkspace(byEmail)) continue;
      await db.update(workspaceMembersTable)
        .set({
          invitedName: input.invitedName,
          roleId: input.roleId,
          legacyRole,
          status: "pending",
          userId: null,
          acceptedAt: null,
          inviteToken: randomBytes(32).toString("hex"),
          invitedAt: new Date(),
          isDeleted: 0,
          deletedAt: null,
        })
        .where(eq(workspaceMembersTable.id, byEmail.id));
      continue;
    }

    await db.insert(workspaceMembersTable).values({
      workspaceId: ws.id,
      invitedEmail: emailLower,
      invitedName: input.invitedName,
      roleId: input.roleId,
      legacyRole,
      status: "pending",
      inviteToken: randomBytes(32).toString("hex"),
    });
  }
}

/**
 * Refresh role/status on existing workspace memberships only (no new workspaces).
 * Used on login — does not resurrect members removed from a workspace.
 */
export async function syncTeamMemberWorkspaceMemberships(input: TeamMemberSyncInput): Promise<void> {
  const emailLower = input.invitedEmail.toLowerCase();
  const patch = memberPatch(input);

  const rows = await db
    .select({ member: workspaceMembersTable })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(and(
      eq(workspacesTable.accountOwnerId, input.ownerUserId),
      eq(workspacesTable.isDeleted, 0),
      or(
        eq(workspaceMembersTable.userId, input.memberUserId),
        sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
      ),
    ));

  for (const { member } of rows) {
    if (isExplicitlyRemovedFromWorkspace(member)) continue;
    // Workspace-only invites stay pending until the user accepts the invite link.
    if (member.status === "pending") continue;
    await db.update(workspaceMembersTable)
      .set(patch)
      .where(eq(workspaceMembersTable.id, member.id));
  }
}

/**
 * Account team seat: ensure membership on every workspace (skips workspaces they were removed from).
 */
export async function provisionTeamMemberToAllWorkspaces(input: TeamMemberSyncInput): Promise<void> {
  const workspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, input.ownerUserId),
      eq(workspacesTable.isDeleted, 0),
    ));

  const patch = memberPatch(input);
  const emailLower = input.invitedEmail.toLowerCase();

  for (const ws of workspaces) {
    const [byUser] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        eq(workspaceMembersTable.userId, input.memberUserId),
      ))
      .limit(1);

    if (byUser) {
      if (isExplicitlyRemovedFromWorkspace(byUser)) continue;
      await db.update(workspaceMembersTable)
        .set(patch)
        .where(eq(workspaceMembersTable.id, byUser.id));
      continue;
    }

    const [byEmail] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
      ))
      .limit(1);

    if (byEmail) {
      if (isExplicitlyRemovedFromWorkspace(byEmail)) continue;
      await db.update(workspaceMembersTable)
        .set(patch)
        .where(eq(workspaceMembersTable.id, byEmail.id));
      continue;
    }

    try {
      await db.insert(workspaceMembersTable).values({
        workspaceId: ws.id,
        userId: input.memberUserId,
        invitedEmail: emailLower,
        invitedName: input.invitedName,
        roleId: input.roleId,
        legacyRole: patch.legacyRole,
        status: "active",
        inviteToken: randomBytes(32).toString("hex"),
        acceptedAt: new Date(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("workspace_members_workspace_user_uniq") && !msg.includes("duplicate key")) {
        throw err;
      }
      const [retry] = await db
        .select()
        .from(workspaceMembersTable)
        .where(and(
          eq(workspaceMembersTable.workspaceId, ws.id),
          eq(workspaceMembersTable.userId, input.memberUserId),
        ))
        .limit(1);
      if (!retry) throw err;
      if (isExplicitlyRemovedFromWorkspace(retry)) continue;
      await db.update(workspaceMembersTable)
        .set(patch)
        .where(eq(workspaceMembersTable.id, retry.id));
    }
  }
}

/** After a new workspace is created, add active account team seats to that workspace only. */
export async function syncActiveTeamMembersToWorkspace(
  ownerUserId: string,
  workspaceId: number,
): Promise<void> {
  const members = await db
    .select()
    .from(teamMembersTable)
    .where(and(
      eq(teamMembersTable.ownerUserId, ownerUserId),
      eq(teamMembersTable.status, "active"),
    ));

  for (const tm of members) {
    if (!tm.memberUserId) continue;
    const input: TeamMemberSyncInput = {
      ownerUserId,
      memberUserId: tm.memberUserId,
      invitedEmail: tm.invitedEmail,
      invitedName: tm.invitedName,
      roleId: tm.roleId,
      legacyRole: tm.role,
    };
    const emailLower = tm.invitedEmail.toLowerCase();
    const patch = memberPatch(input);

    const [byUser] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, tm.memberUserId),
      ))
      .limit(1);
    if (byUser) {
      if (isExplicitlyRemovedFromWorkspace(byUser)) continue;
      await db.update(workspaceMembersTable).set(patch).where(eq(workspaceMembersTable.id, byUser.id));
      continue;
    }

    const [byEmail] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
      ))
      .limit(1);
    if (byEmail) {
      if (isExplicitlyRemovedFromWorkspace(byEmail)) continue;
      await db.update(workspaceMembersTable).set(patch).where(eq(workspaceMembersTable.id, byEmail.id));
      continue;
    }

    await db.insert(workspaceMembersTable).values({
      workspaceId,
      userId: tm.memberUserId,
      invitedEmail: emailLower,
      invitedName: tm.invitedName,
      roleId: tm.roleId,
      legacyRole: patch.legacyRole,
      status: "active",
      inviteToken: randomBytes(32).toString("hex"),
      acceptedAt: new Date(),
    });
  }
}

/**
 * Keep team_members.role_id in sync when a role is assigned on workspace_members
 * (account-wide permissions are enforced from the team seat).
 */
export async function syncWorkspaceMemberRoleToTeamSeat(input: {
  ownerUserId: string;
  invitedEmail: string;
  invitedName: string;
  memberUserId: string | null;
  roleId: number | null;
  legacyRole: string | null;
}): Promise<void> {
  await ensureTeamMembersSchema();
  const emailLower = input.invitedEmail.trim().toLowerCase();
  const legacyRole = normalizeLegacyRole(input.legacyRole);

  let roleLabel = legacyRole;
  if (input.roleId != null) {
    const accountRole = await getAccountRole(input.ownerUserId, input.roleId);
    if (accountRole) roleLabel = accountRole.name;
  }

  let existing: typeof teamMembersTable.$inferSelect | undefined;
  if (input.memberUserId) {
    [existing] = await db
      .select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.ownerUserId, input.ownerUserId),
        eq(teamMembersTable.memberUserId, input.memberUserId),
      ))
      .limit(1);
  }
  if (!existing) {
    [existing] = await db
      .select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.ownerUserId, input.ownerUserId),
        sql`lower(${teamMembersTable.invitedEmail}) = ${emailLower}`,
      ))
      .limit(1);
  }

  if (existing) {
    if (existing.status === "revoked") return;
    await db.update(teamMembersTable)
      .set({
        roleId: input.roleId,
        role: roleLabel,
        invitedName: input.invitedName,
        ...(input.memberUserId
          ? {
            memberUserId: input.memberUserId,
            status: "active",
            acceptedAt: existing.acceptedAt ?? new Date(),
          }
          : {}),
      })
      .where(eq(teamMembersTable.id, existing.id));
    return;
  }

  await db.insert(teamMembersTable).values({
    ownerUserId: input.ownerUserId,
    invitedEmail: emailLower,
    invitedName: input.invitedName,
    role: roleLabel,
    roleId: input.roleId,
    status: input.memberUserId ? "active" : "pending",
    memberUserId: input.memberUserId,
    inviteToken: randomBytes(32).toString("hex"),
    acceptedAt: input.memberUserId ? new Date() : null,
  });
}

/** Revoke account team seat when the user has no active workspace memberships left. */
export async function revokeTeamSeatIfNoActiveWorkspaces(
  ownerUserId: string,
  memberUserId: string | null,
  invitedEmail: string,
): Promise<void> {
  await ensureTeamMembersSchema();
  const emailLower = invitedEmail.trim().toLowerCase();

  const membershipConditions = memberUserId
    ? or(
      eq(workspaceMembersTable.userId, memberUserId),
      sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
    )
    : sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(and(
      eq(workspacesTable.accountOwnerId, ownerUserId),
      eq(workspacesTable.isDeleted, 0),
      eq(workspaceMembersTable.isDeleted, 0),
      eq(workspaceMembersTable.status, "active"),
      membershipConditions,
    ));

  if (Number(countRow?.total ?? 0) > 0) return;

  const seatConditions = memberUserId
    ? or(
      eq(teamMembersTable.memberUserId, memberUserId),
      sql`lower(${teamMembersTable.invitedEmail}) = ${emailLower}`,
    )
    : sql`lower(${teamMembersTable.invitedEmail}) = ${emailLower}`;

  await db.update(teamMembersTable)
    .set({
      status: "revoked",
      isDeleted: 1,
      deletedAt: new Date(),
      memberUserId: null,
    })
    .where(and(
      eq(teamMembersTable.ownerUserId, ownerUserId),
      seatConditions,
    ));
}

/** @deprecated Use syncActiveTeamMembersToWorkspace when creating a single workspace. */
export async function syncAllActiveTeamMembersForOwner(ownerUserId: string): Promise<void> {
  const workspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, ownerUserId),
      eq(workspacesTable.isDeleted, 0),
    ));
  for (const ws of workspaces) {
    await syncActiveTeamMembersToWorkspace(ownerUserId, ws.id);
  }
}
