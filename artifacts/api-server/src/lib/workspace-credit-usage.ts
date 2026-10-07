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

const NUMERIC_WORKSPACE_MEMBER_ID = sql`(
  ${creditTransactionsTable.metadata}->>'workspaceMemberId'
) ~ '^[0-9]+$'`;

function metadataWorkspaceMemberId(): SQL {
  return sql`(${creditTransactionsTable.metadata}->>'workspaceMemberId')::int`;
}

function workspaceMemberIdsInWorkspace(workspaceId: number): SQL {
  return sql`(
    select ${workspaceMembersTable.id}
    from ${workspaceMembersTable}
    where ${workspaceMembersTable.workspaceId} = ${workspaceId}
  )`;
}

function chargedViaWorkspaceMember(workspaceId: number): SQL {
  return and(
    NUMERIC_WORKSPACE_MEMBER_ID,
    sql`${metadataWorkspaceMemberId()} in ${workspaceMemberIdsInWorkspace(workspaceId)}`,
  )!;
}

/**
 * Attribute usage to the workspace whose member/pool was actually charged.
 * Member-pool debits (metadata.workspaceMemberId) win over a mismatched workspace_id
 * so spend is not counted on the header workspace instead of the funded pool.
 */
export function transactionAttributedToWorkspace(workspaceId: number): SQL {
  const viaMember = chargedViaWorkspaceMember(workspaceId);
  const viaWorkspaceId = and(
    eq(creditTransactionsTable.workspaceId, workspaceId),
    or(
      sql`not (${NUMERIC_WORKSPACE_MEMBER_ID})`,
      sql`${metadataWorkspaceMemberId()} in ${workspaceMemberIdsInWorkspace(workspaceId)}`,
    ),
  );

  return or(viaMember, viaWorkspaceId)!;
}

/** Usage charged to one workspace_members row (assigned member pool). */
export function transactionAttributedToWorkspaceMember(workspaceMemberId: number): SQL {
  return and(
    NUMERIC_WORKSPACE_MEMBER_ID,
    sql`${metadataWorkspaceMemberId()} = ${workspaceMemberId}`,
  )!;
}

/** Usage by a specific user within one workspace (billing team rows). */
export function transactionAttributedToWorkspaceUser(workspaceId: number, userId: string): SQL {
  return and(
    eq(creditTransactionsTable.userId, userId),
    transactionAttributedToWorkspace(workspaceId),
  )!;
}

/** Billing credit-usage list for one workspace (includes member-pool attribution). */
export function workspaceCreditUsageScopeWhere(workspaceId: number): SQL {
  return transactionAttributedToWorkspace(workspaceId);
}

/** Account-level billing: owned workspaces (exclusive member attribution) + owner personal. */
export function accountCreditUsageScopeWhere(
  accountOwnerId: string,
  ownedWorkspaceIds: number[],
): SQL {
  const memberInOwned = ownedWorkspaceIds.length > 0
    ? sql`${metadataWorkspaceMemberId()} in (
        select ${workspaceMembersTable.id}
        from ${workspaceMembersTable}
        where ${inArray(workspaceMembersTable.workspaceId, ownedWorkspaceIds)}
      )`
    : sql`false`;

  const chargedViaMember = and(NUMERIC_WORKSPACE_MEMBER_ID, memberInOwned);

  const chargedViaWorkspaceId = ownedWorkspaceIds.length > 0
    ? and(
        inArray(creditTransactionsTable.workspaceId, ownedWorkspaceIds),
        or(sql`not (${NUMERIC_WORKSPACE_MEMBER_ID})`, memberInOwned),
      )
    : sql`false`;

  const ownerPersonal = and(
    eq(creditTransactionsTable.userId, accountOwnerId),
    isNull(creditTransactionsTable.workspaceId),
    sql`not (${NUMERIC_WORKSPACE_MEMBER_ID})`,
  );

  return or(chargedViaMember, chargedViaWorkspaceId, ownerPersonal)!;
}
