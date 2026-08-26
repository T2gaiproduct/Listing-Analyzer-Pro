#!/usr/bin/env bash
# Copy production PostgreSQL into the local dev database, then align with codebase schema.
#
# Usage:
#   export PRODUCTION_DATABASE_URL="postgresql://user:pass@host:5432/listingauditor"
#   bash scripts/sync-local-from-production.sh
#
# Options:
#   SYNC_DATA=0     — schema/compare only (no pg_dump restore); default is 1
#   SKIP_COMPARE=1  — skip compare-db-to-local.sh at the end
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PRODUCTION_DATABASE_URL="${PRODUCTION_DATABASE_URL:-${TARGET_DATABASE_URL:-}}"
LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
SYNC_DATA="${SYNC_DATA:-1}"
SKIP_COMPARE="${SKIP_COMPARE:-}"

if [[ -z "$PRODUCTION_DATABASE_URL" ]]; then
  echo "ERROR: Set PRODUCTION_DATABASE_URL (or TARGET_DATABASE_URL) to the production connection string." >&2
  exit 1
fi

if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

echo "==> Local DB sync from production"
echo "    Production: ${PRODUCTION_DATABASE_URL%%@*}@..."
echo "    Local:      ${LOCAL_DATABASE_URL%%@*}@..."

echo "==> Align local with codebase schema (additive)"
export DATABASE_URL="$LOCAL_DATABASE_URL"
bash scripts/sync-local-db.sh

if [[ "$SYNC_DATA" == "1" ]]; then
  echo "==> Restoring production dump into local (schema + data)"
  pg_dump "$PRODUCTION_DATABASE_URL" --no-owner --no-acl --clean --if-exists \
    | psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1

  echo "==> Re-apply additive schema after restore"
  bash scripts/sync-local-db.sh
fi

echo "==> Sync default agents to all workspaces"
DATABASE_URL="$LOCAL_DATABASE_URL" pnpm run db:sync-default-agents

if [[ "$SKIP_COMPARE" != "1" ]]; then
  echo "==> Compare production schema vs local reference"
  LOCAL_DATABASE_URL="$LOCAL_DATABASE_URL" TARGET_DATABASE_URL="$PRODUCTION_DATABASE_URL" \
    bash scripts/compare-db-to-local.sh || {
      echo "WARN: production schema is behind local codebase — run bash scripts/sync-production-db.sh on the server"
    }
fi

echo "==> Done — local database synced from production"
