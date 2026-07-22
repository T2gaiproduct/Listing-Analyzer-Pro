import { and, eq, isNull } from "drizzle-orm";
import { db, adminInvitesTable, adminRolesTable, adminUsersTable } from "@workspace/db";
import { generateAdminInviteToken } from "./admin-invite-token.js";
import { upsertUserProfile } from "./user-profile.js";

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

export interface AdminInviteAcceptResult {
  accepted: boolean;
  alreadyAccepted?: boolean;
  roleName?: string;
  permissions?: string[];
}

/** Accept a pending admin invite by token and grant admin access. */
export async function acceptAdminInviteByToken(
  userId: string,
  token: string,
  opts?: { verifyEmail?: string | null },
): Promise<AdminInviteAcceptResult> {
  const [invite] = await db
    .select({
      id: adminInvitesTable.id,
      email: adminInvitesTable.email,
      roleId: adminInvitesTable.roleId,
      acceptedAt: adminInvitesTable.acceptedAt,
      acceptedUserId: adminInvitesTable.acceptedUserId,
      roleName: adminRolesTable.name,
      permissions: adminRolesTable.permissions,
    })
    .from(adminInvitesTable)
    .innerJoin(adminRolesTable, eq(adminInvitesTable.roleId, adminRolesTable.id))
    .where(eq(adminInvitesTable.inviteToken, token))
    .limit(1);

  if (!invite) return { accepted: false };

  if (invite.acceptedAt) {
    if (invite.acceptedUserId === userId) {
      return {
        accepted: true,
        alreadyAccepted: true,
        roleName: invite.roleName,
        permissions: invite.permissions ?? [],
      };
    }
    return { accepted: false };
  }

  if (opts?.verifyEmail) {
    const normalized = normalizeAdminEmail(opts.verifyEmail);
    if (normalized !== normalizeAdminEmail(invite.email)) {
      throw new Error(`This invite was sent to ${invite.email}. Sign in with that email to accept.`);
    }
  }

  await db.insert(adminUsersTable)
    .values({ userId, roleId: invite.roleId })
    .onConflictDoUpdate({ target: adminUsersTable.userId, set: { roleId: invite.roleId } });

  await db.update(adminInvitesTable)
    .set({ acceptedAt: new Date(), acceptedUserId: userId })
    .where(eq(adminInvitesTable.id, invite.id));

  await upsertUserProfile(userId, { onboardingCompleted: true });

  return {
    accepted: true,
    roleName: invite.roleName,
    permissions: invite.permissions ?? [],
  };
}

export async function ensureAdminInviteToken(inviteId: number): Promise<string | null> {
  const [invite] = await db.select().from(adminInvitesTable).where(eq(adminInvitesTable.id, inviteId)).limit(1);
  if (!invite) return null;
  if (invite.inviteToken) return invite.inviteToken;
  const token = generateAdminInviteToken();
  await db.update(adminInvitesTable).set({ inviteToken: token }).where(eq(adminInvitesTable.id, inviteId));
  return token;
}
