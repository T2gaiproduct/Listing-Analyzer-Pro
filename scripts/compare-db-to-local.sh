#!/usr/bin/env bash
# Compare a target database schema (e.g. production) against the local reference DB.
#
# Usage:
#   export LOCAL_DATABASE_URL="postgresql://lauser:lapass@127.0.0.1:5432/listingauditor"
#   export TARGET_DATABASE_URL="postgresql://..."   # production
#   bash scripts/compare-db-to-local.sh
#
# Exits 0 when target has every table/column present in local; 1 when drift exists.
set -euo pipefail

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${PRODUCTION_DATABASE_URL:-}}"

if [[ -z "$TARGET_DATABASE_URL" ]]; then
  echo "ERROR: Set TARGET_DATABASE_URL or PRODUCTION_DATABASE_URL to the production connection string." >&2
  exit 1
fi

dump_cols() {
  psql "$1" -v ON_ERROR_STOP=1 -t -A -c \
    "SELECT table_name || ':' || column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY 1;"
}

dump_tables() {
  psql "$1" -v ON_ERROR_STOP=1 -t -A -c \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;"
}

echo "==> Comparing schemas"
echo "    Local:  ${LOCAL_DATABASE_URL%%@*}@..."
echo "    Target: ${TARGET_DATABASE_URL%%@*}@..."

LOCAL_COLS="$(mktemp)"
TARGET_COLS="$(mktemp)"
LOCAL_TABLES="$(mktemp)"
TARGET_TABLES="$(mktemp)"
trap 'rm -f "$LOCAL_COLS" "$TARGET_COLS" "$LOCAL_TABLES" "$TARGET_TABLES"' EXIT

dump_cols "$LOCAL_DATABASE_URL" >"$LOCAL_COLS"
dump_cols "$TARGET_DATABASE_URL" >"$TARGET_COLS"
dump_tables "$LOCAL_DATABASE_URL" >"$LOCAL_TABLES"
dump_tables "$TARGET_DATABASE_URL" >"$TARGET_TABLES"

missing_tables=()
while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  if ! grep -qxF "$table" "$TARGET_TABLES"; then
    missing_tables+=("$table")
  fi
done <"$LOCAL_TABLES"

missing_columns=()
while IFS= read -r col; do
  [[ -z "$col" ]] && continue
  if ! grep -qxF "$col" "$TARGET_COLS"; then
    missing_columns+=("$col")
  fi
done <"$LOCAL_COLS"

extra_columns=()
while IFS= read -r col; do
  [[ -z "$col" ]] && continue
  if ! grep -qxF "$col" "$LOCAL_COLS"; then
    extra_columns+=("$col")
  fi
done <"$TARGET_COLS"

if [[ ${#missing_tables[@]} -eq 0 && ${#missing_columns[@]} -eq 0 ]]; then
  echo "OK — target schema includes all local tables/columns."
  if [[ ${#extra_columns[@]} -gt 0 ]]; then
    echo "Note: target has ${#extra_columns[@]} extra column(s) not in local (safe to ignore)."
  fi
  exit 0
fi

if [[ ${#missing_tables[@]} -gt 0 ]]; then
  echo ""
  echo "MISSING tables on target (${#missing_tables[@]}):"
  printf '  - %s\n' "${missing_tables[@]}"
fi

if [[ ${#missing_columns[@]} -gt 0 ]]; then
  echo ""
  echo "MISSING columns on target (${#missing_columns[@]}):"
  printf '  - %s\n' "${missing_columns[@]}"
fi

echo ""
echo "Fix: export DATABASE_URL=\"\$TARGET_DATABASE_URL\" && bash scripts/sync-production-db.sh"
exit 1
