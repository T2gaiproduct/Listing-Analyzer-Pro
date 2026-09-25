import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { creditTransactionsTable, workspaceMembersTable } from "@workspace/db";

/** Debits that count as feature usage (not plan funding or pool moves). */
export function creditUsageDebitFilters(): SQL[] {
  return [
    sql`${creditTransactionsTable.amount} < 0`,
    sql`coalesce(${creditTransactionsTable.featureType}, '') != 'subscription'`,
    sql`coalesce(${creditTransactionsTable.featureType}, '') != 'workspace_pool_transfer'`,
  ];
}

/**
 * Usage rows attributed to a workspace: explicit workspace_id, or legacy rows that only
 * stored workspaceMemberId in metadata when members spent assigned pool credits.
 */
export function transactionAttributedToWorkspace(workspaceId: number): SQL {
  const memberIdInWorkspace = sql`(
    select ${workspaceMembersTable.id}
    from ${workspaceMembersTable}
    where ${workspaceMembersTable.workspaceId} = ${workspaceId}
      and ${workspaceMembersTable.isDeleted} = 0
  )`;

  const legacyByWorkspaceMember = and(
    isNull(creditTransactionsTable.workspaceId),
    sql`(${creditTransactionsTable.metadata}->>'workspaceMemberId') ~ '^[0-9]+$'`,
    sql`(${creditTransactionsTable.metadata}->>'workspaceMemberId')::int in ${memberIdInWorkspace}`,
  );

  return or(
    eq(creditTransactionsTable.workspaceId, workspaceId),
    legacyByWorkspaceMember,
  )!;
}

/** Usage by a specific user within one workspace (billing team rows). */
export function transactionAttributedToWorkspaceUser(workspaceId: number, userId: string): SQL {
  return and(
    eq(creditTransactionsTable.userId, userId),
    or(
      eq(creditTransactionsTable.workspaceId, workspaceId),
      and(
        isNull(creditTransactionsTable.workspaceId),
        sql`exists (
          select 1 from ${workspaceMembersTable} wm
          where wm.workspace_id = ${workspaceId}
            and wm.user_id = ${userId}
            and wm.is_deleted = 0
            and wm.id = (${creditTransactionsTable.metadata}->>'workspaceMemberId')::int
        )`,
      ),
    ),
  )!;
}

/** Billing credit-usage list for one workspace (includes legacy attribution). */
export function workspaceCreditUsageScopeWhere(workspaceId: number): SQL {
  return transactionAttributedToWorkspace(workspaceId);
}

/** Account-level billing: all owned workspaces + owner personal account debits. */
export function accountCreditUsageScopeWhere(
  accountOwnerId: string,
  ownedWorkspaceIds: number[],
): SQL {
  const legacyInOwnedWorkspaces = ownedWorkspaceIds.length > 0
    ? and(
        isNull(creditTransactionsTable.workspaceId),
        sql`(${creditTransactionsTable.metadata}->>'workspaceMemberId') ~ '^[0-9]+$'`,
        sql`(${creditTransactionsTable.metadata}->>'workspaceMemberId')::int in (
          select ${workspaceMembersTable.id}
          from ${workspaceMembersTable}
          where ${inArray(workspaceMembersTable.workspaceId, ownedWorkspaceIds)}
            and ${workspaceMembersTable.isDeleted} = 0
        )`,
      )
    : sql`false`;

  const workspaceClause = ownedWorkspaceIds.length > 0
    ? or(inArray(creditTransactionsTable.workspaceId, ownedWorkspaceIds), legacyInOwnedWorkspaces)
    : sql`false`;

  return or(
    workspaceClause,
    and(eq(creditTransactionsTable.userId, accountOwnerId), isNull(creditTransactionsTable.workspaceId)),
  )!;
}
