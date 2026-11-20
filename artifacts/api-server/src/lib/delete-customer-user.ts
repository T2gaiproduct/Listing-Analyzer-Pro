import { eq, or } from "drizzle-orm";
import {
  db,
  authCredentialsTable,
  authOauthIdentitiesTable,
  authSessionsTable,
  authPasswordResetTokensTable,
  authPasswordResetCodesTable,
  authEmailVerificationCodesTable,
  userProfilesTable,
  auditsTable,
  competitorsTable,
  creditsTable,
  creditTransactionsTable,
  subscriptionsTable,
  paymentsTable,
  invoicesTable,
  refundsTable,
  teamMembersTable,
  notificationsTable,
  pinnedProjectsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
  workspacesTable,
  workspaceMembersTable,
  amazonSellerConnectionsTable,
} from "@workspace/db";

/**
 * Remove a customer from Postgres (native auth). Projects are soft-deleted; auth rows are hard-deleted.
 */
export async function deleteCustomerUserFromDatabase(userId: string): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
    await tx.delete(authEmailVerificationCodesTable).where(eq(authEmailVerificationCodesTable.userId, userId));
    await tx.delete(authPasswordResetCodesTable).where(eq(authPasswordResetCodesTable.userId, userId));
    await tx.delete(authPasswordResetTokensTable).where(eq(authPasswordResetTokensTable.userId, userId));
    await tx.delete(authOauthIdentitiesTable).where(eq(authOauthIdentitiesTable.userId, userId));
    await tx.delete(authCredentialsTable).where(eq(authCredentialsTable.userId, userId));

    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    await tx.delete(pinnedProjectsTable).where(eq(pinnedProjectsTable.userId, userId));

    await tx
      .update(auditsTable)
      .set({ isDeleted: 1, deletedAt: now })
      .where(eq(auditsTable.userId, userId));

    const ownedAudits = await tx
      .select({ id: auditsTable.id })
      .from(auditsTable)
      .where(eq(auditsTable.userId, userId));
    for (const a of ownedAudits) {
      await tx
        .update(competitorsTable)
        .set({ isDeleted: 1, deletedAt: now })
        .where(eq(competitorsTable.auditId, a.id));
    }

    await tx
      .update(graphicsProjectsTable)
      .set({ isDeleted: 1, deletedAt: now })
      .where(eq(graphicsProjectsTable.userId, userId));
    await tx
      .update(videosProjectsTable)
      .set({ isDeleted: 1, deletedAt: now })
      .where(eq(videosProjectsTable.userId, userId));
    await tx
      .update(adsProjectsTable)
      .set({ isDeleted: 1, deletedAt: now })
      .where(eq(adsProjectsTable.userId, userId));

    await tx.delete(creditTransactionsTable).where(eq(creditTransactionsTable.userId, userId));
    await tx.delete(creditsTable).where(eq(creditsTable.userId, userId));
    await tx.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    await tx.delete(paymentsTable).where(eq(paymentsTable.userId, userId));
    await tx.delete(invoicesTable).where(eq(invoicesTable.userId, userId));
    await tx.delete(refundsTable).where(eq(refundsTable.userId, userId));

    await tx
      .delete(teamMembersTable)
      .where(or(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.memberUserId, userId)));
    await tx.delete(amazonSellerConnectionsTable).where(eq(amazonSellerConnectionsTable.userId, userId));

    await tx
      .update(workspacesTable)
      .set({ isDeleted: 1, deletedAt: now })
      .where(eq(workspacesTable.accountOwnerId, userId));

    await tx.delete(workspaceMembersTable).where(eq(workspaceMembersTable.userId, userId));

    await tx.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  });
}