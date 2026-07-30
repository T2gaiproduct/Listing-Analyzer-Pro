import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, creditTransactionsTable } from "@workspace/db";
import { sumWorkspacePoolsForOwner } from "./workspace-credits.js";

export interface CreditTotals {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

export function sumCreditTotals(c: CreditTotals): number {
  return c.aiCredits + c.imageCredits + c.auditCredits;
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
