#!/usr/bin/env bash
# Align local PostgreSQL with lib/db/src/schema (product tables, ads_projects, etc.).
#
# Usage:
#   bash scripts/sync-local-db.sh
#
# Options:
#   SKIP_PUSH=1     — skip drizzle push after additive SQL
#   SKIP_SEED=1     — skip seed-plans
#   SKIP_VERIFY=1   — skip schema verification
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"

echo "==> Local DB sync"
echo "    Database: ${DATABASE_URL%%@*}@..."

if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

echo "==> Additive SQL schema (scripts/sql/production-schema-upgrade.sql)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-schema-upgrade.sql

if [[ -f scripts/sql/schema-from-local.sql ]]; then
  echo "==> Additive SQL from local snapshot (scripts/sql/schema-from-local.sql)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/schema-from-local.sql
fi

if [[ "${SKIP_PUSH:-}" != "1" ]]; then
  echo "==> Drizzle push (align with lib/db/src/schema/)"
  DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push
fi

if [[ "${SKIP_SEED:-}" != "1" ]]; then
  echo "==> Seed plans (if empty)"
  DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run seed-plans || {
    echo "    WARN: seed-plans failed or already seeded"
  }
fi

if [[ "${SKIP_VERIFY:-}" != "1" ]]; then
  echo "==> Verification"
  DATABASE_URL="$DATABASE_URL" bash scripts/check-production-schema.sh
fi

echo "==> Local DB sync complete"
