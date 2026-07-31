import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, creditTransactionsTable, workspacesTable } from "@workspace/db";
import { sumWorkspacePoolsForOwner } from "./workspace-credits.js";

export interface CreditTotals {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

export function sumCreditTotals(c: CreditTotals): number {
  return Number(c.aiCredits ?? 0) + Number(c.imageCredits ?? 0) + Number(c.auditCredits ?? 0);
}

export async function sumCreditsUsedInPeriod(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${creditTransactionsTable.amount})), 0)`,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, userId),
        sql`${creditTransactionsTable.amount} < 0`,
        gte(creditTransactionsTable.createdAt, periodStart),
        lte(creditTransactionsTable.createdAt, periodEnd),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Credits consumed by a user in a specific workspace during a billing period. */
export async function sumCreditsUsedInWorkspaceForUser(
  userId: string,
  workspaceId: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${creditTransactionsTable.amount})), 0)`,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, userId),
        eq(creditTransactionsTable.workspaceId, workspaceId),
        sql`${creditTransactionsTable.amount} < 0`,
        sql`coalesce(${creditTransactionsTable.featureType}, '') != 'subscription'`,
        sql`coalesce(${creditTransactionsTable.featureType}, '') != 'workspace_pool_transfer'`,
        gte(creditTransactionsTable.createdAt, periodStart),
        lte(creditTransactionsTable.createdAt, periodEnd),
      ),
    );
  return Number(row?.total ?? 0);
}

/** All credits consumed under an account owner this period (workspace pools + personal account spend). */
export async function sumCreditsUsedForAccountOwner(
  accountOwnerId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const usageConditions = [
    sql`${creditTransactionsTable.amount} < 0`,
    sql`coalesce(${creditTransactionsTable.featureType}, '') != 'subscription'`,
    sql`coalesce(${creditTransactionsTable.featureType}, '') != 'workspace_pool_transfer'`,
    gte(creditTransactionsTable.createdAt, periodStart),
    lte(creditTransactionsTable.createdAt, periodEnd),
  ];

  const ownedWorkspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)));
  const workspaceIds = ownedWorkspaces.map((w) => w.id);

  let workspaceUsage = 0;
  if (workspaceIds.length > 0) {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(abs(${creditTransactionsTable.amount})), 0)`,
      })
      .from(creditTransactionsTable)
      .where(and(inArray(creditTransactionsTable.workspaceId, workspaceIds), ...usageConditions));
    workspaceUsage = Number(row?.total ?? 0);
  }

  const [personalRow] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${creditTransactionsTable.amount})), 0)`,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, accountOwnerId),
        isNull(creditTransactionsTable.workspaceId),
        ...usageConditions,
      ),
    );

  return workspaceUsage + Number(personalRow?.total ?? 0);
}

/** Credits consumed from a workspace pool in a billing period (all members + owner). */
export async function sumCreditsUsedForWorkspace(
  workspaceId: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${creditTransactionsTable.amount})), 0)`,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.workspaceId, workspaceId),
        sql`${creditTransactionsTable.amount} < 0`,
        sql`coalesce(${creditTransactionsTable.featureType}, '') != 'subscription'`,
        sql`coalesce(${creditTransactionsTable.featureType}, '') != 'workspace_pool_transfer'`,
        gte(creditTransactionsTable.createdAt, periodStart),
        lte(creditTransactionsTable.createdAt, periodEnd),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function countAuditActivity(
  userId: string,
  periodStart?: Date,
  periodEnd?: Date,
): Promise<number> {
  const conditions = [
    eq(creditTransactionsTable.userId, userId),
    sql`${creditTransactionsTable.amount} < 0`,
    sql`(${creditTransactionsTable.creditType} = 'audit' OR ${creditTransactionsTable.featureType} IN ('audit', 'competitor', 'competitors'))`,
  ];
  if (periodStart) conditions.push(gte(creditTransactionsTable.createdAt, periodStart));
  if (periodEnd) conditions.push(lte(creditTransactionsTable.createdAt, periodEnd));

  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(creditTransactionsTable)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export async function getLastActivityAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: creditTransactionsTable.createdAt })
    .from(creditTransactionsTable)
    .where(and(eq(creditTransactionsTable.userId, userId), sql`${creditTransactionsTable.amount} < 0`))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

export async function sumAllocatedCreditsForOwner(ownerUserId: string, excludeMemberId?: number): Promise<CreditTotals> {
  return sumWorkspacePoolsForOwner(ownerUserId);
}
