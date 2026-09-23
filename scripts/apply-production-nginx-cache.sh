#!/usr/bin/env bash
# Apply SPA cache / asset nginx rules on the production VPS.
#
# Run ON the server (after git pull), e.g.:
#   cd /opt/listingauditor && git pull origin main
#   sudo bash scripts/apply-production-nginx-cache.sh
#
# Optional env:
#   NGINX_SITE=/etc/nginx/sites-available/listingauditor
#   REPO_ROOT=/opt/listingauditor
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/listingauditor}"
INCLUDE_LINE="include ${REPO_ROOT}/deploy/nginx/spa-cache-locations.conf;"
MARKER="# listing-auditor spa-cache (managed by scripts/apply-production-nginx-cache.sh)"

if [[ ! -f "$NGINX_SITE" ]]; then
  echo "ERROR: nginx site not found: $NGINX_SITE" >&2
  echo "Set NGINX_SITE to your sites-available file." >&2
  exit 1
fi

if [[ ! -f "${REPO_ROOT}/deploy/nginx/spa-cache-locations.conf" ]]; then
  echo "ERROR: missing ${REPO_ROOT}/deploy/nginx/spa-cache-locations.conf (git pull?)" >&2
  exit 1
fi

if grep -qF "$MARKER" "$NGINX_SITE"; then
  echo "==> nginx cache include already present in $NGINX_SITE"
else
  echo "==> Adding spa-cache include to $NGINX_SITE"
  TMP="$(mktemp)"
  awk -v marker="$MARKER" -v inc="$INCLUDE_LINE" '
    !done && $0 ~ /^[[:space:]]*location \/ \{/ {
      print "    " marker
      print "    " inc
      done = 1
    }
    { print }
  ' "$NGINX_SITE" > "$TMP"
  if ! grep -qF "$MARKER" "$TMP"; then
    echo "ERROR: could not find \"location / {\" in $NGINX_SITE — add manually:" >&2
    echo "    $MARKER" >&2
    echo "    $INCLUDE_LINE" >&2
    rm -f "$TMP"
    exit 1
  fi
  cp "$TMP" "$NGINX_SITE"
  rm -f "$TMP"
fi

echo "==> nginx -t"
nginx -t

echo "==> reload nginx"
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl reload nginx
else
  service nginx reload
fi

echo "OK — verify:"
echo "  curl -sI http://127.0.0.1/assets/missing-chunk.js | head -1   # expect 404"
echo "  curl -sI http://127.0.0.1/build-id.json | grep -i cache-control  # expect no-store"
