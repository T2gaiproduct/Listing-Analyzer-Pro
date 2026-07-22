#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
PUBLIC_URL_FILE="/tmp/public-url.txt"
TUNNEL_LOG="/tmp/cloudflared-url.log"

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

ensure_cloudflared() {
  if [[ -x "$CLOUDFLARED_BIN" ]]; then
    return
  fi

  echo "==> Installing cloudflared"
  mkdir -p "$(dirname "$CLOUDFLARED_BIN")"
  curl -fsSL \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o "$CLOUDFLARED_BIN"
  chmod +x "$CLOUDFLARED_BIN"
}

tunnel_url_from_log() {
  if [[ -f "$TUNNEL_LOG" ]]; then
    rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -1 || true
  fi
}

public_url_is_healthy() {
  local url="$1"
  [[ -n "$url" ]] || return 1

  local host="${url#https://}"
  host="${host%%/*}"

  if ! dig @1.1.1.1 +short "$host" | rg -q '.'; then
    return 1
  fi

  curl -sf --max-time 15 "$url/" >/dev/null
}

wait_for_public_url() {
  local url=""
  for _ in {1..45}; do
    url=$(tunnel_url_from_log)
    if public_url_is_healthy "$url"; then
      echo "$url"
      return 0
    fi
    sleep 2
  done
  return 1
}

start_cloudflare_tunnel() {
  ensure_cloudflared

  echo "==> Starting Cloudflare tunnel"
  tmux_cmd kill-session -t cloudflare-tunnel 2>/dev/null || true
  : >"$TUNNEL_LOG"

  tmux_cmd new-session -d -s cloudflare-tunnel -c "$ROOT" -- bash -lc "
    exec '$CLOUDFLARED_BIN' tunnel --url http://127.0.0.1:19145 2>&1 | tee '$TUNNEL_LOG'
  "
}

ensure_cloudflare_tunnel() {
  local existing_url=""
  if [[ -f "$PUBLIC_URL_FILE" ]]; then
    existing_url=$(tr -d '[:space:]' <"$PUBLIC_URL_FILE")
  fi

  if tmux_cmd has-session -t cloudflare-tunnel 2>/dev/null; then
    existing_url="${existing_url:-$(tunnel_url_from_log)}"
    if public_url_is_healthy "$existing_url"; then
      echo "$existing_url"
      return 0
    fi
    echo "==> Existing Cloudflare tunnel is unhealthy; restarting"
  fi

  start_cloudflare_tunnel
  wait_for_public_url
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
for i in {1..30}; do
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

if public_url=$(ensure_cloudflare_tunnel); then
  printf '%s\n' "$public_url" >"$PUBLIC_URL_FILE"
  echo ""
  echo "========================================"
  echo "Public URL: $public_url"
  echo "========================================"
else
  echo "WARNING: Cloudflare tunnel started but public URL is not reachable yet."
  echo "Check $TUNNEL_LOG for details."
fi

echo "Done. Admin: http://127.0.0.1:19145/admin/dashboard"
