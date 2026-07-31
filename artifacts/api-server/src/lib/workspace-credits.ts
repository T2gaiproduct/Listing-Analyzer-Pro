import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  creditsTable,
  workspaceCreditsTable,
  memberCreditsTable,
  workspacesTable,
  creditTransactionsTable,
  teamMembersTable,
  workspaceMembersTable,
} from "@workspace/db";
import type { CreditType } from "./credits.js";

export interface CreditTotals {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

const ZERO: CreditTotals = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

export function sumCreditBalance(c: CreditTotals): number {
  return Number(c.aiCredits ?? 0) + Number(c.imageCredits ?? 0) + Number(c.auditCredits ?? 0);
}

/** Pool balance not yet assigned to members (members are allocated from the pool, not added on top). */
export function poolAvailableForMembers(pool: CreditTotals, memberAllocated: CreditTotals): CreditTotals {
  return {
    aiCredits: Math.max(0, Number(pool.aiCredits ?? 0) - Number(memberAllocated.aiCredits ?? 0)),
    imageCredits: Math.max(0, Number(pool.imageCredits ?? 0) - Number(memberAllocated.imageCredits ?? 0)),
    auditCredits: Math.max(0, Number(pool.auditCredits ?? 0) - Number(memberAllocated.auditCredits ?? 0)),
  };
}

/** Total credits in this workspace = assigned to members + unassigned in pool + used this period. */
export function workspaceFundedCreditTotal(
  pool: CreditTotals,
  memberAllocated: CreditTotals,
  usedInPeriod: number,
): number {
  const available = poolAvailableForMembers(pool, memberAllocated);
  return sumCreditBalance(memberAllocated) + sumCreditBalance(available) + usedInPeriod;
}

function keyForType(type: CreditType): "aiCredits" | "imageCredits" | "auditCredits" {
  if (type === "ai") return "aiCredits";
  if (type === "image") return "imageCredits";
  return "auditCredits";
}

export async function ensureWorkspaceCreditsRow(workspaceId: number): Promise<void> {
  const [existing] = await db
    .select({ id: workspaceCreditsTable.id })
    .from(workspaceCreditsTable)
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));
  if (!existing) {
    await db.insert(workspaceCreditsTable).values({ workspaceId });
  }
}

export async function getWorkspaceCredits(workspaceId: number): Promise<CreditTotals> {
  await ensureWorkspaceCreditsRow(workspaceId);
  const [row] = await db
    .select()
    .from(workspaceCreditsTable)
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));
  if (!row) return { ...ZERO };
  return {
    aiCredits: row.aiCredits,
    imageCredits: row.imageCredits,
    auditCredits: row.auditCredits,
  };
}

export async function sumWorkspacePoolsForOwner(accountOwnerId: string): Promise<CreditTotals> {
  const workspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)));
  if (workspaces.length === 0) return { ...ZERO };
  const ids = workspaces.map((w) => w.id);
  const rows = await db
    .select()
    .from(workspaceCreditsTable)
    .where(inArray(workspaceCreditsTable.workspaceId, ids));
  return rows.reduce(
    (acc, row) => ({
      aiCredits: acc.aiCredits + row.aiCredits,
      imageCredits: acc.imageCredits + row.imageCredits,
      auditCredits: acc.auditCredits + row.auditCredits,
    }),
    { ...ZERO },
  );
}

export async function sumAllocatedMemberCreditsForWorkspace(
  workspaceId: number,
  excludeWorkspaceMemberId?: number,
): Promise<CreditTotals> {
  const rows = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceId, workspaceId));
  return rows
    .filter((r) => r.workspaceMemberId !== excludeWorkspaceMemberId)
    .reduce(
      (acc, row) => ({
        aiCredits: acc.aiCredits + row.aiCredits,
        imageCredits: acc.imageCredits + row.imageCredits,
        auditCredits: acc.auditCredits + row.auditCredits,
      }),
      { ...ZERO },
    );
}

/** Set workspace pool balances; moves credits between account owner balance and workspace pool. */
export async function setWorkspaceCreditPool(
  accountOwnerId: string,
  workspaceId: number,
  targetAi: number,
  targetImg: number,
  targetAudit: number,
): Promise<{ workspaceCredits: CreditTotals; accountCredits: CreditTotals }> {
  const ai = Math.max(0, Math.floor(targetAi));
  const img = Math.max(0, Math.floor(targetImg));
  const audit = Math.max(0, Math.floor(targetAudit));

  const [ws] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.id, workspaceId),
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ));
  if (!ws) throw new Error("Workspace not found");

  await ensureWorkspaceCreditsRow(workspaceId);
  const current = await getWorkspaceCredits(workspaceId);
  const delta = {
    aiCredits: ai - current.aiCredits,
    imageCredits: img - current.imageCredits,
    auditCredits: audit - current.auditCredits,
  };

  const [ownerRow] = await db.select().from(creditsTable).where(eq(creditsTable.userId, accountOwnerId));
  const ownerBal = ownerRow ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

  if (delta.aiCredits > ownerBal.aiCredits || delta.imageCredits > ownerBal.imageCredits || delta.auditCredits > ownerBal.auditCredits) {
    const err = new Error("Insufficient account credits to fund this workspace pool") as Error & { code?: string };
    err.code = "INSUFFICIENT_ACCOUNT";
    throw err;
  }

  const memberAllocated = await sumAllocatedMemberCreditsForWorkspace(workspaceId);
  if (ai < memberAllocated.aiCredits || img < memberAllocated.imageCredits || audit < memberAllocated.auditCredits) {
    const err = new Error("Workspace pool cannot be below credits already allocated to members") as Error & { code?: string };
    err.code = "BELOW_MEMBER_ALLOCATIONS";
    throw err;
  }

  const now = new Date();
  const newOwner = {
    aiCredits: ownerBal.aiCredits - delta.aiCredits,
    imageCredits: ownerBal.imageCredits - delta.imageCredits,
    auditCredits: ownerBal.auditCredits - delta.auditCredits,
  };

  if (ownerRow) {
    await db.update(creditsTable)
      .set({ ...newOwner, updatedAt: now })
      .where(eq(creditsTable.userId, accountOwnerId));
  } else {
    await db.insert(creditsTable).values({ userId: accountOwnerId, ...newOwner });
  }

  await db.update(workspaceCreditsTable)
    .set({ aiCredits: ai, imageCredits: img, auditCredits: audit, updatedAt: now })
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));

  if (delta.aiCredits !== 0 || delta.imageCredits !== 0 || delta.auditCredits !== 0) {
    await db.insert(creditTransactionsTable).values({
      userId: accountOwnerId,
      creditType: "audit",
      amount: 0,
      reason: "Workspace credit pool adjustment",
      featureType: "workspace_pool_transfer",
      workspaceId,
      metadata: { delta, target: { ai, img, audit } },
      createdAt: now,
    });
  }

  return {
    workspaceCredits: { aiCredits: ai, imageCredits: img, auditCredits: audit },
    accountCredits: newOwner,
  };
}

export async function getWorkspaceMemberCredits(workspaceMemberId: number): Promise<CreditTotals | null> {
  const [row] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));
  if (!row) return null;
  return {
    aiCredits: row.aiCredits,
    imageCredits: row.imageCredits,
    auditCredits: row.auditCredits,
  };
}

export async function setWorkspaceMemberCredits(
  workspaceId: number,
  workspaceMemberId: number,
  memberId: number | null,
  aiCredits: number,
  imageCredits: number,
  auditCredits: number,
): Promise<CreditTotals> {
  const ai = Math.max(0, Math.floor(aiCredits));
  const img = Math.max(0, Math.floor(imageCredits));
  const audit = Math.max(0, Math.floor(auditCredits));

  await ensureWorkspaceCreditsRow(workspaceId);
  const pool = await getWorkspaceCredits(workspaceId);
  const other = await sumAllocatedMemberCreditsForWorkspace(workspaceId, workspaceMemberId);

  if (ai > pool.aiCredits - other.aiCredits || img > pool.imageCredits - other.imageCredits || audit > pool.auditCredits - other.auditCredits) {
    const err = new Error("Allocation exceeds workspace pool credits available for members") as Error & { code?: string };
    err.code = "EXCEEDS_WORKSPACE_POOL";
    throw err;
  }

  const now = new Date();
  const [existing] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));

  if (existing) {
    await db.update(memberCreditsTable)
      .set({ aiCredits: ai, imageCredits: img, auditCredits: audit, memberId, updatedAt: now })
      .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));
  } else {
    await db.insert(memberCreditsTable).values({
      workspaceId,
      workspaceMemberId,
      memberId,
      aiCredits: ai,
      imageCredits: img,
      auditCredits: audit,
    });
  }

  return { aiCredits: ai, imageCredits: img, auditCredits: audit };
}

export async function deductWorkspaceMemberCredits(
  workspaceMemberId: number,
  workspaceId: number,
  userId: string,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; remaining: number }> {
  const [memberRow] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));
  const memberBal = memberRow
    ? memberRow[keyForType(type)]
    : 0;
  if (memberBal < amount) {
    return { success: false, remaining: memberBal };
  }

  const pool = await getWorkspaceCredits(workspaceId);
  const poolBal = pool[keyForType(type)];
  if (poolBal < amount) {
    return { success: false, remaining: memberBal };
  }

  const key = keyForType(type);
  const now = new Date();

  if (memberRow) {
    await db.update(memberCreditsTable)
      .set({ [key]: memberBal - amount, updatedAt: now })
      .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));
  }

  await db.update(workspaceCreditsTable)
    .set({ [key]: poolBal - amount, updatedAt: now })
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));

  await db.insert(creditTransactionsTable).values({
    userId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    workspaceId,
    metadata: { ...(metadata ?? {}), chargedFrom: "workspace_member_pool", workspaceMemberId },
    createdAt: now,
  });

  return { success: true, remaining: memberBal - amount };
}

export async function deductWorkspacePoolForOwner(
  workspaceId: number,
  ownerUserId: string,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; remaining: number }> {
  const pool = await getWorkspaceCredits(workspaceId);
  const key = keyForType(type);
  const bal = pool[key];
  if (bal < amount) {
    return { success: false, remaining: bal };
  }

  const now = new Date();
  await db.update(workspaceCreditsTable)
    .set({ [key]: bal - amount, updatedAt: now })
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));

  await db.insert(creditTransactionsTable).values({
    userId: ownerUserId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    workspaceId,
    metadata: metadata ?? {},
    createdAt: now,
  });

  return { success: true, remaining: bal - amount };
}

/** Match a team_members row to workspace_members in a given workspace. */
export async function resolveWorkspaceMemberIdForTeamMember(
  teamMemberId: number,
  workspaceId: number,
): Promise<number | null> {
  const [tm] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, teamMemberId))
    .limit(1);
  if (!tm) return null;

  if (tm.memberUserId) {
    const [wm] = await db
      .select({ id: workspaceMembersTable.id })
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, tm.memberUserId),
        eq(workspaceMembersTable.isDeleted, 0),
      ))
      .limit(1);
    if (wm) return wm.id;
  }

  const emailLower = tm.invitedEmail.trim().toLowerCase();
  const members = await db
    .select({ id: workspaceMembersTable.id, email: workspaceMembersTable.invitedEmail })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ));
  const match = members.find((m) => m.email.trim().toLowerCase() === emailLower);
  return match?.id ?? null;
}
