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

cat >"$OUT_FILE" <<EOF
DEV_NATIVE_USER_ID=$DEV_USER_ID
DEV_STACK_LOGIN_EMAIL=$DEV_EMAIL
ADMIN_USER_IDS=${ADMIN_USER_IDS:-$DEV_USER_ID}
VITE_ADMIN_USER_IDS=${VITE_ADMIN_USER_IDS:-$DEV_USER_ID}
EOF

echo "==> Dev native login ready: $DEV_EMAIL (userId=$DEV_USER_ID)" >&2
echo "    Password: $DEV_PASSWORD (override with DEV_STACK_LOGIN_PASSWORD)" >&2
