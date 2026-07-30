import { and, eq, inArray } from "drizzle-orm";
import { db, memberCreditsTable, teamMembersTable } from "@workspace/db";
import type { WorkspaceMemberListItem } from "./workspace-member-summary.js";
import {
  countAuditActivity,
  getLastActivityAt,
  sumCreditsUsedInPeriod,
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

/** Activity and allocated credits for workspace_members (matched to account team when possible). */
export async function buildWorkspaceMemberStats(
  ownerUserId: string,
  workspaceMembers: WorkspaceMemberListItem[],
  periodStart: Date,
  periodEnd: Date,
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

  const teamMemberIds = teamRows.map((r) => r.id);
  const allCredits = teamMemberIds.length > 0
    ? await db.select().from(memberCreditsTable).where(inArray(memberCreditsTable.memberId, teamMemberIds))
    : [];
  const creditsByMemberId = new Map(allCredits.map((c) => [c.memberId, c]));

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

    const creditsUsed = await sumCreditsUsedInPeriod(wm.userId, periodStart, periodEnd);
    const auditCount = await countAuditActivity(wm.userId, periodStart, periodEnd);
    const lastActivityAt = await getLastActivityAt(wm.userId);
    const allocated = teamMember ? creditsByMemberId.get(teamMember.id) : undefined;

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
