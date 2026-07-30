import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable } from "@workspace/db";

function normalizeLegacyRole(role: string | null | undefined): string {
  if (role === "admin" || role === "editor" || role === "viewer") return role;
  return "editor";
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

/** Mirror team membership into workspace_members so granular roles apply on every workspace. */
export async function syncTeamMemberWorkspaceMemberships(input: {
  ownerUserId: string;
  memberUserId: string;
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

  const patch = memberPatch(input);
  const emailLower = input.invitedEmail.toLowerCase();

  for (const ws of workspaces) {
    const [byUser] = await db
      .select({ id: workspaceMembersTable.id })
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        eq(workspaceMembersTable.userId, input.memberUserId),
      ))
      .limit(1);

    if (byUser) {
      await db.update(workspaceMembersTable)
        .set(patch)
        .where(eq(workspaceMembersTable.id, byUser.id));
      continue;
    }

    const [byEmail] = await db
      .select({ id: workspaceMembersTable.id })
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        sql`lower(${workspaceMembersTable.invitedEmail}) = ${emailLower}`,
      ))
      .limit(1);

    if (byEmail) {
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
        .select({ id: workspaceMembersTable.id })
        .from(workspaceMembersTable)
        .where(and(
          eq(workspaceMembersTable.workspaceId, ws.id),
          eq(workspaceMembersTable.userId, input.memberUserId),
        ))
        .limit(1);
      if (!retry) throw err;
      await db.update(workspaceMembersTable)
        .set(patch)
        .where(eq(workspaceMembersTable.id, retry.id));
    }
  }
}
