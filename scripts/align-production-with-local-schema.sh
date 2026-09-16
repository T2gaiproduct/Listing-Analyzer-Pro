#!/usr/bin/env bash
# Keep production PostgreSQL aligned with the local reference schema (lib/db + local DB).
#
# Developer machine (refresh committed SQL snapshot from local):
#   bash scripts/align-production-with-local-schema.sh
#
# Production host (apply snapshot + drizzle to live DB):
#   export DATABASE_URL="postgresql://..."   # or PRODUCTION_DATABASE_URL
#   bash scripts/align-production-with-local-schema.sh --apply-production
#
# Verify only (no writes):
#   export TARGET_DATABASE_URL="postgresql://..."
#   bash scripts/align-production-with-local-schema.sh --verify-only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APPLY_PRODUCTION=0
VERIFY_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --apply-production) APPLY_PRODUCTION=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${PRODUCTION_DATABASE_URL:-${DATABASE_URL:-}}}"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  if [[ -z "$TARGET_DATABASE_URL" ]]; then
    echo "ERROR: Set TARGET_DATABASE_URL or PRODUCTION_DATABASE_URL for --verify-only." >&2
    exit 1
  fi
  export LOCAL_DATABASE_URL
  export TARGET_DATABASE_URL
  bash scripts/compare-db-to-local.sh
  exit 0
fi

if [[ "$APPLY_PRODUCTION" == "1" ]]; then
  if [[ -z "$TARGET_DATABASE_URL" ]]; then
    echo "ERROR: Set DATABASE_URL or PRODUCTION_DATABASE_URL for --apply-production." >&2
    exit 1
  fi
  echo "==> Applying production schema sync (additive SQL + drizzle push + data backfill)"
  DATABASE_URL="$TARGET_DATABASE_URL" bash scripts/sync-production-db.sh
  echo "==> Comparing production to local reference columns"
  export LOCAL_DATABASE_URL
  export TARGET_DATABASE_URL
  bash scripts/compare-db-to-local.sh || {
    echo "WARN: column-level drift may remain — inspect output and re-run sync or drizzle push on the server."
    exit 1
  }
  echo "==> Production schema matches local reference. Restart the API process."
  exit 0
fi

echo "==> Step 1: Align local DB with lib/db/src/schema"
DATABASE_URL="$LOCAL_DATABASE_URL" bash scripts/sync-local-db.sh

echo "==> Step 2: Regenerate scripts/sql/schema-from-local.sql from local"
LOCAL_DATABASE_URL="$LOCAL_DATABASE_URL" bash scripts/generate-additive-schema-from-local.sh

echo ""
echo "==> Local reference is up to date."
echo "    Commit scripts/sql/schema-from-local.sql if it changed, deploy code, then on production:"
echo "      export DATABASE_URL=\"postgresql://...\""
echo "      bash scripts/align-production-with-local-schema.sh --apply-production"
echo "    Or: pnpm db:align-production-with-local -- --apply-production"
