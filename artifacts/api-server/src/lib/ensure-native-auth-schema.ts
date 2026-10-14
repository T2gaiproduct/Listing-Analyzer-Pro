import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { isNativeAuthEnabled } from "./native-auth/config.js";

let migrated = false;
let migratePromise: Promise<void> | null = null;

async function runNativeAuthSchemaSql(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_credentials (
      user_id text PRIMARY KEY,
      email varchar(255) NOT NULL,
      email_verified integer NOT NULL DEFAULT 0,
      password_hash text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_credentials_email_idx ON auth_credentials (lower(email))
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_oauth_identities (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id text NOT NULL,
      provider varchar(32) NOT NULL,
      provider_account_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_account_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_oauth_identities_user_id_idx ON auth_oauth_identities (user_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_email_verification_codes (
      user_id text PRIMARY KEY,
      email varchar(255) NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_email_verification_codes_email_idx
      ON auth_email_verification_codes (lower(email))
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_password_reset_codes (
      user_id text PRIMARY KEY,
      email varchar(255) NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_password_reset_codes_email_idx
      ON auth_password_reset_codes (lower(email))
  `);
}

/** Idempotent native-auth tables (safe on every boot when native auth is enabled). */
export async function ensureNativeAuthSchemaMigrated(): Promise<void> {
  if (!isNativeAuthEnabled()) return;
  if (migrated) return;
  if (migratePromise) {
    await migratePromise;
    return;
  }
  migratePromise = runNativeAuthSchemaSql()
    .then(() => {
      migrated = true;
    })
    .finally(() => {
      migratePromise = null;
    });
  await migratePromise;
}
