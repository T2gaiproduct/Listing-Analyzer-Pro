#!/usr/bin/env tsx
/**
 * Import Clerk user export into auth_credentials + auth_oauth_identities.
 * Does NOT import passwords. Syncs login_email on user_profiles when missing.
 *
 * Usage:
 *   DATABASE_URL=... pnpm exec tsx scripts/import-clerk-auth-users.ts path/to/users.json
 *
 * Accepts JSON array or { "users": [...] } with Clerk-style fields.
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import {
  db,
  authCredentialsTable,
  authOauthIdentitiesTable,
  userProfilesTable,
} from "@workspace/db";

type ClerkEmail = {
  email_address?: string;
  verification?: { status?: string };
  id?: string;
};

type ClerkExternal = {
  provider?: string;
  provider_user_id?: string;
  identification_id?: string;
};

type ClerkUser = {
  id?: string;
  primary_email_address_id?: string;
  email_addresses?: ClerkEmail[];
  external_accounts?: ClerkExternal[];
};

function primaryEmail(user: ClerkUser): { email: string; verified: boolean } | null {
  const emails = user.email_addresses ?? [];
  const primaryId = user.primary_email_address_id;
  const primary =
    emails.find((e) => e.id === primaryId)?.email_address ??
    emails[0]?.email_address;
  if (!primary?.trim()) return null;
  const row = emails.find((e) => e.email_address === primary) ?? emails[0];
  const verified = row?.verification?.status === "verified";
  return { email: primary.trim().toLowerCase(), verified: !!verified };
}

function loadUsers(filePath: string): ClerkUser[] {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (Array.isArray(raw)) return raw as ClerkUser[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { users?: unknown }).users)) {
    return (raw as { users: ClerkUser[] }).users;
  }
  throw new Error("Expected JSON array or { users: [] }");
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx scripts/import-clerk-auth-users.ts <clerk-export.json>");
    process.exit(1);
  }
  const users = loadUsers(filePath);
  let imported = 0;
  let oauthLinks = 0;

  for (const user of users) {
    const userId = user.id?.trim();
    if (!userId) continue;
    const pe = primaryEmail(user);
    if (!pe) continue;

    await db
      .insert(authCredentialsTable)
      .values({
        userId,
        email: pe.email,
        emailVerified: pe.verified ? 1 : 0,
        passwordHash: null,
      })
      .onConflictDoUpdate({
        target: authCredentialsTable.userId,
        set: {
          email: pe.email,
          emailVerified: pe.verified ? 1 : 0,
          updatedAt: new Date(),
        },
      });
    imported += 1;

    const [profile] = await db
      .select({ loginEmail: userProfilesTable.loginEmail })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);
    if (!profile?.loginEmail) {
      await db
        .update(userProfilesTable)
        .set({ loginEmail: pe.email, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId));
    }

    for (const ext of user.external_accounts ?? []) {
      const provider = ext.provider ?? "";
      if (!provider.includes("google")) continue;
      const sub = ext.provider_user_id?.trim() || ext.identification_id?.trim();
      if (!sub) continue;
      await db
        .insert(authOauthIdentitiesTable)
        .values({ userId, provider: "google", providerAccountId: sub })
        .onConflictDoNothing();
      oauthLinks += 1;
    }
  }

  console.log(`Imported/updated ${imported} credentials, ${oauthLinks} Google links (attempted).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
