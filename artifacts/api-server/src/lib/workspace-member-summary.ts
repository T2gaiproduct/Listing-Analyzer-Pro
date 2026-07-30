import { and, eq, inArray, desc } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  workspaceRolesTable,
} from "@workspace/db";

export interface WorkspaceMemberListItem {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  userId: string | null;
  roleName: string | null;
  legacyRole: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface WorkspaceMemberSummary {
  totalMemberships: number;
  uniquePeople: number;
  activeMembers: number;
  pendingInvites: number;
  /** When scoped to one workspace, totals reflect that workspace only. */
  scopedWorkspaceId: number | null;
  workspaces: Array<{
    id: number;
    name: string;
    isDefault: boolean;
    memberCount: number;
    activeMemberCount: number;
    pendingMemberCount: number;
    members: WorkspaceMemberListItem[];
  }>;
}

export interface WorkspaceMemberSummaryOptions {
  workspaceId?: number;
  includeMembers?: boolean;
}

/** Aggregate workspace_members for an account owner (same logic as workspaces overview). */
export async function getWorkspaceMemberSummaryForOwner(
  accountOwnerId: string,
  options?: WorkspaceMemberSummaryOptions,
): Promise<WorkspaceMemberSummary> {
  const scopedWorkspaceId = options?.workspaceId ?? null;
  const includeMembers = options?.includeMembers ?? false;

  let owned = await db
    .select({
      id: workspacesTable.id,
      name: workspacesTable.name,
      isDefault: workspacesTable.isDefault,
    })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .orderBy(desc(workspacesTable.isDefault), workspacesTable.name);

  if (scopedWorkspaceId != null) {
    owned = owned.filter((w) => w.id === scopedWorkspaceId);
    if (owned.length === 0) {
      return {
        totalMemberships: 0,
        uniquePeople: 0,
        activeMembers: 0,
        pendingInvites: 0,
        scopedWorkspaceId,
        workspaces: [],
      };
    }
  }

  if (owned.length === 0) {
    return {
      totalMemberships: 0,
      uniquePeople: 0,
      activeMembers: 0,
      pendingInvites: 0,
      scopedWorkspaceId,
      workspaces: [],
    };
  }

  const workspaceIds = owned.map((w) => w.id);
  const rows = await db
    .select({
      id: workspaceMembersTable.id,
      workspaceId: workspaceMembersTable.workspaceId,
      status: workspaceMembersTable.status,
      userId: workspaceMembersTable.userId,
      invitedEmail: workspaceMembersTable.invitedEmail,
      invitedName: workspaceMembersTable.invitedName,
      legacyRole: workspaceMembersTable.legacyRole,
      invitedAt: workspaceMembersTable.invitedAt,
      acceptedAt: workspaceMembersTable.acceptedAt,
      roleName: workspaceRolesTable.name,
    })
    .from(workspaceMembersTable)
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      inArray(workspaceMembersTable.workspaceId, workspaceIds),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .orderBy(desc(workspaceMembersTable.invitedAt));

  const perWorkspace = new Map<number, {
    total: number;
    active: number;
    pending: number;
    members: WorkspaceMemberListItem[];
  }>();
  const uniquePeople = new Set<string>();
  let activeMembers = 0;
  let pendingInvites = 0;

  for (const row of rows) {
    const stats = perWorkspace.get(row.workspaceId) ?? {
      total: 0,
      active: 0,
      pending: 0,
      members: [],
    };
    stats.total += 1;
    if (row.status === "active") {
      stats.active += 1;
      activeMembers += 1;
    }
    if (row.status === "pending") {
      stats.pending += 1;
      pendingInvites += 1;
    }

    if (includeMembers) {
      stats.members.push({
        id: row.id,
        invitedEmail: row.invitedEmail,
        invitedName: row.invitedName,
        status: row.status,
        userId: row.userId,
        roleName: row.roleName,
        legacyRole: row.legacyRole,
        invitedAt: row.invitedAt.toISOString(),
        acceptedAt: row.acceptedAt?.toISOString() ?? null,
      });
    }

    perWorkspace.set(row.workspaceId, stats);

    const personKey = row.userId?.trim()
      ? `user:${row.userId.trim()}`
      : `email:${row.invitedEmail.trim().toLowerCase()}`;
    uniquePeople.add(personKey);
  }

  return {
    totalMemberships: rows.length,
    uniquePeople: uniquePeople.size,
    activeMembers,
    pendingInvites,
    scopedWorkspaceId,
    workspaces: owned.map((w) => {
      const stats = perWorkspace.get(w.id) ?? {
        total: 0,
        active: 0,
        pending: 0,
        members: [],
      };
      return {
        id: w.id,
        name: w.name,
        isDefault: w.isDefault,
        memberCount: stats.total,
        activeMemberCount: stats.active,
        pendingMemberCount: stats.pending,
        members: stats.members,
      };
    }),
  };
}
