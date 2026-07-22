import { eq } from "drizzle-orm";
import { db, adminRolesTable } from "@workspace/db";
import { isSuperAdminRoleName } from "@workspace/admin-permissions";

/** Grant view_dashboard to legacy admin roles created before that permission existed. */
export async function ensureAdminRolePermissions(): Promise<void> {
  const roles = await db
    .select({ id: adminRolesTable.id, name: adminRolesTable.name, permissions: adminRolesTable.permissions })
    .from(adminRolesTable)
    .where(eq(adminRolesTable.isDeleted, 0));

  for (const role of roles) {
    const perms = role.permissions ?? [];
    if (isSuperAdminRoleName(role.name) || perms.includes("*")) continue;
    if (perms.length === 0 || perms.includes("view_dashboard")) continue;

    await db
      .update(adminRolesTable)
      .set({ permissions: [...perms, "view_dashboard"] })
      .where(eq(adminRolesTable.id, role.id));
  }
}
