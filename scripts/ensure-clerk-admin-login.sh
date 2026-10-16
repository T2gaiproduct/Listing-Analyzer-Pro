#!/usr/bin/env bash
# Set (or reset) a Clerk user's password and ensure Super Admin in Postgres.
# Use when sign-in shows "incorrect password" but ADMIN_USER_IDS is already configured.
#
# Requires: CLERK_SECRET_KEY, DATABASE_URL
# Usage:
#   export CLERK_SECRET_KEY=sk_live_...
#   export DATABASE_URL=postgresql://...
#   bash scripts/ensure-clerk-admin-login.sh EMAIL 'NewStrongPassword'
#
# Do NOT commit passwords. Rotate if exposed in chat or logs.
set -euo pipefail

EMAIL="${1:?Usage: ensure-clerk-admin-login.sh EMAIL 'PASSWORD'}"
PASSWORD="${2:?Provide password as second argument}"

CLERK_SECRET_KEY="${CLERK_SECRET_KEY:?Set CLERK_SECRET_KEY}"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NORMALIZED="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"

echo "==> Looking up Clerk user for ${NORMALIZED}..."
USER_JSON="$(curl -sS -G "https://api.clerk.com/v1/users" \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
  --data-urlencode "email_address[]=${NORMALIZED}" \
  --data-urlencode "limit=5")"

USER_ID="$(python3 - <<'PY' "$USER_JSON"
import json, sys
data = json.loads(sys.argv[1])
for u in data:
    if u.get("id"):
        print(u["id"])
        break
PY
)"

if [[ -z "$USER_ID" ]]; then
  echo "No Clerk user found for ${NORMALIZED}. Create one in Clerk Dashboard or:"
  echo "  curl -X POST https://api.clerk.com/v1/users -H \"Authorization: Bearer \$CLERK_SECRET_KEY\" \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"email_address\":[\"${NORMALIZED}\"],\"password\":\"<password>\",\"skip_password_checks\":true}'"
  exit 1
fi

echo "==> Found Clerk user_id=${USER_ID}"

if [[ -n "${ADMIN_USER_IDS:-}" ]]; then
  if ! echo ",${ADMIN_USER_IDS}," | grep -q ",${USER_ID},"; then
    echo "WARNING: ${USER_ID} is NOT in ADMIN_USER_IDS."
    echo "Add to API .env and VITE_ADMIN_USER_IDS, then restart API and rebuild frontend:"
    echo "  ADMIN_USER_IDS=${ADMIN_USER_IDS},${USER_ID}"
  else
    echo "OK: user_id is listed in ADMIN_USER_IDS."
  fi
else
  echo "NOTE: ADMIN_USER_IDS not set in this shell — verify on the server after login."
fi

echo "==> Setting Clerk password..."
PATCH_BODY="$(python3 -c 'import json,sys; print(json.dumps({"password": sys.argv[1]}))' "$PASSWORD")"
HTTP_CODE="$(curl -sS -o /tmp/clerk-patch-user.json -w "%{http_code}" \
  -X PATCH "https://api.clerk.com/v1/users/${USER_ID}" \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PATCH_BODY")"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Clerk password update failed (HTTP ${HTTP_CODE}):"
  cat /tmp/clerk-patch-user.json
  exit 1
fi
echo "OK: Clerk password updated."

echo "==> Granting Super Admin in Postgres..."
bash scripts/grant-super-admin.sh "$USER_ID" "$NORMALIZED"

echo ""
echo "Done. Sign in at /sign-in with:"
echo "  Email: ${NORMALIZED}"
echo "  Password: (the password you passed to this script)"
echo ""
echo "Then open /admin and /admin/settings/email to configure SMTP."
echo "Restart API after changing ADMIN_USER_IDS: pm2 restart listing-auditor-api --update-env"
