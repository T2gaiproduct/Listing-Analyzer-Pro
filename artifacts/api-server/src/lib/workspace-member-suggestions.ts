import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  teamMembersTable,
  workspaceMembersTable,
  workspacesTable,
} from "@workspace/db";

export interface WorkspaceMemberInviteSuggestion {
  email: string;
  name: string;
  workspaceName: string;
  source: "workspace" | "team";
}

/** Known members across the account owner's workspaces and team, for invite autofill. */
export async function listWorkspaceMemberInviteSuggestions(
  accountOwnerId: string,
  excludeWorkspaceId: number,
  query = "",
): Promise<WorkspaceMemberInviteSuggestion[]> {
  const normalizedQuery = query.trim().toLowerCase();

  const currentWorkspaceMembers = await db
    .select({ invitedEmail: workspaceMembersTable.invitedEmail })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, excludeWorkspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
      ne(workspaceMembersTable.status, "revoked"),
    ));

  const excludedEmails = new Set(
    currentWorkspaceMembers
      .map((m) => m.invitedEmail.trim().toLowerCase())
      .filter(Boolean),
  );

  const ownedWorkspaces = await db
    .select({ id: workspacesTable.id, name: workspacesTable.name })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ));

  const workspaceNameById = new Map(ownedWorkspaces.map((w) => [w.id, w.name]));
  const workspaceIds = ownedWorkspaces.map((w) => w.id);

  const byEmail = new Map<string, WorkspaceMemberInviteSuggestion>();

  if (workspaceIds.length > 0) {
    const workspaceRows = await db
      .select({
        invitedEmail: workspaceMembersTable.invitedEmail,
        invitedName: workspaceMembersTable.invitedName,
        workspaceId: workspaceMembersTable.workspaceId,
        invitedAt: workspaceMembersTable.invitedAt,
      })
      .from(workspaceMembersTable)
      .where(and(
        inArray(workspaceMembersTable.workspaceId, workspaceIds),
        eq(workspaceMembersTable.isDeleted, 0),
        ne(workspaceMembersTable.status, "revoked"),
      ))
      .orderBy(desc(workspaceMembersTable.invitedAt));

    for (const row of workspaceRows) {
      const email = row.invitedEmail.trim().toLowerCase();
      if (!email || excludedEmails.has(email)) continue;
      const workspaceName = workspaceNameById.get(row.workspaceId) ?? "Workspace";
      const name = row.invitedName?.trim() || email.split("@")[0] || "Member";
      if (!byEmail.has(email)) {
        byEmail.set(email, {
          email: row.invitedEmail.trim(),
          name,
          workspaceName,
          source: "workspace",
        });
      }
    }
  }

  const teamRows = await db
    .select({
      invitedEmail: teamMembersTable.invitedEmail,
      invitedName: teamMembersTable.invitedName,
      invitedAt: teamMembersTable.invitedAt,
    })
    .from(teamMembersTable)
    .where(and(
      eq(teamMembersTable.ownerUserId, accountOwnerId),
      ne(teamMembersTable.status, "revoked"),
      eq(teamMembersTable.isDeleted, 0),
    ))
    .orderBy(desc(teamMembersTable.invitedAt));

  for (const row of teamRows) {
    const email = row.invitedEmail.trim().toLowerCase();
    if (!email || excludedEmails.has(email)) continue;
    const name = row.invitedName?.trim() || email.split("@")[0] || "Member";
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email: row.invitedEmail.trim(),
        name,
        workspaceName: "Team",
        source: "team",
      });
    }
  }

  let suggestions = [...byEmail.values()];

  if (normalizedQuery) {
    suggestions = suggestions.filter((s) => {
      const email = s.email.toLowerCase();
      const name = s.name.toLowerCase();
      return email.includes(normalizedQuery) || name.includes(normalizedQuery);
    });
  }

  suggestions.sort((a, b) => a.email.localeCompare(b.email));
  return suggestions.slice(0, normalizedQuery ? 20 : 50);
}
