#!/usr/bin/env bash
# Verify SPA cache headers on a deployed host (production or staging).
set -euo pipefail

BASE_URL="${1:-https://sellerlens.io}"
BASE_URL="${BASE_URL%/}"

echo "==> $BASE_URL index.html Cache-Control"
curl -sfI "${BASE_URL}/index.html" | rg -i '^(HTTP/|cache-control|content-type)' || true

echo "==> $BASE_URL build-id.json"
curl -sfI "${BASE_URL}/build-id.json" | rg -i '^(HTTP/|cache-control|content-type)' || true

echo "==> missing /assets/*.js (expect 404, not HTML)"
MISSING_HEADERS="$(curl -sI "${BASE_URL}/assets/__nginx_cache_probe_missing__.js")"
echo "$MISSING_HEADERS" | rg -i '^(HTTP/|content-type|cache-control)' || true
if echo "$MISSING_HEADERS" | rg -qi 'content-type: text/html'; then
  echo "WARN: missing asset returned HTML — SPA fallback is still applied to /assets/" >&2
  exit 1
fi

ASSET="$(curl -sfL "${BASE_URL}/" | rg -o '/assets/[^" ]+\.js' | head -1 || true)"
if [[ -n "$ASSET" ]]; then
  echo "==> sample asset $ASSET"
  curl -sfI "${BASE_URL}${ASSET}" | rg -i '^(HTTP/|cache-control|content-type)' || true
fi

echo "OK"
