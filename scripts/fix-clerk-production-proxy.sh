#!/usr/bin/env bash
# Point the Clerk primary domain proxy_url at production (fixes OAuth + sign-in).
set -euo pipefail

PRODUCTION_URL="${1:-https://sellerlens.io}"
PROXY_URL="${PRODUCTION_URL%/}/api/__clerk"
SECRET="${CLERK_SECRET_KEY:-}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: Set CLERK_SECRET_KEY (same instance as VITE_CLERK_PUBLISHABLE_KEY)." >&2
  exit 1
fi

echo "==> Fetching Clerk domains"
domains_json="$(curl -sf -H "Authorization: Bearer $SECRET" "https://api.clerk.com/v1/domains")"

primary_id="$(python3 -c "
import json, sys
data = json.loads(sys.stdin.read()).get('data', [])
primary = next((d['id'] for d in data if not d.get('is_satellite')), '')
if not primary:
    sys.exit(1)
print(primary)
" <<<"$domains_json")"

current_proxy="$(python3 -c "
import json, sys
data = json.loads(sys.stdin.read()).get('data', [])
d = next((x for x in data if not x.get('is_satellite')), {})
print(d.get('proxy_url', '(none)'))
" <<<"$domains_json")"

echo "Current proxy_url: $current_proxy"
echo "Target proxy_url:  $PROXY_URL"

if [[ "$current_proxy" == "$PROXY_URL" ]]; then
  echo "OK — Clerk proxy_url already correct."
  exit 0
fi

echo "==> Updating Clerk primary domain $primary_id"
curl -sf -X PATCH "https://api.clerk.com/v1/domains/$primary_id" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"proxy_url\":\"$PROXY_URL\"}" >/dev/null

echo "Done. Clerk proxy_url is now $PROXY_URL"
echo ""
echo "Next on the production server:"
echo "  1. Set CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY (matching pair) in .env"
echo "  2. git pull && pnpm --filter @workspace/listing-auditor run build && pm2 restart listing-auditor-api"
echo "  3. bash scripts/verify-clerk-proxy.sh $PRODUCTION_URL"
