#!/usr/bin/env bash
# Set (or reset) a native-auth admin password and grant Super Admin in Postgres.
# Use after accidentally deleting an admin from Customers, or when login fails.
#
# Requires: DATABASE_URL, NATIVE_AUTH_ENABLED on API (production/staging)
# Usage:
#   export DATABASE_URL='postgresql://...'
#   bash scripts/ensure-native-admin-login.sh 'admin@example.com' 'NewStrongPassword'
#
# Passwords must not be committed. Rotate if exposed in chat or tickets.
set -euo pipefail

EMAIL="${1:?Usage: ensure-native-admin-login.sh EMAIL 'PASSWORD'}"
PASSWORD="${2:?Provide password as second argument}"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NORMALIZED="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"

echo "==> Resolving user_id for ${NORMALIZED}..."
EXISTING_ID="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -v email="$NORMALIZED" <<'SQL'
SELECT c.user_id
FROM auth_credentials c
WHERE lower(c.email) = lower(:'email')
LIMIT 1;
SQL
)"
EXISTING_ID="$(echo "$EXISTING_ID" | tr -d '[:space:]')"

if [[ -z "$EXISTING_ID" ]]; then
  EXISTING_ID="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -v email="$NORMALIZED" <<'SQL'
SELECT p.user_id
FROM user_profiles p
WHERE coalesce(p.is_deleted, 0) = 0
  AND lower(coalesce(p.login_email, '')) = lower(:'email')
LIMIT 1;
SQL
)"
  EXISTING_ID="$(echo "$EXISTING_ID" | tr -d '[:space:]')"
fi

if [[ -n "$EXISTING_ID" ]]; then
  USER_ID="$EXISTING_ID"
  echo "==> Reusing existing user_id=${USER_ID}"
else
  USER_ID="user_$(openssl rand -hex 12)"
  echo "==> Creating new user_id=${USER_ID}"
fi

echo "==> Removing orphaned / soft-deleted admin_users rows..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM admin_users au
WHERE coalesce(au.is_deleted, 0) = 1
   OR (
     NOT EXISTS (SELECT 1 FROM auth_credentials c WHERE c.user_id = au.user_id)
     AND NOT EXISTS (
       SELECT 1 FROM user_profiles p
       WHERE p.user_id = au.user_id AND coalesce(p.is_deleted, 0) = 0
     )
   );
SQL

echo "==> Clearing pending admin invites for ${NORMALIZED}..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email="$NORMALIZED" -c \
  "DELETE FROM admin_invites WHERE lower(email) = lower('${NORMALIZED}') AND accepted_at IS NULL;" 2>/dev/null || true

echo "==> Setting native auth password..."
bash scripts/set-native-auth-password.sh "$USER_ID" "$NORMALIZED" "$PASSWORD"

echo "==> Granting Super Admin..."
bash scripts/grant-super-admin.sh "$USER_ID" "$NORMALIZED"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="$USER_ID" -v email="$NORMALIZED" <<'SQL'
INSERT INTO user_profiles (user_id, login_email, full_name, company_name, onboarding_completed, updated_at)
VALUES (:'uid', :'email', 'Platform Admin', 'Ecommerce Guru', true, now())
ON CONFLICT (user_id) DO UPDATE SET
  login_email = EXCLUDED.login_email,
  onboarding_completed = true,
  account_banned = false,
  account_locked = false,
  is_deleted = 0,
  updated_at = now();
SQL

if [[ -n "${ADMIN_USER_IDS:-}" ]]; then
  if ! echo ",${ADMIN_USER_IDS}," | grep -q ",${USER_ID},"; then
    echo ""
    echo "WARNING: ${USER_ID} is NOT in ADMIN_USER_IDS."
    echo "Update API .env and frontend build env, then restart API and rebuild frontend:"
    echo "  ADMIN_USER_IDS=${USER_ID}"
    echo "  VITE_ADMIN_USER_IDS=${USER_ID}"
    echo "(Remove any old user ids that were deleted from Customers.)"
  else
    echo "OK: user_id is listed in ADMIN_USER_IDS."
  fi
else
  echo ""
  echo "NOTE: ADMIN_USER_IDS not set in this shell — set on the server:"
  echo "  ADMIN_USER_IDS=${USER_ID}"
  echo "  VITE_ADMIN_USER_IDS=${USER_ID}"
fi

cat <<EOF

Done. Sign in at /sign-in with:
  Email: ${NORMALIZED}
  Password: (the password you passed to this script)

Then open /admin — if Admin → Roles still shows a ghost "Admin" row, remove it
(orphan assignments are hidden after the next API deploy) or run this script again.

Restart API after changing ADMIN_USER_IDS:
  pm2 restart listing-auditor-api --update-env
EOF