#!/usr/bin/env bash
# Shared helpers for dev-stack.sh and dev-watchdog.sh (source only).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
PUBLIC_URL_FILE="/tmp/public-url.txt"
TUNNEL_LOG="/tmp/cloudflared-url.log"
TUNNEL_SESSION="cloudflare-tunnel"
API_SESSION="api-server-live"
FRONTEND_SESSION="frontend-live"
PROXY_SESSION="dev-proxy"
WATCHDOG_SESSION="dev-watchdog"

CLERK_PUB_FOR_STACK="${VITE_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"
CLERK_SEC_FOR_STACK="${CLERK_SECRET_KEY:-}"
ADMIN_IDS_FOR_STACK="${ADMIN_USER_IDS:-}"
CLERK_PROXY_FOR_STACK="${CLERK_PROXY_FOR_STACK:-}"

if [[ -n "$CLERK_PUB_FOR_STACK" ]]; then
  export CLERK_PUBLISHABLE_KEY="$CLERK_PUB_FOR_STACK"
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
  for _ in $(seq 1 "$attempts"); do
    if curl -sf "$url" >/dev/null; then
      echo "$label is up"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: $label failed to start ($url)" >&2
  return 1
}

url_is_up() {
  local url="$1"
  curl -sf --max-time 5 "$url" >/dev/null 2>&1
}

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -t -i:"${port}" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

ensure_cloudflared() {
  if [[ -x "$CLOUDFLARED_BIN" ]]; then
    return
  fi
  if [[ -x /tmp/cloudflared ]]; then
    CLOUDFLARED_BIN=/tmp/cloudflared
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

tunnel_session_running() {
  tmux_cmd has-session -t "$TUNNEL_SESSION" 2>/dev/null
}

local_proxy_healthy() {
  url_is_up "http://127.0.0.1:3000/__devproxy/health"
}

api_healthy() {
  url_is_up "http://127.0.0.1:8080/api/healthz"
}

frontend_healthy() {
  url_is_up "http://127.0.0.1:19145/"
}

local_stack_healthy() {
  api_healthy && frontend_healthy && local_proxy_healthy
}

# Tunnel is healthy when cloudflared is running, we have a URL, and the local proxy answers.
tunnel_is_healthy_locally() {
  local url="$1"
  [[ -n "$url" ]] || url=$(tunnel_url_from_log)
  [[ -n "$url" ]] || return 1
  tunnel_session_running && local_proxy_healthy
}

wait_for_tunnel_url() {
  local url=""
  for _ in {1..45}; do
    url=$(tunnel_url_from_log)
    if [[ -n "$url" ]] && tunnel_session_running && local_proxy_healthy; then
      echo "$url"
      return 0
    fi
    sleep 2
  done
  url=$(tunnel_url_from_log)
  if [[ -n "$url" ]] && tunnel_session_running; then
    echo "$url"
    return 0
  fi
  return 1
}

start_cloudflare_tunnel() {
  ensure_cloudflared
  echo "==> Starting Cloudflare tunnel"
  tmux_cmd kill-session -t "$TUNNEL_SESSION" 2>/dev/null || true
  tmux_cmd kill-session -t cf-tunnel 2>/dev/null || true
  sleep 1
  : >"$TUNNEL_LOG"
  tmux_cmd new-session -d -s "$TUNNEL_SESSION" -c "$ROOT" -- bash -lc "
    exec '$CLOUDFLARED_BIN' tunnel --url http://127.0.0.1:3000 2>&1 | tee '$TUNNEL_LOG'
  "
}

ensure_cloudflare_tunnel() {
  local existing_url=""
  if [[ -f "$PUBLIC_URL_FILE" ]]; then
    existing_url=$(tr -d '[:space:]' <"$PUBLIC_URL_FILE")
  fi

  if tunnel_session_running; then
    existing_url="${existing_url:-$(tunnel_url_from_log)}"
    if tunnel_is_healthy_locally "$existing_url"; then
      echo "$existing_url"
      return 0
    fi
    echo "==> Existing Cloudflare tunnel is unhealthy; restarting"
  fi

  start_cloudflare_tunnel
  wait_for_tunnel_url
}

start_api_server() {
  local enable_clerk_proxy="${1:-false}"
  local ai_base="${AI_INTEGRATIONS_OPENAI_BASE_URL:-}"
  local ai_key="${AI_INTEGRATIONS_OPENAI_API_KEY:-}"
  if [[ -z "$ai_base" ]]; then
    ai_base="https://${AI_OPENAI_HOST:-api.openai.com}/v1"
  fi
  if [[ -z "$ai_key" ]]; then
    ai_key="sk-${AI_OPENAI_DUMMY_SUFFIX:-dummy}"
  fi
  tmux_cmd kill-session -t "$API_SESSION" 2>/dev/null || true
  kill_port 8080
  sleep 1
  tmux_cmd new-session -d -s "$API_SESSION" -c "$ROOT" -- bash -lc "
    export DATABASE_URL='$DATABASE_URL'
    export PORT=8080
    export ENABLE_CLERK_PROXY=$enable_clerk_proxy
    export CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
    export CLERK_SECRET_KEY='$CLERK_SEC_FOR_STACK'
    export ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
    export ALLOW_DEV_ADMIN_BOOTSTRAP=\"\${ALLOW_DEV_ADMIN_BOOTSTRAP:-true}\"
    export AI_INTEGRATIONS_OPENAI_BASE_URL='$ai_base'
    export AI_INTEGRATIONS_OPENAI_API_KEY='$ai_key'
    while true; do
      pnpm --filter @workspace/api-server run dev || true
      echo 'API server exited — restarting in 3s...'
      sleep 3
    done
  "
}

start_frontend() {
  local clerk_proxy_url="${1:-}"
  tmux_cmd kill-session -t "$FRONTEND_SESSION" 2>/dev/null || true
  tmux_cmd kill-session -t vite-test 2>/dev/null || true
  kill_port 19145
  sleep 1
  tmux_cmd new-session -d -s "$FRONTEND_SESSION" -c "$ROOT" -- bash -lc "
    export PORT=19145
    export BASE_PATH=/
    export VITE_CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
    export VITE_CLERK_PROXY_URL='$clerk_proxy_url'
    export VITE_ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
    while true; do
      pnpm --filter @workspace/listing-auditor run dev || true
      echo 'Frontend exited — restarting in 3s...'
      sleep 3
    done
  "
}

start_dev_proxy() {
  tmux_cmd kill-session -t "$PROXY_SESSION" 2>/dev/null || true
  kill_port 3000
  sleep 1
  tmux_cmd new-session -d -s "$PROXY_SESSION" -c "$ROOT" -- bash -lc "
    while true; do
      node scripts/dev-proxy.mjs || true
      echo 'Dev proxy exited — restarting in 2s...'
      sleep 2
    done
  "
}

configure_clerk_proxy_for_tunnel() {
  local public_url="$1"
  local proxy_url="${public_url}/api/__clerk"
  local host="${public_url#https://}"
  local secret="${CLERK_SEC_FOR_STACK:-${CLERK_SECRET_KEY:-}}"

  if [[ -z "$secret" ]]; then
    echo "WARNING: CLERK_SECRET_KEY missing — skipping Clerk proxy configuration" >&2
    return 0
  fi

  echo "==> Configuring Clerk proxy for Cloudflare tunnel ($host)"
  local domains_json primary_id satellite_id
  domains_json=$(curl -sf -H "Authorization: Bearer $secret" "https://api.clerk.com/v1/domains" 2>/dev/null || true)
  if [[ -z "$domains_json" ]]; then
    echo "WARNING: Could not list Clerk domains — sign-in may fail on this tunnel URL" >&2
    return 0
  fi

  read -r primary_id satellite_id < <(python3 -c "
import json, sys
host = sys.argv[1]
data = json.loads(sys.stdin.read()).get('data', [])
primary = next((d['id'] for d in data if not d.get('is_satellite')), '')
satellite = next((d['id'] for d in data if d.get('is_satellite') and d.get('name') == host), '')
print(primary, satellite)
" "$host" <<<"$domains_json")

  if [[ -n "$satellite_id" ]]; then
    echo "Removing stale Clerk satellite domain for $host (sign-in is blocked on satellites)"
    curl -sf -X DELETE "https://api.clerk.com/v1/domains/$satellite_id" \
      -H "Authorization: Bearer $secret" >/dev/null || true
  fi

  if [[ -z "$primary_id" ]]; then
    echo "WARNING: No primary Clerk domain found — sign-in may fail on this tunnel URL" >&2
    return 0
  fi

  if curl -sf -X PATCH "https://api.clerk.com/v1/domains/$primary_id" \
    -H "Authorization: Bearer $secret" \
    -H "Content-Type: application/json" \
    -d "{\"proxy_url\":\"$proxy_url\"}" >/dev/null; then
    echo "Clerk primary domain proxy_url set to $proxy_url"
    return 0
  fi

  echo "WARNING: Could not set Clerk proxy_url for $host — sign-in may fail until configured in Clerk" >&2
}

start_dev_watchdog() {
  if tmux_cmd has-session -t "$WATCHDOG_SESSION" 2>/dev/null; then
    return 0
  fi
  echo "==> Starting dev watchdog (auto-restarts API/frontend/proxy if they die)"
  tmux_cmd new-session -d -s "$WATCHDOG_SESSION" -c "$ROOT" -- bash -lc "
    export DATABASE_URL='$DATABASE_URL'
    export CLERK_PUB_FOR_STACK='$CLERK_PUB_FOR_STACK'
    export CLERK_SEC_FOR_STACK='$CLERK_SEC_FOR_STACK'
    export ADMIN_IDS_FOR_STACK='$ADMIN_IDS_FOR_STACK'
    export CLERK_PROXY_FOR_STACK='$CLERK_PROXY_FOR_STACK'
    exec bash scripts/dev-watchdog.sh
  "
}
