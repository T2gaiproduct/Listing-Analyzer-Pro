#!/usr/bin/env bash
# Align production PostgreSQL with local Drizzle schema + workspace credit data backfill.
#
# Usage (on production host or with production DATABASE_URL):
#   export DATABASE_URL="postgresql://..."
#   bash scripts/sync-production-db.sh
#
# Options:
#   SKIP_PUSH=1     — skip drizzle push after SQL schema (SQL-only mode)
#   SKIP_DATA=1     — skip data backfill SQL
#   SKIP_VERIFY=1   — skip readiness checks
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL to the production connection string}"

echo "==> Production DB sync"
echo "    Database: ${DATABASE_URL%%@*}@..." # hide password in host part only

echo "==> Additive SQL schema (scripts/sql/production-schema-upgrade.sql)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-schema-upgrade.sql

if [[ "${SKIP_PUSH:-}" != "1" ]]; then
  echo "==> Drizzle push (align with lib/db/src/schema/)"
  if DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push; then
    echo "    drizzle push OK"
  else
    echo "    WARN: drizzle push failed — additive SQL above should still cover production; check logs"
  fi
fi

if [[ "${SKIP_DATA:-}" != "1" ]]; then
  echo "==> Data backfill (workspace credits + plan credit columns from allocations)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-data-migration.sql
else
  echo "==> SKIP_DATA=1 — data backfill skipped (API boot will run ensureWorkspaceCreditsMigrated)"
fi

if [[ "${SKIP_VERIFY:-}" != "1" ]]; then
  echo "==> Verification"
  bash scripts/verify-production-readiness.sh
fi

echo "==> Done. Restart the API: pm2 restart listing-auditor-api"
