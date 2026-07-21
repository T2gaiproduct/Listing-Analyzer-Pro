#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "==> Stopping stale dev processes"
fuser -k 8080/tcp 2>/dev/null || true
fuser -k 19145/tcp 2>/dev/null || true
sleep 2

echo "==> Starting API server (port 8080)"
tmux_cmd kill-session -t api-server-live 2>/dev/null || true
tmux_cmd new-session -d -s api-server-live -c "$ROOT" -- bash -lc "
  export DATABASE_URL='$DATABASE_URL'
  export PORT=8080
  export CLERK_PUBLISHABLE_KEY=\"\${VITE_CLERK_PUBLISHABLE_KEY:-\${CLERK_PUBLISHABLE_KEY:-}}\"
  export CLERK_SECRET_KEY=\"\${CLERK_SECRET_KEY:-}\"
  export ADMIN_USER_IDS=\"\${ADMIN_USER_IDS:-}\"
  export AI_INTEGRATIONS_OPENAI_BASE_URL=\"\${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.openai.com/v1}\"
  export AI_INTEGRATIONS_OPENAI_API_KEY=\"\${AI_INTEGRATIONS_OPENAI_API_KEY:-sk-dummy}\"
  pnpm --filter @workspace/api-server run dev
"

echo "==> Starting frontend (port 19145)"
tmux_cmd kill-session -t frontend-live 2>/dev/null || true
rm -rf "$ROOT/artifacts/listing-auditor/node_modules/.vite"
tmux_cmd new-session -d -s frontend-live -c "$ROOT" -- bash -lc "
  export PORT=19145
  export BASE_PATH=/
  export VITE_CLERK_PUBLISHABLE_KEY=\"\${VITE_CLERK_PUBLISHABLE_KEY:-}\"
  export VITE_ADMIN_USER_IDS=\"\${ADMIN_USER_IDS:-}\"
  pnpm --filter @workspace/listing-auditor run dev
"

echo "==> Waiting for services"
for i in {1..20}; do
  api_ok=0
  web_ok=0
  curl -sf http://127.0.0.1:8080/api/healthz >/dev/null && api_ok=1
  curl -sf http://127.0.0.1:19145/ >/dev/null && web_ok=1
  if [[ $api_ok -eq 1 && $web_ok -eq 1 ]]; then
    echo "API and frontend are up"
    break
  fi
  sleep 2
done

if ! tmux_cmd has-session -t cloudflare-tunnel 2>/dev/null; then
  echo "==> Starting Cloudflare tunnel"
  tmux_cmd new-session -d -s cloudflare-tunnel -c "$ROOT" -- bash -lc "
    cloudflared tunnel --url http://127.0.0.1:19145 2>&1 | tee /tmp/cloudflared-url.log
  "
  sleep 4
fi

if [[ -f /tmp/cloudflared-url.log ]]; then
  url=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-url.log | tail -1 || true)
  if [[ -n "$url" ]]; then
    echo "Public URL: $url"
  fi
fi

echo "Done. Admin: http://127.0.0.1:19145/admin/dashboard"
