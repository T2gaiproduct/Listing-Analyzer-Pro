#!/usr/bin/env bash
# Idempotent Pro + multi-workspace customer for native auth (NATIVE_AUTH_ENABLED=true).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
DEV_EMAIL="${DEV_MULTI_WS_LOGIN_EMAIL:-multiws@local.test}"
DEV_PASSWORD="${DEV_MULTI_WS_LOGIN_PASSWORD:-DemoAudit!2026}"
DEV_USER_ID="${DEV_NATIVE_MULTI_WS_USER_ID:-user_dev_multiws_native01}"
OUT_FILE="${DEV_STACK_NATIVE_MULTI_WS_ENV_FILE:-/tmp/dev-stack-native-multi-ws.env}"

bash scripts/set-native-auth-password.sh "$DEV_USER_ID" "$DEV_EMAIL" "$DEV_PASSWORD" >/dev/null

SEED_MULTI_WS_EMAIL="$DEV_EMAIL" \
  pnpm --filter @workspace/api-server exec tsx src/cli/seed-dev-multi-workspace-account.ts "$DEV_USER_ID"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="$DEV_USER_ID" <<'SQL'
UPDATE admin_users SET is_deleted = 1 WHERE user_id = :'uid';
SQL

cat >"$OUT_FILE" <<EOF
DEV_NATIVE_MULTI_WS_USER_ID=$DEV_USER_ID
DEV_MULTI_WS_LOGIN_EMAIL=$DEV_EMAIL
EOF

echo "==> Native multi-workspace login ready: $DEV_EMAIL (userId=$DEV_USER_ID)" >&2
echo "    Password: $DEV_PASSWORD (override with DEV_MULTI_WS_LOGIN_PASSWORD)" >&2
echo "    Pro plan + default workspace + Client — Brand A / Brand B" >&2
echo "    Sign in at /sign-in when dev-stack runs with native auth enabled." >&2
