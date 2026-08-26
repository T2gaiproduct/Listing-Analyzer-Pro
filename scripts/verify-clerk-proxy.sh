#!/usr/bin/env bash
# Verify Clerk proxy + keys on a deployed host (production or staging).
set -euo pipefail

BASE_URL="${1:-https://sellerlens.io}"

echo "==> Clerk proxy check for $BASE_URL"

health="$(curl -sf "$BASE_URL/api/healthz")"
echo "healthz: $health"

clerk_status="$(curl -s -o /tmp/clerk-env.json -w "%{http_code}" "$BASE_URL/api/__clerk/v1/environment" -H "Accept: application/json")"
echo "clerk proxy HTTP: $clerk_status"
head -c 300 /tmp/clerk-env.json
echo ""

if [[ "$clerk_status" == "200" ]]; then
  echo "OK — Clerk proxy is working."
  exit 0
fi

if rg -q "invalid secret key" /tmp/clerk-env.json 2>/dev/null; then
  echo ""
  echo "FAIL — CLERK_SECRET_KEY on the API server does not match CLERK_PUBLISHABLE_KEY."
  echo "Fix on the server .env:"
  echo "  1. Clerk Dashboard → API Keys → copy Secret key for the same instance as your publishable key"
  echo "  2. Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY in .env"
  echo "  3. pm2 restart listing-auditor-api"
  echo "  4. Rebuild frontend if you changed VITE_CLERK_PUBLISHABLE_KEY"
  echo ""
  echo "If using pk_test_ (development) keys, deploy latest main — frontend skips proxy for dev keys."
  exit 1
fi

echo "WARN — Clerk proxy returned $clerk_status; inspect /tmp/clerk-env.json"
exit 1
