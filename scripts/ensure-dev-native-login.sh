#!/usr/bin/env bash
# Idempotent dev user for local / Cloud Agent stacks (NATIVE_AUTH_ENABLED=true).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
DEV_EMAIL="${DEV_STACK_LOGIN_EMAIL:-dev@local.test}"
DEV_PASSWORD="${DEV_STACK_LOGIN_PASSWORD:-DevAudit!2026}"
OUT_FILE="${DEV_STACK_NATIVE_ENV_FILE:-/tmp/dev-stack-native-login.env}"

resolve_dev_native_user_id() {
  if [[ -n "${DEV_NATIVE_USER_ID:-}" ]]; then
    echo "$DEV_NATIVE_USER_ID"
    return
  fi
  local legacy=""
  legacy=$(psql "$DATABASE_URL" -tA -c "
    SELECT user_id FROM audits
    WHERE is_deleted = 0
      AND user_id NOT LIKE 'user_devstack%'
      AND user_id NOT LIKE 'user_dev_%'
      AND user_id LIKE 'user_%'
    GROUP BY user_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  " 2>/dev/null || true)
  legacy=$(echo "$legacy" | tr -d '[:space:]')
  if [[ -n "$legacy" ]]; then
    echo "$legacy"
  else
    echo "user_devstack_local01"
  fi
}

DEV_USER_ID="$(resolve_dev_native_user_id)"

# Re-home dev@local.test onto the account that already owns local projects (ex-Clerk user id).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="$DEV_USER_ID" -v email="$DEV_EMAIL" <<'SQL'
DELETE FROM auth_credentials
WHERE lower(email) = lower(:'email') AND user_id <> :'uid';
SQL

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

pnpm --filter @workspace/api-server exec tsx src/cli/seed-dev-customer-account.ts "$DEV_USER_ID" >/dev/null

cat >"$OUT_FILE" <<EOF
DEV_NATIVE_USER_ID=$DEV_USER_ID
DEV_STACK_LOGIN_EMAIL=$DEV_EMAIL
EOF

echo "==> Dev native login ready: $DEV_EMAIL (userId=$DEV_USER_ID)" >&2
echo "    Password: $DEV_PASSWORD (override with DEV_STACK_LOGIN_PASSWORD)" >&2
echo "    Free plan (DB \$0 tier) + default workspace seeded — customer dashboard, not admin" >&2
