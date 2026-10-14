-- Backfill native auth rows for EXISTING Seller Lens users (same user_id → audits/credits/workspaces unchanged).
--
-- Run AFTER production-schema-upgrade.sql created auth_credentials.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/backfill-auth-credentials.sql
--
-- Passwords:
--   - Clerk exports do NOT include password hashes. Use password_hash NULL here;
--     users set a password via "Forgot password" or sign in with Google after you link OAuth.
--   - Native login only accepts hashes from this app: scrypt$<salt_hex>$<derived_hex>
--     (see artifacts/api-server/src/lib/native-auth/password.ts).
--   - Do NOT paste bcrypt ($2a$...) or Clerk digests unless you add verifier support in code.

BEGIN;

-- 1) One row per existing profile with a login email (no password until you set it)
INSERT INTO auth_credentials (user_id, email, email_verified, password_hash, created_at, updated_at)
SELECT
  up.user_id,
  lower(trim(up.login_email)) AS email,
  1 AS email_verified,
  NULL AS password_hash,
  COALESCE(up.created_at, now()) AS created_at,
  now() AS updated_at
FROM user_profiles up
WHERE up.login_email IS NOT NULL
  AND trim(up.login_email) <> ''
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  email_verified = GREATEST(auth_credentials.email_verified, EXCLUDED.email_verified),
  updated_at = now();

-- 2) Optional: profiles missing login_email but you have email elsewhere — fix manually first.

COMMIT;

-- ─── Single user with password hash (run separately, replace placeholders) ───
-- INSERT INTO auth_credentials (user_id, email, email_verified, password_hash, created_at, updated_at)
-- VALUES (
--   'user_XXXXXXXXXXXXXXXXXXXXXXXX',
--   lower('person@example.com'),
--   1,
--   'scrypt$<64-char-salt-hex>$<128-char-hash-hex>',
--   now(),
--   now()
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   email = EXCLUDED.email,
--   email_verified = EXCLUDED.email_verified,
--   password_hash = EXCLUDED.password_hash,
--   updated_at = now();
--
-- UPDATE user_profiles
-- SET login_email = lower('person@example.com'), updated_at = now()
-- WHERE user_id = 'user_XXXXXXXXXXXXXXXXXXXXXXXX';
