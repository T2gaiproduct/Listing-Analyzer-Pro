import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceRolesTable,
  workspaceMembersTable,
  teamMembersTable,
  userProfilesTable,
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
import { displayWorkspaceRoleLabel } from "./role-display.js";
import { getDefaultWorkspaceId, ensureTeamMembersSchema, ensureSubscriberDefaultWorkspace } from "./ensure-workspaces";
import { ensureAccountRolesMigrated, getAccountRole } from "./ensure-account-roles";
import { syncTeamMemberWorkspaceMemberships } from "./team-workspace-sync.js";
import { fetchClerkUserEmailAndName } from "./clerk-user.js";

async function resolveAccountOwnerEmails(ownerIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ownerIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const profiles = await db
    .select({ userId: userProfilesTable.userId, loginEmail: userProfilesTable.loginEmail })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.userId, unique));

  for (const row of profiles) {
    const email = row.loginEmail?.trim();
    if (email) map.set(row.userId, email);
  }

  for (const ownerId of unique) {
    if (map.has(ownerId)) continue;
    const clerk = await fetchClerkUserEmailAndName(ownerId);
    if (clerk?.email) map.set(ownerId, clerk.email);
  }

  return map;
}

function isLegacyRoleKey(role: string | null | undefined): boolean {
  return role === "admin" || role === "editor" || role === "viewer";
}

function normalizeLegacyRole(role: string | null | undefined): WorkspaceLegacyRole {
  if (isLegacyRoleKey(role)) return role as WorkspaceLegacyRole;
  return "editor";
}

export interface WorkspaceContext {
  workspaceId: number;
  workspaceName: string;
  accountOwnerId: string;
  isAccountOwner: boolean;
  isDefault: boolean;
  workspaceMemberId?: number;
  teamMemberId?: number;
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
  accountOwnerEmail?: string | null;
}>> {
  await ensureAccountRolesMigrated();
  await ensureTeamMembersSchema();

  const team = await resolveTeamContext(userId);
  if (!team.isTeamMember) {
    await ensureSubscriberDefaultWorkspace(userId);
  }
  if (team.isTeamMember && team.memberId) {
    const [tm] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, team.memberId))
      .limit(1);
    if (tm?.memberUserId && tm.status === "active") {
      try {
        await syncTeamMemberWorkspaceMemberships({
          ownerUserId: tm.ownerUserId,
          memberUserId: tm.memberUserId,
          invitedEmail: tm.invitedEmail,
          invitedName: tm.invitedName,
          roleId: tm.roleId,
          legacyRole: normalizeLegacyRole(tm.role),
        });
      } catch (syncErr) {
        console.error("[workspaces] team member sync failed", syncErr);
      }
    }
  }

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
      roleId: workspaceMembersTable.roleId,
      roleName: workspaceRolesTable.name,
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
      roleName: displayWorkspaceRoleLabel({ roleId: m.roleId, roleName: m.roleName }),
      ownerId: m.workspace.accountOwnerId,
    }));

  if (team.isTeamMember) {
    let teamSeatRoleName = "Unassigned";
    if (team.memberId) {
      const [tm] = await db
        .select({ roleId: teamMembersTable.roleId })
        .from(teamMembersTable)
        .where(eq(teamMembersTable.id, team.memberId))
        .limit(1);
      if (tm?.roleId) {
        const accountRole = await getAccountRole(team.ownerUserId, tm.roleId);
        teamSeatRoleName = displayWorkspaceRoleLabel({ roleId: tm.roleId, roleName: accountRole?.name });
      }
    }

    const ownerWorkspaces = await db
      .select()
      .from(workspacesTable)
      .where(and(
        eq(workspacesTable.accountOwnerId, team.ownerUserId),
        eq(workspacesTable.isDeleted, 0),
      ));
    const seenIds = new Set(memberSummaries.map((m) => m.id));
    for (const w of ownerWorkspaces) {
      if (seenIds.has(w.id)) continue;
      memberSummaries.push({
        id: w.id,
        name: w.name,
        description: w.description,
        clientLabel: w.clientLabel,
        isDefault: w.isDefault,
        isAccountOwner: false,
        roleName: teamSeatRoleName,
        ownerId: team.ownerUserId,
      });
    }
  }

  const ownerIdsForEmail = memberSummaries.map((m) => m.ownerId);
  const ownerEmails = await resolveAccountOwnerEmails(ownerIdsForEmail);

  const memberSummariesWithEmail = memberSummaries.map(({ ownerId, ...rest }) => ({
    ...rest,
    accountOwnerEmail: ownerEmails.get(ownerId) ?? null,
  }));

  return [...ownedSummaries, ...memberSummariesWithEmail];
}

export async function resolveWorkspaceContext(
  userId: string,
  workspaceIdRaw: string | number | undefined,
): Promise<WorkspaceContext | null> {
  await ensureAccountRolesMigrated();
  await ensureTeamMembersSchema();
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
      isDefault: Boolean(workspace.isDefault),
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
    // Legacy team member without workspace_members row — apply team role on all owner workspaces
    if (team.isTeamMember && workspace.accountOwnerId === accountOwnerId) {
      const [teamMember] = await db
        .select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.memberUserId, userId),
          eq(teamMembersTable.ownerUserId, accountOwnerId),
          eq(teamMembersTable.status, "active"),
        ))
        .limit(1);

      let legacyRole = normalizeLegacyRole(team.role);
      let roleId: number | null = teamMember?.roleId ?? null;
      let roleName: string | null = teamMember?.role ?? null;
      let permissions = legacyRolePermissions(legacyRole);

      if (teamMember?.roleId) {
        const accountRole = await getAccountRole(accountOwnerId, teamMember.roleId);
        if (accountRole) {
          roleId = accountRole.id;
          roleName = accountRole.name;
          legacyRole = normalizeLegacyRole(accountRole.legacyRoleKey ?? legacyRole);
          permissions = accountRole.permissions ?? legacyRolePermissions(legacyRole);
        }
      }

      const useLegacy = workspace.preserveLegacyPermissions && !teamMember?.roleId;
      let workspaceMemberId: number | undefined;
      const [wmRow] = await db
        .select({ id: workspaceMembersTable.id })
        .from(workspaceMembersTable)
        .where(and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.status, "active"),
          eq(workspaceMembersTable.isDeleted, 0),
        ))
        .limit(1);
      workspaceMemberId = wmRow?.id;

      return {
        workspaceId,
        workspaceName: workspace.name,
        accountOwnerId: workspace.accountOwnerId,
        isAccountOwner: false,
        isDefault: Boolean(workspace.isDefault),
        workspaceMemberId,
        teamMemberId: team.memberId,
        roleId,
        roleName,
        permissions: useLegacy ? legacyRolePermissions(legacyRole) : permissions,
        legacyRole,
        preserveLegacyPermissions: workspace.preserveLegacyPermissions,
        useLegacy,
        team,
      };
    }
    return null;
  }

  const legacyRoleKey = membership.member.legacyRole ?? membership.role?.legacyRoleKey ?? team.role;
  const legacyRole = normalizeLegacyRole(legacyRoleKey);
  const useLegacy = workspace.preserveLegacyPermissions
    && !membership.member.roleId
    && isLegacyRoleKey(legacyRoleKey);

  const permissions = useLegacy
    ? legacyRolePermissions(legacyRole)
    : (membership.role?.permissions ?? legacyRolePermissions(legacyRole));

  return {
    workspaceId,
    workspaceName: workspace.name,
    accountOwnerId: workspace.accountOwnerId,
    isAccountOwner: false,
    isDefault: Boolean(workspace.isDefault),
    workspaceMemberId: membership.member.id,
    teamMemberId: team.memberId,
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
