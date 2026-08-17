#!/usr/bin/env bash
# Verify production PostgreSQL matches lib/db/src/schema/ critical columns.
# Exits 0 when aligned; 1 when columns/tables are missing.
#
# Usage:
#   export DATABASE_URL="postgresql://..."
#   bash scripts/check-production-schema.sh
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"

# table:column (one per line; comments and blank lines ignored)
read -r -d '' EXPECTED <<'EOF' || true
user_profiles:login_email
user_profiles:notification_preferences
team_members:role_id
workspaces:id
workspace_roles:id
workspace_members:id
workspace_credits:id
workspace_credits:pool_is_net
audits:workspace_id
audits:created_by_user_id
graphics_projects:workspace_id
videos_projects:workspace_id
ads_projects:workspace_id
ads_projects:asin
ads_projects:current_step
ads_projects:keyword_data
ads_projects:sources_snapshot
product_profiles:audit_id
product_marketplace_listings:audit_id
pinned_projects:workspace_id
member_credits:workspace_id
member_credits:workspace_member_id
credit_transactions:workspace_id
payments:coupon_code
payments:discount_amount
invoices:coupon_code
invoices:discount_amount
subscriptions:coupon_code
subscriptions:discount_amount
plans:enabled_features
EOF

missing=()
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  table="${line%%:*}"
  column="${line#*:}"
  found="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -c \
    "SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '$table' AND column_name = '$column'
     LIMIT 1;")"
  if [[ "$found" != "1" ]]; then
    missing+=("$table.$column")
  fi
done <<< "$EXPECTED"

if [[ ${#missing[@]} -eq 0 ]]; then
  count="$(echo "$EXPECTED" | grep -c ':' || true)"
  echo "OK — all $count critical schema columns present."
  exit 0
fi

echo "MISSING schema columns (${#missing[@]}):"
printf '  - %s\n' "${missing[@]}"
echo ""
echo "Fix: bash scripts/sync-production-db.sh"
echo "  or: psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f scripts/sql/production-schema-upgrade.sql"
exit 1
