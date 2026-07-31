#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-stack-lib.sh
source "$ROOT/scripts/dev-stack-lib.sh"

if [[ -z "$CLERK_SEC_FOR_STACK" || -z "$CLERK_PUB_FOR_STACK" ]]; then
  echo "WARNING: CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY missing — signed-in API calls will return 401" >&2
fi

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "==> Stopping stale dev processes (tunnel is left running)"
for port in 8080 19145 3000; do
  kill_port "$port"
done
sleep 2
for port in 8080 19145 3000; do
  if lsof -i:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARNING: port $port still in use — force killing again" >&2
    kill_port "$port"
    sleep 2
  fi
done

echo "==> Applying database schema"
tmux_cmd kill-session -t db-push 2>/dev/null || true
tmux_cmd new-session -d -s db-push -c "$ROOT" -- bash -lc "
  export DATABASE_URL='$DATABASE_URL'
  pnpm --filter @workspace/db run push
"

echo "==> Starting API server (port 8080)"
start_api_server false

echo "==> Starting frontend (port 19145)"
start_frontend ""

wait_for_url "http://127.0.0.1:8080/api/healthz" "API server" 30
wait_for_url "http://127.0.0.1:19145/" "Frontend" 45

echo "==> Starting dev proxy (port 3000)"
start_dev_proxy

wait_for_url "http://127.0.0.1:3000/__devproxy/health" "Dev proxy" 15
wait_for_url "http://127.0.0.1:3000/admin/dashboard" "Admin page via proxy" 15

PUBLIC_URL=""
if public_url=$(ensure_cloudflare_tunnel); then
  PUBLIC_URL="$public_url"
  printf '%s\n' "$PUBLIC_URL" >"$PUBLIC_URL_FILE"
elif url=$(tunnel_url_from_log); [[ -n "$url" ]]; then
  PUBLIC_URL="$url"
  printf '%s\n' "$PUBLIC_URL" >"$PUBLIC_URL_FILE"
  echo "WARNING: Tunnel URL found but local health check failed — using $PUBLIC_URL anyway" >&2
fi

echo ""
echo "Stack ready"
echo "  Local:    http://127.0.0.1:3000/admin/dashboard"

if [[ -n "$PUBLIC_URL" ]]; then
  CLERK_PROXY_FOR_STACK="${PUBLIC_URL}/api/__clerk"
  export CLERK_PROXY_FOR_STACK

  echo "  Cloudflare: $PUBLIC_URL/admin/dashboard"
  echo "  Sign in:    $PUBLIC_URL/sign-in"
  echo ""
  echo "==> Enabling Clerk proxy for Cloudflare (required for sign-in on trycloudflare.com)"
  configure_clerk_proxy_for_tunnel "$PUBLIC_URL"

  echo "==> Restarting API and frontend with Clerk proxy enabled"
  start_api_server true
  start_frontend "$CLERK_PROXY_FOR_STACK"

  wait_for_url "http://127.0.0.1:8080/api/healthz" "API server (Clerk proxy)" 30
  wait_for_url "http://127.0.0.1:19145/" "Frontend (Clerk proxy)" 45

  echo "==> Restarting dev proxy (port 3000)"
  tmux_cmd kill-session -t dev-proxy 2>/dev/null || true
  tmux_cmd new-session -d -s dev-proxy -c "$ROOT" -- bash -lc "
    node scripts/dev-proxy.mjs
  "

  wait_for_url "http://127.0.0.1:3000/__devproxy/health" "Dev proxy" 15
  wait_for_url "http://127.0.0.1:3000/admin/dashboard" "Admin page via proxy" 15
else
  echo "  Cloudflare: (no URL yet — check $TUNNEL_LOG or re-run this script)"
fi

start_dev_watchdog

echo ""
echo "Tip: run bash scripts/cloudflare-url.sh to print the current tunnel URL"
