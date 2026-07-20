import { eq, and } from "drizzle-orm";
import {
  db,
  adminUsersTable,
  adminRolesTable,
  teamMembersTable,
} from "@workspace/db";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface UserAccountRole {
  type: "platform_admin" | "team_member" | "user";
  label: string;
  teamRole?: "admin" | "editor" | "viewer";
  adminRoleName?: string;
}

const TEAM_ROLE_LABELS: Record<string, string> = {
  admin: "Team Admin",
  editor: "Team Editor",
  viewer: "Team Viewer",
};

export async function resolveUserAccountRole(userId: string): Promise<UserAccountRole> {
  const [adminUser] = await db
    .select({ roleId: adminUsersTable.roleId })
    .from(adminUsersTable)
    .where(and(eq(adminUsersTable.userId, userId), eq(adminUsersTable.isDeleted, 0)));

  if (adminUser || ADMIN_USER_IDS.includes(userId)) {
    if (adminUser) {
      const [role] = await db
        .select({ name: adminRolesTable.name })
        .from(adminRolesTable)
        .where(and(eq(adminRolesTable.id, adminUser.roleId), eq(adminRolesTable.isDeleted, 0)));
      const roleName = role?.name ?? "Admin";
      return {
        type: "platform_admin",
        label: roleName,
        adminRoleName: roleName,
      };
    }
    return { type: "platform_admin", label: "Admin", adminRoleName: "Admin" };
  }

  const [membership] = await db
    .select({ role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(and(
      eq(teamMembersTable.memberUserId, userId),
      eq(teamMembersTable.status, "active"),
      eq(teamMembersTable.isDeleted, 0),
    ));

  if (membership) {
    const teamRole = membership.role as "admin" | "editor" | "viewer";
    return {
      type: "team_member",
      label: TEAM_ROLE_LABELS[membership.role] ?? "Team Member",
      teamRole,
    };
  }

  return { type: "user", label: "User" };
}
