#!/usr/bin/env bash
# Idempotent dev user for local / Cloud Agent stacks (NATIVE_AUTH_ENABLED=true).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
DEV_EMAIL="${DEV_STACK_LOGIN_EMAIL:-dev@local.test}"
DEV_PASSWORD="${DEV_STACK_LOGIN_PASSWORD:-DevAudit!2026}"
DEV_USER_ID="${DEV_NATIVE_USER_ID:-user_devstack_local01}"
OUT_FILE="${DEV_STACK_NATIVE_ENV_FILE:-/tmp/dev-stack-native-login.env}"

bash scripts/set-native-auth-password.sh "$DEV_USER_ID" "$DEV_EMAIL" "$DEV_PASSWORD" >/dev/null

# Profile + credits so sign-in goes straight to the dashboard (no onboarding wall, enough credits to audit/generate).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="$DEV_USER_ID" -v email="$DEV_EMAIL" <<'SQL'
INSERT INTO credits (user_id, ai_credits, image_credits, audit_credits, updated_at)
VALUES (:'uid', 500, 500, 500, now())
ON CONFLICT (user_id) DO UPDATE SET
  ai_credits = GREATEST(credits.ai_credits, EXCLUDED.ai_credits),
  image_credits = GREATEST(credits.image_credits, EXCLUDED.image_credits),
  audit_credits = GREATEST(credits.audit_credits, EXCLUDED.audit_credits),
  updated_at = now();

UPDATE user_profiles
SET
  login_email = :'email',
  full_name = COALESCE(NULLIF(trim(full_name), ''), 'Dev Tester'),
  company_name = COALESCE(NULLIF(trim(company_name), ''), 'Local Test Co'),
  onboarding_completed = true,
  updated_at = now()
WHERE user_id = :'uid';

-- Dev test account is a normal customer (not Super Admin).
UPDATE admin_users SET is_deleted = 1 WHERE user_id = :'uid';
SQL

cat >"$OUT_FILE" <<EOF
DEV_NATIVE_USER_ID=$DEV_USER_ID
DEV_STACK_LOGIN_EMAIL=$DEV_EMAIL
EOF

echo "==> Dev native login ready: $DEV_EMAIL (userId=$DEV_USER_ID)" >&2
echo "    Password: $DEV_PASSWORD (override with DEV_STACK_LOGIN_PASSWORD)" >&2
echo "    Credits: 500 audit / 500 image / 500 AI — onboarding complete (customer dashboard, not admin)" >&2
