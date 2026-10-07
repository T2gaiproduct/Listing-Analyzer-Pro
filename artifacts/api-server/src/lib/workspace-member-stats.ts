import { and, eq, inArray } from "drizzle-orm";
import { db, memberCreditsTable, teamMembersTable } from "@workspace/db";
import type { WorkspaceMemberListItem } from "./workspace-member-summary.js";
import type { WorkspaceMemberSummary } from "./workspace-member-summary.js";
import {
  countAuditActivity,
  getLastActivityAt,
  sumCreditsUsedInWorkspaceForUser,
} from "./team-stats.js";

export interface WorkspaceMemberStat {
  workspaceMemberId: number;
  teamMemberId: number | null;
  auditCount: number;
  creditsUsed: number;
  lastActivityAt: string | null;
  remainingCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
  allocatedCredits: { aiCredits: number; imageCredits: number; auditCredits: number } | null;
}

export interface WorkspaceMemberBillingStat extends WorkspaceMemberStat {
  workspaceId: number;
  workspaceName: string;
  invitedName: string;
  invitedEmail: string;
  userId: string | null;
  status: string;
}

/** Activity and allocated credits for workspace_members (matched to account team when possible). */
export async function buildWorkspaceMemberStats(
  ownerUserId: string,
  workspaceMembers: WorkspaceMemberListItem[],
  periodStart: Date,
  periodEnd: Date,
  workspaceId: number,
): Promise<WorkspaceMemberStat[]> {
  const teamRows = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, ownerUserId), eq(teamMembersTable.status, "active")));

  const byUserId = new Map<string, typeof teamRows[0]>();
  const byEmail = new Map<string, typeof teamRows[0]>();
  for (const row of teamRows) {
    if (row.memberUserId) byUserId.set(row.memberUserId, row);
    byEmail.set(row.invitedEmail.trim().toLowerCase(), row);
  }

  const workspaceMemberIds = workspaceMembers.map((wm) => wm.id);
  const allCredits = workspaceMemberIds.length > 0
    ? await db.select().from(memberCreditsTable).where(inArray(memberCreditsTable.workspaceMemberId, workspaceMemberIds))
    : [];
  const creditsByWorkspaceMemberId = new Map(allCredits.map((c) => [c.workspaceMemberId, c]));

  return Promise.all(workspaceMembers.map(async (wm) => {
    const teamMember = wm.userId
      ? byUserId.get(wm.userId) ?? byEmail.get(wm.invitedEmail.trim().toLowerCase())
      : byEmail.get(wm.invitedEmail.trim().toLowerCase());

    if (!wm.userId) {
      return {
        workspaceMemberId: wm.id,
        teamMemberId: teamMember?.id ?? null,
        auditCount: 0,
        creditsUsed: 0,
        lastActivityAt: null,
        remainingCredits: null,
        allocatedCredits: null,
      };
    }

    const creditsUsed = await sumCreditsUsedInWorkspaceForUser(
      wm.userId,
      workspaceId,
      periodStart,
      periodEnd,
    );
    const auditCount = await countAuditActivity(wm.userId, periodStart, periodEnd);
    const lastActivityAt = await getLastActivityAt(wm.userId);
    const allocated = creditsByWorkspaceMemberId.get(wm.id);

    return {
      workspaceMemberId: wm.id,
      teamMemberId: teamMember?.id ?? null,
      auditCount,
      creditsUsed,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      remainingCredits: allocated
        ? { aiCredits: allocated.aiCredits, imageCredits: allocated.imageCredits, auditCredits: allocated.auditCredits }
        : { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
      allocatedCredits: allocated
        ? { aiCredits: allocated.aiCredits, imageCredits: allocated.imageCredits, auditCredits: allocated.auditCredits }
        : null,
    };
  }));
}

/** Per-workspace member usage for billing / account-wide team views. */
export async function buildAllWorkspaceMemberBillingStats(
  ownerUserId: string,
  summary: WorkspaceMemberSummary,
  periodStart: Date,
  periodEnd: Date,
): Promise<WorkspaceMemberBillingStat[]> {
  const rows: WorkspaceMemberBillingStat[] = [];
  for (const ws of summary.workspaces) {
    const activeMembers = ws.members.filter((m) => m.status === "active");
    if (activeMembers.length === 0) continue;
    const stats = await buildWorkspaceMemberStats(
      ownerUserId,
      activeMembers,
      periodStart,
      periodEnd,
      ws.id,
    );
    const memberById = new Map(activeMembers.map((m) => [m.id, m]));
    for (const stat of stats) {
      const wm = memberById.get(stat.workspaceMemberId);
      if (!wm) continue;
      rows.push({
        ...stat,
        workspaceId: ws.id,
        workspaceName: ws.name,
        invitedName: wm.invitedName,
        invitedEmail: wm.invitedEmail,
        userId: wm.userId,
        status: wm.status,
      });
    }
  }
  return rows;
}
