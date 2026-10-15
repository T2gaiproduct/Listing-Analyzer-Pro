import { eq, sql } from "drizzle-orm";
import { db, authCredentialsTable, userProfilesTable } from "@workspace/db";

export type AuthCredentialRow = {
  userId: string;
  email: string;
  emailVerified: number;
  passwordHash: string | null;
};

export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const credentialSelect = {
  userId: authCredentialsTable.userId,
  email: authCredentialsTable.email,
  emailVerified: authCredentialsTable.emailVerified,
  passwordHash: authCredentialsTable.passwordHash,
};

/**
 * Resolve native auth by auth_credentials.email OR user_profiles.login_email (common after Clerk import).
 */
export async function findAuthCredentialByEmail(email: string): Promise<AuthCredentialRow | null> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return null;

  const [direct] = await db
    .select(credentialSelect)
    .from(authCredentialsTable)
    .where(sql`lower(${authCredentialsTable.email}) = ${normalized}`)
    .limit(1);
  if (direct) return direct;

  const [viaProfile] = await db
    .select(credentialSelect)
    .from(userProfilesTable)
    .innerJoin(authCredentialsTable, eq(userProfilesTable.userId, authCredentialsTable.userId))
    .where(sql`lower(${userProfilesTable.loginEmail}) = ${normalized}`)
    .limit(1);
  return viaProfile ?? null;
}

export async function findAuthCredentialUserIdByEmail(email: string): Promise<string | null> {
  const row = await findAuthCredentialByEmail(email);
  return row?.userId ?? null;
}

export function authCredentialEmailEquals(normalizedEmail: string) {
  return sql`lower(${authCredentialsTable.email}) = ${normalizeAuthEmail(normalizedEmail)}`;
}

/** Keep auth_credentials.email aligned with the address the user signs in with. */
export async function syncAuthCredentialEmail(userId: string, loginEmail: string): Promise<void> {
  const normalized = normalizeAuthEmail(loginEmail);
  if (!normalized) return;
  await db
    .update(authCredentialsTable)
    .set({ email: normalized, updatedAt: new Date() })
    .where(eq(authCredentialsTable.userId, userId));
}
