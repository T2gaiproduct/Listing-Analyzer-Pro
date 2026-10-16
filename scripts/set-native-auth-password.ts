/**
 * Upsert native auth_credentials for an existing admin Clerk user id (native auth deployments).
 *
 *   export DATABASE_URL=postgresql://...
 *   pnpm exec tsx scripts/set-native-auth-password.ts USER_ID email@example.com 'Password'
 *
 * Use ensure-clerk-admin-login.sh when VITE_AUTH_PROVIDER is not "native" (default Clerk UI).
 */
import { eq } from "drizzle-orm";
import { db, authCredentialsTable } from "@workspace/db";
import { hashPassword } from "../artifacts/api-server/src/lib/native-auth/password.js";
import { upsertUserProfile } from "../artifacts/api-server/src/lib/user-profile.js";

const userId = process.argv[2]?.trim();
const email = process.argv[3]?.trim().toLowerCase();
const password = process.argv[4];

if (!userId || !email || !password) {
  console.error("Usage: set-native-auth-password.ts USER_ID email@example.com 'Password'");
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const [existing] = await db
  .select({ userId: authCredentialsTable.userId })
  .from(authCredentialsTable)
  .where(eq(authCredentialsTable.userId, userId))
  .limit(1);

if (existing) {
  await db
    .update(authCredentialsTable)
    .set({ email, passwordHash, emailVerified: 1, updatedAt: new Date() })
    .where(eq(authCredentialsTable.userId, userId));
} else {
  await db.insert(authCredentialsTable).values({
    userId,
    email,
    passwordHash,
    emailVerified: 1,
  });
}

await upsertUserProfile(userId, { loginEmail: email });
console.log(`OK — native auth password set for ${email} (userId=${userId}, email_verified=1)`);
