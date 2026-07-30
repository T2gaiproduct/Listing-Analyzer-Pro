import { eq, and, isNull, sql } from "drizzle-orm";
import { db, workspaceRolesTable, workspaceMembersTable, workspacesTable } from "@workspace/db";

let migrated = false;

/**
 * Migrate workspace-scoped roles to account-global roles (one set per account owner).
 */
export async function ensureAccountRolesMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`ALTER TABLE workspace_roles ADD COLUMN IF NOT EXISTS account_owner_id text`);
  await db.execute(sql`ALTER TABLE workspace_roles ALTER COLUMN workspace_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE workspace_roles DROP CONSTRAINT IF EXISTS workspace_roles_workspace_name_uniq`);

  await db.execute(sql`
    UPDATE workspace_roles wr
    SET account_owner_id = w.account_owner_id
    FROM workspaces w
    WHERE wr.workspace_id = w.id
      AND (wr.account_owner_id IS NULL OR wr.account_owner_id = '')
  `);

  const customRoles = await db
    .select()
    .from(workspaceRolesTable)
    .where(eq(workspaceRolesTable.isSystem, false));

  const groups = new Map<string, typeof customRoles>();
  for (const role of customRoles) {
    const accountId = role.accountOwnerId;
    if (!accountId) continue;
    const key = `${accountId}:${role.name.trim().toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(role);
    groups.set(key, list);
  }

  for (const roles of groups.values()) {
    roles.sort((a, b) => a.id - b.id);
    const canonical = roles[0]!;
    for (const dup of roles.slice(1)) {
      await db.update(workspaceMembersTable)
        .set({ roleId: canonical.id })
        .where(eq(workspaceMembersTable.roleId, dup.id));
      await db.delete(workspaceRolesTable).where(eq(workspaceRolesTable.id, dup.id));
    }
    await db.update(workspaceRolesTable)
      .set({ workspaceId: null, accountOwnerId: canonical.accountOwnerId })
      .where(eq(workspaceRolesTable.id, canonical.id));
  }

  migrated = true;
}

export async function ensureTeamMembersRoleId(): Promise<void> {
  await ensureAccountRolesMigrated();
  await db.execute(sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role_id integer`);
}

export async function listAccountRoles(accountOwnerId: string) {
  await ensureAccountRolesMigrated();
  return db
    .select()
    .from(workspaceRolesTable)
    .where(and(
      eq(workspaceRolesTable.accountOwnerId, accountOwnerId),
      eq(workspaceRolesTable.isSystem, false),
      isNull(workspaceRolesTable.workspaceId),
    ))
    .orderBy(workspaceRolesTable.name);
}

export async function getAccountRole(accountOwnerId: string, roleId: number) {
  await ensureAccountRolesMigrated();
  const [role] = await db
    .select()
    .from(workspaceRolesTable)
    .where(and(
      eq(workspaceRolesTable.id, roleId),
      eq(workspaceRolesTable.accountOwnerId, accountOwnerId),
      eq(workspaceRolesTable.isSystem, false),
      isNull(workspaceRolesTable.workspaceId),
    ))
    .limit(1);
  return role ?? null;
}
