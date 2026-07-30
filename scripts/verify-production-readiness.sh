#!/usr/bin/env bash
# Quick production-readiness checks (run on server after deploy + schema upgrade).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
API_URL="${API_URL:-http://127.0.0.1:8080}"

echo "==> Schema columns (user_profiles)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'user_profiles'
     AND column_name IN ('login_email', 'notification_preferences')
   ORDER BY column_name;"

echo "==> Workspace tables"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('workspaces', 'workspace_roles', 'workspace_members', 'workspace_credits')
   ORDER BY tablename;"

echo "==> member_credits workspace scope columns"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'member_credits'
     AND column_name IN ('workspace_id', 'workspace_member_id')
   ORDER BY column_name;"

echo "==> credit_transactions.workspace_id"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'credit_transactions' AND column_name = 'workspace_id';"

LEGACY_MEMBER_CREDITS="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -c \
  "SELECT COUNT(*) FROM member_credits
   WHERE workspace_member_id IS NULL AND member_id IS NOT NULL;")"
echo "==> Legacy member_credits rows without workspace_member_id: ${LEGACY_MEMBER_CREDITS}"
if [[ "${LEGACY_MEMBER_CREDITS}" != "0" ]]; then
  echo "    WARN: run scripts/sql/production-data-migration.sql or restart API after workspace member sync"
fi

echo "==> API health"
curl -sf "$API_URL/api/healthz" | head -c 200
echo ""

echo "==> Public plans (no auth)"
curl -sf "$API_URL/api/plans" | head -c 120
echo ""

echo "OK — run member sign-in + dashboard test in the browser after this passes."
