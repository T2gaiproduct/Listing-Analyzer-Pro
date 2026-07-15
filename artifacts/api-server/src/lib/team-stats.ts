import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, creditTransactionsTable, memberCreditsTable, teamMembersTable } from "@workspace/db";

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
    sql`(${creditTransactionsTable.creditType} = 'audit' OR ${creditTransactionsTable.featureType} IN ('audit', 'competitor'))`,
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
  const members = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, ownerUserId), eq(teamMembersTable.status, "active")));

  const memberIds = members.map((m) => m.id).filter((id) => id !== excludeMemberId);
  if (memberIds.length === 0) {
    return { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  }

  const rows = memberIds.length
    ? await db.select().from(memberCreditsTable).where(inArray(memberCreditsTable.memberId, memberIds))
    : [];

  return rows.reduce(
    (acc, row) => ({
      aiCredits: acc.aiCredits + row.aiCredits,
      imageCredits: acc.imageCredits + row.imageCredits,
      auditCredits: acc.auditCredits + row.auditCredits,
    }),
    { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
  );
}
