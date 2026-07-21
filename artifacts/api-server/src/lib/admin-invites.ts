import { and, eq, isNull } from "drizzle-orm";
import { db, adminInvitesTable, adminUsersTable } from "@workspace/db";

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** If a pending invite exists for this email, grant admin_users and mark invite accepted. */
export async function acceptAdminInviteForUser(userId: string, email?: string | null): Promise<boolean> {
  const normalized = email ? normalizeAdminEmail(email) : "";
  if (!normalized) return false;

  const [invite] = await db
    .select()
    .from(adminInvitesTable)
    .where(and(eq(adminInvitesTable.email, normalized), isNull(adminInvitesTable.acceptedAt)))
    .limit(1);

  if (!invite) return false;

  await db.insert(adminUsersTable)
    .values({ userId, roleId: invite.roleId })
    .onConflictDoUpdate({ target: adminUsersTable.userId, set: { roleId: invite.roleId } });

  await db.update(adminInvitesTable)
    .set({ acceptedAt: new Date(), acceptedUserId: userId })
    .where(eq(adminInvitesTable.id, invite.id));

  return true;
}
