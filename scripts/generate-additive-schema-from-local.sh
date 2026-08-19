#!/usr/bin/env bash
# Emit additive DDL (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS)
# from the local PostgreSQL schema so production can stay aligned with local.
#
# Usage:
#   bash scripts/generate-additive-schema-from-local.sh
#   LOCAL_DATABASE_URL=... OUT=scripts/sql/schema-from-local.sql bash scripts/generate-additive-schema-from-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
OUT="${OUT:-$ROOT/scripts/sql/schema-from-local.sql}"

if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

mkdir -p "$(dirname "$OUT")"

COLUMNS_TSV="$(psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -At -F $'\t' -c "
    SELECT table_name, column_name,
           CASE
             WHEN column_default LIKE 'nextval(%' AND data_type = 'integer' THEN 'serial'
             WHEN data_type = 'character varying' AND character_maximum_length IS NOT NULL
               THEN 'varchar(' || character_maximum_length || ')'
             WHEN data_type = 'character varying' THEN 'varchar'
             WHEN data_type = 'timestamp without time zone' THEN 'timestamp'
             WHEN data_type = 'timestamp with time zone' THEN 'timestamptz'
             WHEN data_type = 'ARRAY' THEN udt_name || '[]'
             ELSE data_type
           END AS col_type,
           is_nullable,
           COALESCE(column_default, '')
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
")"

COLUMNS_TSV="$COLUMNS_TSV" OUT="$OUT" python3 - <<'PY'
import os
from collections import defaultdict

out_path = os.environ["OUT"]
rows = os.environ.get("COLUMNS_TSV", "")
tables = defaultdict(list)
for line in rows.splitlines():
    if not line.strip():
        continue
    parts = line.split("\t")
    if len(parts) < 5:
        continue
    table, col, col_type, nullable, default = parts[0], parts[1], parts[2], parts[3], parts[4]
    tables[table].append((col, col_type, nullable, default))

def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'

def col_def(col, col_type, nullable, default, for_create: bool) -> str:
    bits = [qident(col), col_type]
    if default:
        if not (not for_create and default.startswith("nextval(")):
            if not (for_create and col_type == "serial" and default.startswith("nextval(")):
                bits.append("DEFAULT " + default)
    if for_create and nullable == "NO" and col_type != "serial":
        bits.append("NOT NULL")
    return " ".join(bits)

lines = [
    "-- AUTO-GENERATED additive schema from local PostgreSQL.",
    "-- Do not edit by hand — regenerate with:",
    "--   bash scripts/generate-additive-schema-from-local.sh",
    "--",
    "-- SAFE: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS.",
    "-- Does not drop columns or tables.",
    "BEGIN;",
    "",
    "-- Tables",
]
for table, cols in tables.items():
    inner = ",\n  ".join(col_def(c, t, n, d, True) for c, t, n, d in cols)
    lines.append(f"CREATE TABLE IF NOT EXISTS {qident(table)} (\n  {inner}\n);")
    lines.append("")

lines.append("-- Columns (existing tables)")
for table, cols in tables.items():
    for col, col_type, nullable, default in cols:
        alter_type = "integer" if col_type == "serial" else col_type
        extra = ""
        if default and not default.startswith("nextval("):
            extra += f" DEFAULT {default}"
        lines.append(
            f"ALTER TABLE {qident(table)} ADD COLUMN IF NOT EXISTS {qident(col)} {alter_type}{extra};"
        )
    lines.append("")

lines.append("COMMIT;")
lines.append("")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"==> Wrote {out_path} ({len(tables)} tables)")
PY
