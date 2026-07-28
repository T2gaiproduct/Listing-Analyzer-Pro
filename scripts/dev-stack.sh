#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"

# Keep API and frontend on the same Clerk instance (required for PATCH /api/profile, onboarding, etc.)
CLERK_PUB_FOR_STACK="${VITE_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"
CLERK_SEC_FOR_STACK="${CLERK_SECRET_KEY:-}"
ADMIN_IDS_FOR_STACK="${ADMIN_USER_IDS:-}"

if [[ -n "$CLERK_PUB_FOR_STACK" ]]; then
  export CLERK_PUBLISHABLE_KEY="$CLERK_PUB_FOR_STACK"
fi

if [[ -z "$CLERK_SEC_FOR_STACK" || -z "$CLERK_PUB_FOR_STACK" ]]; then
  echo "WARNING: CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY missing — signed-in API calls will return 401" >&2
fi

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  for i in $(seq 1 "$attempts"); do
    if curl -sf "$url" >/dev/null; then
      echo "$label is up"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: $label failed to start ($url)" >&2
  return 1
}

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "==> Stopping stale dev processes"
for port in 8080 19145 3000; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 3
for port in 8080 19145 3000; do
  if fuser "${port}/tcp" 2>/dev/null; then
    echo "WARNING: port $port still in use — retrying kill" >&2
    fuser -k "${port}/tcp" 2>/dev/null || true
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
tmux_cmd kill-session -t api-server-live 2>/dev/null || true
tmux_cmd new-session -d -s api-server-live -c "$ROOT" -- bash -lc "
  export DATABASE_URL='$DATABASE_URL'
  export PORT=8080
  export CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
  export CLERK_SECRET_KEY='$CLERK_SEC_FOR_STACK'
  export ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
  export ALLOW_DEV_ADMIN_BOOTSTRAP=\"\${ALLOW_DEV_ADMIN_BOOTSTRAP:-true}\"
  export AI_INTEGRATIONS_OPENAI_BASE_URL=\"\${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.openai.com/v1}\"
  export AI_INTEGRATIONS_OPENAI_API_KEY=\"\${AI_INTEGRATIONS_OPENAI_API_KEY:-sk-dummy}\"
  pnpm --filter @workspace/api-server run dev
"

echo "==> Starting frontend (port 19145)"
tmux_cmd kill-session -t frontend-live 2>/dev/null || true
tmux_cmd kill-session -t vite-test 2>/dev/null || true
tmux_cmd new-session -d -s frontend-live -c "$ROOT" -- bash -lc "
  export PORT=19145
  export BASE_PATH=/
  export VITE_CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
  export VITE_ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
  while true; do
    pnpm --filter @workspace/listing-auditor run dev || true
    echo 'Frontend exited — restarting in 3s...'
    sleep 3
  done
"

wait_for_url "http://127.0.0.1:8080/api/healthz" "API server" 30
wait_for_url "http://127.0.0.1:19145/" "Frontend" 45

echo "==> Starting dev proxy (port 3000)"
tmux_cmd kill-session -t dev-proxy 2>/dev/null || true
tmux_cmd new-session -d -s dev-proxy -c "$ROOT" -- bash -lc "
  node scripts/dev-proxy.mjs
"

wait_for_url "http://127.0.0.1:3000/__devproxy/health" "Dev proxy" 15
wait_for_url "http://127.0.0.1:3000/admin/dashboard" "Admin page via proxy" 15

echo "==> Starting Cloudflare tunnel"
tmux_cmd kill-session -t cloudflare-tunnel 2>/dev/null || true
tmux_cmd kill-session -t cf-tunnel 2>/dev/null || true
sleep 1
: > /tmp/cloudflared-url.log
tmux_cmd new-session -d -s cloudflare-tunnel -c "$ROOT" -- bash -lc "
  CLOUDFLARED=\"\${CLOUDFLARED:-\$(command -v cloudflared || echo /tmp/cloudflared)}\"
  \"\$CLOUDFLARED\" tunnel --url http://127.0.0.1:3000 2>&1 | tee /tmp/cloudflared-url.log
"

PUBLIC_URL=""
for i in {1..20}; do
  PUBLIC_URL=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-url.log 2>/dev/null | tail -1 || true)
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 2
done

echo ""
echo "Stack ready"
echo "  Local:    http://127.0.0.1:3000/admin/dashboard"
if [[ -n "$PUBLIC_URL" ]]; then
  echo "  Cloudflare: $PUBLIC_URL/admin/dashboard"
else
  echo "  Cloudflare: (still starting — check /tmp/cloudflared-url.log)"
fi
