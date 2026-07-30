import { eq, and } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceRolesTable,
  workspaceMembersTable,
} from "@workspace/db";
import {
  type WorkspaceRolePermissions,
  type WorkspaceLegacyRole,
  ownerPermissions,
  legacyRolePermissions,
  hasWorkspacePermission,
  canViewInWorkspace,
  canWriteInWorkspace,
} from "@workspace/workspace-permissions";
import { resolveTeamContext, type TeamContext } from "../middlewares/team-auth";
import { getDefaultWorkspaceId, ensureWorkspacesMigrated } from "./ensure-workspaces";
import { ensureAccountRolesMigrated } from "./ensure-account-roles";

export interface WorkspaceContext {
  workspaceId: number;
  workspaceName: string;
  accountOwnerId: string;
  isAccountOwner: boolean;
  memberId?: number;
  roleId?: number | null;
  roleName?: string | null;
  permissions: WorkspaceRolePermissions;
  legacyRole?: WorkspaceLegacyRole | "owner";
  preserveLegacyPermissions: boolean;
  useLegacy: boolean;
  team: TeamContext;
}

export const WORKSPACE_HEADER = "x-workspace-id";

export async function resolveAccountOwnerId(userId: string): Promise<string> {
  const team = await resolveTeamContext(userId);
  return team.ownerUserId;
}

export async function listAccessibleWorkspaces(userId: string): Promise<Array<{
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  isAccountOwner: boolean;
  roleName: string | null;
}>> {
  await ensureWorkspacesMigrated();
  await ensureAccountRolesMigrated();

  const owned = await db
    .select()
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, userId), eq(workspacesTable.isDeleted, 0)));

  const ownedSummaries = owned.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    clientLabel: w.clientLabel,
    isDefault: w.isDefault,
    isAccountOwner: true,
    roleName: "Owner",
  }));

  const memberships = await db
    .select({
      workspace: workspacesTable,
      roleName: workspaceRolesTable.name,
      legacyRole: workspaceMembersTable.legacyRole,
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

  const memberSummaries = memberships
    .filter((m) => m.workspace.accountOwnerId !== userId)
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      description: m.workspace.description,
      clientLabel: m.workspace.clientLabel,
      isDefault: m.workspace.isDefault,
      isAccountOwner: false,
      roleName: m.roleName ?? m.legacyRole ?? "Member",
    }));

  return [...ownedSummaries, ...memberSummaries];
}

export async function resolveWorkspaceContext(
  userId: string,
  workspaceIdRaw: string | number | undefined,
): Promise<WorkspaceContext | null> {
  await ensureWorkspacesMigrated();
  await ensureAccountRolesMigrated();
  const team = await resolveTeamContext(userId);
  const accountOwnerId = team.ownerUserId;

  let workspaceId = Number(workspaceIdRaw);
  const explicitWorkspaceId = Boolean(workspaceIdRaw && !Number.isNaN(workspaceId));
  if (!workspaceId || Number.isNaN(workspaceId)) {
    const defaultId = await getDefaultWorkspaceId(accountOwnerId);
    if (!defaultId) return null;
    workspaceId = defaultId;
  }

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(and(eq(workspacesTable.id, workspaceId), eq(workspacesTable.isDeleted, 0)))
    .limit(1);

  if (!workspace) {
    // Client may still send a deleted/stale workspace id (e.g. right after delete).
    if (explicitWorkspaceId) {
      const defaultId = await getDefaultWorkspaceId(accountOwnerId);
      if (defaultId && defaultId !== workspaceId) {
        return resolveWorkspaceContext(userId, defaultId);
      }
    }
    return null;
  }

  const isAccountOwner = workspace.accountOwnerId === userId;

  if (isAccountOwner || (team.isTeamMember && workspace.accountOwnerId === accountOwnerId)) {
    // account owner or legacy team member on owner's workspaces
  } else {
    const [membership] = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
        eq(workspaceMembersTable.status, "active"),
        eq(workspaceMembersTable.isDeleted, 0),
      ))
      .limit(1);
    if (!membership) return null;
  }

  if (isAccountOwner) {
    return {
      workspaceId,
      workspaceName: workspace.name,
      accountOwnerId: workspace.accountOwnerId,
      isAccountOwner: true,
      permissions: ownerPermissions(),
      legacyRole: "owner",
      preserveLegacyPermissions: workspace.preserveLegacyPermissions,
      useLegacy: false,
      team,
    };
  }

  const [membership] = await db
    .select({
      member: workspaceMembersTable,
      role: workspaceRolesTable,
    })
    .from(workspaceMembersTable)
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.userId, userId),
      eq(workspaceMembersTable.status, "active"),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .limit(1);

  if (!membership) {
    // Legacy team member without workspace_members row — use team role on default workspace only
    if (team.isTeamMember && workspace.isDefault) {
      const legacyRole = team.role as WorkspaceLegacyRole;
      const useLegacy = workspace.preserveLegacyPermissions;
      return {
        workspaceId,
        workspaceName: workspace.name,
        accountOwnerId: workspace.accountOwnerId,
        isAccountOwner: false,
        memberId: team.memberId,
        permissions: useLegacy ? legacyRolePermissions(legacyRole) : legacyRolePermissions(legacyRole),
        legacyRole,
        preserveLegacyPermissions: workspace.preserveLegacyPermissions,
        useLegacy,
        team,
      };
    }
    return null;
  }

  const legacyRole = (membership.member.legacyRole ?? membership.role?.legacyRoleKey ?? team.role) as WorkspaceLegacyRole;
  const useLegacy = workspace.preserveLegacyPermissions && Boolean(membership.member.legacyRole || membership.role?.legacyRoleKey);

  const permissions = useLegacy
    ? legacyRolePermissions(legacyRole)
    : (membership.role?.permissions ?? legacyRolePermissions(legacyRole));

  return {
    workspaceId,
    workspaceName: workspace.name,
    accountOwnerId: workspace.accountOwnerId,
    isAccountOwner: false,
    memberId: membership.member.id,
    roleId: membership.member.roleId,
    roleName: membership.role?.name ?? null,
    permissions,
    legacyRole,
    preserveLegacyPermissions: workspace.preserveLegacyPermissions,
    useLegacy,
    team,
  };
}

export function workspacePermOpts(ctx: WorkspaceContext) {
  return {
    legacyRole: ctx.legacyRole,
    useLegacy: ctx.useLegacy,
  };
}

export function requireWorkspacePerm(
  ctx: WorkspaceContext,
  feature: Parameters<typeof hasWorkspacePermission>[1],
  action: Parameters<typeof hasWorkspacePermission>[2],
): boolean {
  if (ctx.isAccountOwner) return true;
  return hasWorkspacePermission(ctx.permissions, feature, action, workspacePermOpts(ctx));
}

export { hasWorkspacePermission, canViewInWorkspace, canWriteInWorkspace };
