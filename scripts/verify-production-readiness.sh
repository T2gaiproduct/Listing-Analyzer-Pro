#!/usr/bin/env bash
# Quick production-readiness checks (run on server after deploy + schema upgrade).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"
API_URL="${API_URL:-http://127.0.0.1:8080}"

echo "==> Schema columns"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'user_profiles'
     AND column_name IN ('login_email', 'notification_preferences')
   ORDER BY column_name;"

echo "==> Workspace tables"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c \
  "SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('workspaces', 'workspace_roles', 'workspace_members')
   ORDER BY tablename;"

echo "==> API health"
curl -sf "$API_URL/api/healthz" | head -c 200
echo ""

echo "==> Public plans (no auth)"
curl -sf "$API_URL/api/plans" | head -c 120
echo ""

echo "OK — run member sign-in + dashboard test in the browser after this passes."
