-- Check active password reset row for a user (replace placeholders, then run with psql).
--
-- Example:
--   psql "$DATABASE_URL" -f scripts/sql/check-password-reset-code.sql
-- Edit user_id and the code in hash_matches before running.

SELECT
  user_id,
  email,
  created_at,
  expires_at,
  (expires_at > now()) AS still_valid,
  code_hash = encode(digest('password-reset:668038', 'sha256'), 'hex') AS hash_matches_example_code
FROM auth_password_reset_codes
WHERE user_id = 'user_5a2f66e47e20a3d36c691aa7';
