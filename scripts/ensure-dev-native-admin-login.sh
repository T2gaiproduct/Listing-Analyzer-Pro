#!/usr/bin/env bash
# Idempotent Super Admin dev login (native auth) — separate from customer dev@local.test.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
ADMIN_EMAIL="${DEV_STACK_ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${DEV_STACK_ADMIN_PASSWORD:-DevAdmin!2026}"
ADMIN_USER_ID="${DEV_NATIVE_ADMIN_USER_ID:-user_devstack_admin01}"
OUT_FILE="${DEV_STACK_NATIVE_ADMIN_ENV_FILE:-/tmp/dev-stack-native-admin.env}"

bash scripts/set-native-auth-password.sh "$ADMIN_USER_ID" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" >/dev/null
bash scripts/grant-super-admin.sh "$ADMIN_USER_ID" "$ADMIN_EMAIL" >/dev/null

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="$ADMIN_USER_ID" -v email="$ADMIN_EMAIL" <<'SQL'
UPDATE user_profiles
SET
  login_email = :'email',
  full_name = COALESCE(NULLIF(trim(full_name), ''), 'Dev Super Admin'),
  company_name = COALESCE(NULLIF(trim(company_name), ''), 'Platform Admin'),
  onboarding_completed = true,
  updated_at = now()
WHERE user_id = :'uid';
SQL

cat >"$OUT_FILE" <<EOF
DEV_NATIVE_ADMIN_USER_ID=$ADMIN_USER_ID
DEV_STACK_ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_USER_IDS=$ADMIN_USER_ID
VITE_ADMIN_USER_IDS=$ADMIN_USER_ID
EOF

echo "==> Dev Super Admin login: $ADMIN_EMAIL (userId=$ADMIN_USER_ID)" >&2
echo "    Password: $ADMIN_PASSWORD (override with DEV_STACK_ADMIN_PASSWORD)" >&2
echo "    Opens /admin after sign-in (VITE_ADMIN_USER_IDS on next frontend build)" >&2
