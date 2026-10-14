import { sql } from "drizzle-orm";
import { db, authCredentialsTable } from "@workspace/db";

export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Case-insensitive lookup (backfilled rows may differ in casing). */
export async function findAuthCredentialByEmail(
  email: string,
): Promise<{ userId: string; email: string; emailVerified: number; passwordHash: string | null } | null> {
  const normalized = normalizeAuthEmail(email);
  const [row] = await db
    .select({
      userId: authCredentialsTable.userId,
      email: authCredentialsTable.email,
      emailVerified: authCredentialsTable.emailVerified,
      passwordHash: authCredentialsTable.passwordHash,
    })
    .from(authCredentialsTable)
    .where(sql`lower(${authCredentialsTable.email}) = ${normalized}`)
    .limit(1);
  return row ?? null;
}

/** For updates/deletes that must target the exact stored row. */
export async function findAuthCredentialUserIdByEmail(email: string): Promise<string | null> {
  const row = await findAuthCredentialByEmail(email);
  return row?.userId ?? null;
}

export function authCredentialEmailEquals(normalizedEmail: string) {
  return sql`lower(${authCredentialsTable.email}) = ${normalizeAuthEmail(normalizedEmail)}`;
}

/** Drizzle eq() helper when email is already normalized. */