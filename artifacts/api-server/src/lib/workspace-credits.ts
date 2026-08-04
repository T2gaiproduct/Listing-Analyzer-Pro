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

/** Pool balance not yet assigned to members (unassigned remainder in workspace_credits). */
export function poolAvailableForMembers(pool: CreditTotals): CreditTotals {
  return normalizeCreditTotals(pool);
}

/** Total funded to workspace pool = unassigned pool + credits assigned to members. */
export function workspacePoolFundedTotals(pool: CreditTotals, memberAllocated: CreditTotals): CreditTotals {
  const p = normalizeCreditTotals(pool);
  const a = normalizeCreditTotals(memberAllocated);
  return {
    aiCredits: p.aiCredits + a.aiCredits,
    imageCredits: p.imageCredits + a.imageCredits,
    auditCredits: p.auditCredits + a.auditCredits,
  };
}

/** Total credits funded to this workspace = remaining pool balance + used this period. */
export function workspaceFundedCreditTotal(pool: CreditTotals, usedInPeriod: number): number {
  return sumCreditBalance(pool) + usedInPeriod;
}

/** Member balances only count toward workspace totals when the pool has been funded. */
export function memberCreditsInWorkspace(pool: CreditTotals, memberAllocated: CreditTotals): CreditTotals {
  if (sumCreditBalance(pool) <= 0) return { ...ZERO };
  return memberAllocated;
}

/** Sum of member credit balances that count within a funded workspace pool. */
export function memberCreditsTotalInWorkspace(pool: CreditTotals, memberAllocated: CreditTotals): number {
  return sumCreditBalance(memberCreditsInWorkspace(pool, memberAllocated));
}

export interface AccountCreditSummary {
  unallocated: CreditTotals;
  unallocatedTotal: number;
  inWorkspacePools: CreditTotals;
  inPoolsTotal: number;
  accountTotal: number;
  accountTotalBuckets: CreditTotals;
}

function normalizeCreditTotals(c: CreditTotals): CreditTotals {
  return {
    aiCredits: Number(c.aiCredits ?? 0),
    imageCredits: Number(c.imageCredits ?? 0),
    auditCredits: Number(c.auditCredits ?? 0),
  };
}

/**
 * Agency account credits: unallocated (account row) + in workspace pools = total in account.
 * Unallocated per bucket = total bucket − allocated to workspace pools.
 */
export function computeAccountCreditSummary(
  accountRow: CreditTotals,
  inWorkspacePools: CreditTotals,
): AccountCreditSummary {
  const row = normalizeCreditTotals(accountRow);
  const pools = normalizeCreditTotals(inWorkspacePools);
  const inPoolsTotal = sumCreditBalance(pools);
  const rowSum = sumCreditBalance(row);

  const subtractUnallocated: CreditTotals = {
    aiCredits: Math.max(0, row.aiCredits - pools.aiCredits),
    imageCredits: Math.max(0, row.imageCredits - pools.imageCredits),
    auditCredits: Math.max(0, row.auditCredits - pools.auditCredits),
  };
  const subtractSum = sumCreditBalance(subtractUnallocated);

  let accountTotalBuckets: CreditTotals;
  let unallocated: CreditTotals;

  // Row stores full account total when subtracting pools reproduces the row sum.
  if (inPoolsTotal > 0 && subtractSum + inPoolsTotal === rowSum) {
    accountTotalBuckets = { ...row };
    unallocated = subtractUnallocated;
  } else {
    accountTotalBuckets = {
      aiCredits: row.aiCredits + pools.aiCredits,
      imageCredits: row.imageCredits + pools.imageCredits,
      auditCredits: row.auditCredits + pools.auditCredits,
    };
    unallocated = { ...row };
  }

  const accountTotal = sumCreditBalance(accountTotalBuckets);
  const unallocatedTotal = sumCreditBalance(unallocated);

  return {
    unallocated,
    unallocatedTotal,
    inWorkspacePools: pools,
    inPoolsTotal,
    accountTotal,
    accountTotalBuckets,
  };
}

/** Zero orphaned member_credits rows when the workspace pool has no balance. */
export async function reconcileStaleMemberCreditsWithPool(workspaceId: number): Promise<void> {
  const pool = await getWorkspaceCredits(workspaceId);
  if (sumCreditBalance(pool) > 0) return;

  const rows = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceId, workspaceId));
  const hasStale = rows.some(
    (r) => Number(r.aiCredits) > 0 || Number(r.imageCredits) > 0 || Number(r.auditCredits) > 0,
  );
  if (!hasStale) return;

  const now = new Date();
  await db
    .update(memberCreditsTable)
    .set({ aiCredits: 0, imageCredits: 0, auditCredits: 0, updatedAt: now })
    .where(eq(memberCreditsTable.workspaceId, workspaceId));
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
    .select({
      workspaceMemberId: memberCreditsTable.workspaceMemberId,
      aiCredits: memberCreditsTable.aiCredits,
      imageCredits: memberCreditsTable.imageCredits,
      auditCredits: memberCreditsTable.auditCredits,
    })
    .from(memberCreditsTable)
    .innerJoin(
      workspaceMembersTable,
      eq(memberCreditsTable.workspaceMemberId, workspaceMembersTable.id),
    )
    .where(and(
      eq(memberCreditsTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ));
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

/** One-time align gross pool rows (funded total) to net unassigned balances. */
export async function reconcileGrossWorkspacePool(workspaceId: number): Promise<void> {
  await ensureWorkspaceCreditsRow(workspaceId);
  const [poolRow] = await db
    .select()
    .from(workspaceCreditsTable)
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));
  if (!poolRow || poolRow.poolIsNet) return;

  const allocated = await sumAllocatedMemberCreditsForWorkspace(workspaceId);
  const hasAllocation = sumCreditBalance(allocated) > 0;
  if (!hasAllocation) {
    await db.update(workspaceCreditsTable)
      .set({ poolIsNet: true, updatedAt: new Date() })
      .where(eq(workspaceCreditsTable.workspaceId, workspaceId));
    return;
  }

  const now = new Date();
  const next = {
    auditCredits: allocated.auditCredits > 0
      ? Math.max(0, poolRow.auditCredits - allocated.auditCredits)
      : poolRow.auditCredits,
    imageCredits: allocated.imageCredits > 0
      ? Math.max(0, poolRow.imageCredits - allocated.imageCredits)
      : poolRow.imageCredits,
    aiCredits: allocated.aiCredits > 0
      ? Math.max(0, poolRow.aiCredits - allocated.aiCredits)
      : poolRow.aiCredits,
  };

  await db.update(workspaceCreditsTable)
    .set({ ...next, poolIsNet: true, updatedAt: now })
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));
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
    .set({ aiCredits: ai, imageCredits: img, auditCredits: audit, poolIsNet: true, updatedAt: now })
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

/** Active workspace_members row credits for a user in a specific workspace. */
export async function getWorkspaceMemberCreditsForUser(
  userId: string,
  workspaceId: number,
  email?: string,
): Promise<{ workspaceMemberId: number; credits: CreditTotals } | null> {
  const [membership] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.userId, userId),
      eq(workspaceMembersTable.status, "active"),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .limit(1);

  let workspaceMemberId = membership?.id;

  if (!workspaceMemberId && email?.trim()) {
    const emailLower = email.trim().toLowerCase();
    const members = await db
      .select({ id: workspaceMembersTable.id, invitedEmail: workspaceMembersTable.invitedEmail })
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.status, "active"),
        eq(workspaceMembersTable.isDeleted, 0),
      ));
    const match = members.find((m) => m.invitedEmail.trim().toLowerCase() === emailLower);
    workspaceMemberId = match?.id;
  }

  if (!workspaceMemberId) return null;

  const credits = await getWorkspaceMemberCredits(workspaceMemberId);
  return {
    workspaceMemberId,
    credits: credits ?? { ...ZERO },
  };
}

/** Resolve member credits using workspace context (preferred for active workspace). */
export async function resolveWorkspaceMemberCreditsForUser(
  userId: string,
  workspaceId: number,
  email?: string,
): Promise<{ workspaceMemberId: number; credits: CreditTotals } | null> {
  const { resolveWorkspaceContext } = await import("./workspace-context.js");
  const ctx = await resolveWorkspaceContext(userId, workspaceId);
  if (ctx && !ctx.isAccountOwner && ctx.workspaceMemberId) {
    const credits = await getWorkspaceMemberCredits(ctx.workspaceMemberId);
    return {
      workspaceMemberId: ctx.workspaceMemberId,
      credits: credits ?? { ...ZERO },
    };
  }
  return getWorkspaceMemberCreditsForUser(userId, workspaceId, email);
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
  await reconcileGrossWorkspacePool(workspaceId);
  const pool = await getWorkspaceCredits(workspaceId);

  const now = new Date();
  const [existing] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));

  const oldAi = existing?.aiCredits ?? 0;
  const oldImg = existing?.imageCredits ?? 0;
  const oldAudit = existing?.auditCredits ?? 0;
  const deltaAi = ai - oldAi;
  const deltaImg = img - oldImg;
  const deltaAudit = audit - oldAudit;

  if (deltaAi > pool.aiCredits || deltaImg > pool.imageCredits || deltaAudit > pool.auditCredits) {
    const err = new Error("Allocation exceeds workspace pool credits available for members") as Error & { code?: string };
    err.code = "EXCEEDS_WORKSPACE_POOL";
    throw err;
  }

  const newPool = {
    aiCredits: pool.aiCredits - deltaAi,
    imageCredits: pool.imageCredits - deltaImg,
    auditCredits: pool.auditCredits - deltaAudit,
  };

  await db.update(workspaceCreditsTable)
    .set({ ...newPool, poolIsNet: true, updatedAt: now })
    .where(eq(workspaceCreditsTable.workspaceId, workspaceId));

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

  const key = keyForType(type);
  const now = new Date();

  if (memberRow) {
    await db.update(memberCreditsTable)
      .set({ [key]: memberBal - amount, updatedAt: now })
      .where(eq(memberCreditsTable.workspaceMemberId, workspaceMemberId));
  }

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
