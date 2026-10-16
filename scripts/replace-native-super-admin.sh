#!/usr/bin/env bash
# Remove all Super Admin assignments and create ONE native email/password admin.
#
# Usage (on server — password is NOT stored in git):
#   export DATABASE_URL='postgresql://...'
#   bash scripts/replace-native-super-admin.sh 'admin@example.com' 'StrongPasswordHere'
#
# Then set ONLY the printed user id in ADMIN_USER_IDS and VITE_ADMIN_USER_IDS,
# rebuild frontend, restart API.
set -euo pipefail

EMAIL="${1:?Usage: replace-native-super-admin.sh EMAIL PASSWORD}"
PASSWORD="${2:?Usage: replace-native-super-admin.sh EMAIL PASSWORD}"

DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NORMALIZED="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"
NEW_ID="user_$(openssl rand -hex 12)"

echo "==> Revoking all existing admin_users rows..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "UPDATE admin_users SET is_deleted = 1 WHERE COALESCE(is_deleted, 0) = 0;"

echo "==> Removing other native login rows for ${NORMALIZED} (if any)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email="$NORMALIZED" <<'SQL'
DELETE FROM auth_credentials
WHERE lower(email) = lower(:'email')
  AND user_id NOT IN (
    SELECT user_id FROM admin_users WHERE COALESCE(is_deleted, 0) = 0
  );
SQL

echo "==> Clearing admin_invites (pending role invites)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM admin_invites;" 2>/dev/null || true

echo "==> Creating native login for ${NORMALIZED} (user_id=${NEW_ID})..."
bash scripts/set-native-auth-password.sh "$NEW_ID" "$NORMALIZED" "$PASSWORD"

echo "==> Granting Super Admin to ${NEW_ID}..."
bash scripts/grant-super-admin.sh "$NEW_ID" "$NORMALIZED"

cat <<EOF

================================================================================
Done. Remove ALL old ids from server env — use ONLY this user:

  ADMIN_USER_IDS=${NEW_ID}
  VITE_ADMIN_USER_IDS=${NEW_ID}

Also ensure native auth is enabled:
  NATIVE_AUTH_ENABLED=true
  AUTH_SESSION_SECRET=<set-a-long-secret>
  VITE_AUTH_PROVIDER=native   (frontend build)

  pm2 restart listing-auditor-api --update-env
  # rebuild + redeploy frontend after changing VITE_ADMIN_USER_IDS

Sign in: /sign-in
  Email: ${NORMALIZED}
  Password: (what you passed to this script)

Old Clerk admins lose /admin access once ADMIN_USER_IDS is updated.
Rotate the password if it was ever shared in chat or tickets.
================================================================================
EOF
