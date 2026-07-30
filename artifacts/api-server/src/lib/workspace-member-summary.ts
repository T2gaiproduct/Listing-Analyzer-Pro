import { and, eq, inArray, desc } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable } from "@workspace/db";

export interface WorkspaceMemberSummary {
  totalMemberships: number;
  uniquePeople: number;
  activeMembers: number;
  pendingInvites: number;
  workspaces: Array<{
    id: number;
    name: string;
    isDefault: boolean;
    memberCount: number;
    activeMemberCount: number;
    pendingMemberCount: number;
  }>;
}

/** Aggregate workspace_members for an account owner (same logic as workspaces overview). */
export async function getWorkspaceMemberSummaryForOwner(
  accountOwnerId: string,
): Promise<WorkspaceMemberSummary> {
  const owned = await db
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

  if (owned.length === 0) {
    return {
      totalMemberships: 0,
      uniquePeople: 0,
      activeMembers: 0,
      pendingInvites: 0,
      workspaces: [],
    };
  }

  const workspaceIds = owned.map((w) => w.id);
  const rows = await db
    .select({
      workspaceId: workspaceMembersTable.workspaceId,
      status: workspaceMembersTable.status,
      userId: workspaceMembersTable.userId,
      invitedEmail: workspaceMembersTable.invitedEmail,
    })
    .from(workspaceMembersTable)
    .where(and(
      inArray(workspaceMembersTable.workspaceId, workspaceIds),
      eq(workspaceMembersTable.isDeleted, 0),
    ));

  const perWorkspace = new Map<number, { total: number; active: number; pending: number }>();
  const uniquePeople = new Set<string>();
  let activeMembers = 0;
  let pendingInvites = 0;

  for (const row of rows) {
    const stats = perWorkspace.get(row.workspaceId) ?? { total: 0, active: 0, pending: 0 };
    stats.total += 1;
    if (row.status === "active") {
      stats.active += 1;
      activeMembers += 1;
    }
    if (row.status === "pending") {
      stats.pending += 1;
      pendingInvites += 1;
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
    workspaces: owned.map((w) => {
      const stats = perWorkspace.get(w.id) ?? { total: 0, active: 0, pending: 0 };
      return {
        id: w.id,
        name: w.name,
        isDefault: w.isDefault,
        memberCount: stats.total,
        activeMemberCount: stats.active,
        pendingMemberCount: stats.pending,
      };
    }),
  };
}
