#!/usr/bin/env bash
# Grant Super Admin to a user_id (and optional login email sync / accepted invite).
#
# Usage:
#   export DATABASE_URL="postgresql://..."
#   bash scripts/grant-super-admin.sh USER_ID [EMAIL]
#
# Also add USER_ID to server .env:
#   ADMIN_USER_IDS=...,USER_ID
#   VITE_ADMIN_USER_IDS=...,USER_ID   (then rebuild frontend)
set -euo pipefail

USER_ID="${1:?Usage: grant-super-admin.sh USER_ID [EMAIL]}"
EMAIL="${2:-}"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ROLE_ID="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -c \
  "SELECT id FROM admin_roles WHERE name = 'Super Admin' AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY id LIMIT 1;")"
if [[ -z "$ROLE_ID" ]]; then
  echo "ERROR: admin_roles row 'Super Admin' not found. Run DB sync / seed first." >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v user_id="$USER_ID" -v role_id="$ROLE_ID" <<'SQL'
INSERT INTO admin_users (user_id, role_id, is_deleted)
VALUES (:'user_id', :'role_id'::integer, 0)
ON CONFLICT (user_id) DO UPDATE
  SET role_id = EXCLUDED.role_id, is_deleted = 0;
SQL

if [[ -n "$EMAIL" ]]; then
  NORMALIZED="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v user_id="$USER_ID" -v email="$NORMALIZED" -v role_id="$ROLE_ID" <<'SQL'
UPDATE user_profiles
SET login_email = :'email', updated_at = now()
WHERE user_id = :'user_id';

INSERT INTO admin_invites (email, role_id, invited_by_user_id, accepted_at, accepted_user_id)
VALUES (:'email', :'role_id'::integer, :'user_id', now(), :'user_id')
ON CONFLICT (email) DO UPDATE
  SET role_id = EXCLUDED.role_id,
      accepted_at = COALESCE(admin_invites.accepted_at, now()),
      accepted_user_id = COALESCE(admin_invites.accepted_user_id, EXCLUDED.accepted_user_id);
SQL
fi

echo "OK — Super Admin granted in DB for user_id=$USER_ID"
echo
echo "Add to API .env (comma-separated, restart API):"
echo "  ADMIN_USER_IDS=...,${USER_ID}"
echo
echo "Add to frontend build env (rebuild + redeploy static assets):"
echo "  VITE_ADMIN_USER_IDS=...,${USER_ID}"
