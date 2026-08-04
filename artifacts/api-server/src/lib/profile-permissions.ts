import { eq, and } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  workspaceRolesTable,
} from "@workspace/db";
import {
  hasWorkspacePermission,
  legacyRolePermissions,
  type WorkspaceLegacyRole,
} from "@workspace/workspace-permissions";

function isLegacyRoleKey(role: string | null | undefined): boolean {
  return role === "admin" || role === "editor" || role === "viewer";
}

function normalizeLegacyRole(role: string | null | undefined): WorkspaceLegacyRole {
  if (isLegacyRoleKey(role)) return role as WorkspaceLegacyRole;
  return "editor";
}

/** Workspace owners may edit profile; pure members need profile edit on at least one workspace role. */
export async function canUserEditOwnProfile(userId: string): Promise<boolean> {
  const owned = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, userId), eq(workspacesTable.isDeleted, 0)));
  if (owned.length > 0) return true;

  const memberships = await db
    .select({
      member: workspaceMembersTable,
      role: workspaceRolesTable,
      preserveLegacyPermissions: workspacesTable.preserveLegacyPermissions,
    })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      eq(workspaceMembersTable.userId, userId),
      eq(workspaceMembersTable.status, "active"),
      eq(workspaceMembersTable.isDeleted, 0),
      eq(workspacesTable.isDeleted, 0),
    ));

  if (memberships.length === 0) return true;

  for (const row of memberships) {
    const legacyRoleKey = row.member.legacyRole ?? row.role?.legacyRoleKey;
    const legacyRole = normalizeLegacyRole(legacyRoleKey);
    const useLegacy = row.preserveLegacyPermissions
      && !row.member.roleId
      && isLegacyRoleKey(legacyRoleKey);
    const permissions = useLegacy
      ? legacyRolePermissions(legacyRole)
      : (row.role?.permissions ?? legacyRolePermissions(legacyRole));
    if (hasWorkspacePermission(permissions, "profile", "edit")) return true;
  }

  return false;
}
