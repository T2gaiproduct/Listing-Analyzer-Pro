import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable } from "@workspace/db";

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

  for (const ws of workspaces) {
    const [existing] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, ws.id),
        eq(workspaceMembersTable.userId, input.memberUserId),
      ))
      .limit(1);

    if (existing) {
      await db.update(workspaceMembersTable)
        .set({
          status: "active",
          roleId: input.roleId,
          ...(input.legacyRole ? { legacyRole: input.legacyRole } : {}),
          acceptedAt: new Date(),
          isDeleted: 0,
          deletedAt: null,
        })
        .where(eq(workspaceMembersTable.id, existing.id));
      continue;
    }

    await db.insert(workspaceMembersTable).values({
      workspaceId: ws.id,
      userId: input.memberUserId,
      invitedEmail: input.invitedEmail.toLowerCase(),
      invitedName: input.invitedName,
      roleId: input.roleId,
      legacyRole: input.legacyRole ?? "editor",
      status: "active",
      inviteToken: randomBytes(32).toString("hex"),
      acceptedAt: new Date(),
    });
  }
}
