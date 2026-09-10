import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, creditTransactionsTable, workspacesTable } from "@workspace/db";

export async function ownedWorkspaceIdsForAccount(accountOwnerId: string): Promise<number[]> {
  const rows = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)));
  return rows.map((r) => r.id);
}

export async function assertWorkspaceOwnedByAccount(
  accountOwnerId: string,
  workspaceId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.id, workspaceId),
      eq(workspacesTable.accountOwnerId, accountOwnerId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .limit(1);
  return Boolean(row);
}

/** All transactions visible in billing usage for account vs one workspace. */
export async function creditTransactionsScopeWhere(
  accountOwnerId: string,
  scope: "account" | "workspace",
  workspaceId: number | null,
): Promise<SQL> {
  if (scope === "workspace" && workspaceId != null) {
    return eq(creditTransactionsTable.workspaceId, workspaceId);
  }
  const workspaceIds = await ownedWorkspaceIdsForAccount(accountOwnerId);
  const workspaceClause = workspaceIds.length > 0
    ? inArray(creditTransactionsTable.workspaceId, workspaceIds)
    : sql`false`;
  return or(
    workspaceClause,
    and(eq(creditTransactionsTable.userId, accountOwnerId), isNull(creditTransactionsTable.workspaceId)),
  )!;
}

export async function loadCreditUsageTransactions(
  accountOwnerId: string,
  scope: "account" | "workspace",
  workspaceId: number | null,
  limit: number,
) {
  const where = await creditTransactionsScopeWhere(accountOwnerId, scope, workspaceId);
  return db
    .select()
    .from(creditTransactionsTable)
    .where(where)
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(limit);
}
