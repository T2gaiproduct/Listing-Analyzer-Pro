#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
PUBLIC_URL_FILE="/tmp/public-url.txt"
TUNNEL_LOG="/tmp/cloudflared-url.log"
# Stable hostname for a named Cloudflare Tunnel (e.g. https://dev-preview.sellerlens.io).
# Quick trycloudflare.com URLs always change when the tunnel restarts — use token + public URL instead.
CLOUDFLARE_TUNNEL_PUBLIC_URL="${CLOUDFLARE_TUNNEL_PUBLIC_URL:-${CLOUDFLARE_STABLE_PUBLIC_URL:-}}"
CLOUDFLARE_TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"
# Stable local testing (no random Cloudflare hostname). Amazon OAuth redirect stays fixed.
SKIP_CLOUDFLARE_TUNNEL="${SKIP_CLOUDFLARE_TUNNEL:-}"
LOCAL_DEV_PUBLIC_URL="${LOCAL_DEV_PUBLIC_URL:-http://127.0.0.1:3000}"

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

tunnel_host_resolves() {
  local host="$1"
  [[ -n "$host" ]] || return 1

  if dig @1.1.1.1 +short "$host" 2>/dev/null | rg -q '.'; then
    return 0
  fi

  # Some dev VMs cannot resolve trycloudflare.com locally; fall back to Google DNS-over-HTTPS.
  curl -sf "https://dns.google/resolve?name=${host}&type=A" \
    | rg -q '"data":'
}

public_url_is_healthy() {
  local url="$1"
  [[ -n "$url" ]] || return 1

  local host="${url#https://}"
  host="${host%%/*}"

  if ! tunnel_host_resolves "$host"; then
    return 1
  fi

  local ip
  ip=$(dig @1.1.1.1 +short "$host" 2>/dev/null | head -1)
  if [[ -z "$ip" ]]; then
    ip=$(curl -sf "https://dns.google/resolve?name=${host}&type=A" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('Answer',[{}])[0].get('data',''))" 2>/dev/null || true)
  fi
  if [[ -n "$ip" ]]; then
    curl -sf --max-time 15 --resolve "${host}:443:${ip}" "$url/" >/dev/null && return 0
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

  echo "==> Starting Cloudflare tunnel" >&2
  tmux_cmd kill-session -t cloudflare-tunnel 2>/dev/null || true
  tmux_cmd kill-session -t cf-tunnel 2>/dev/null || true
  sleep 1
  : >"$TUNNEL_LOG"

  tmux_cmd new-session -d -s cloudflare-tunnel -c "$ROOT" -- bash -lc "
    exec '$CLOUDFLARED_BIN' tunnel --url http://127.0.0.1:3000 2>&1 | tee '$TUNNEL_LOG'
  "
}

normalize_public_url() {
  local raw="${1:-}"
  rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' <<<"$raw" | tail -1 || true
}

normalize_stable_public_url() {
  local raw="${1:-}"
  raw="${raw%/}"
  if [[ "$raw" =~ ^https?:// ]]; then
    echo "$raw"
  fi
}

should_skip_cloudflare_tunnel() {
  [[ "$SKIP_CLOUDFLARE_TUNNEL" == "true" || "$SKIP_CLOUDFLARE_TUNNEL" == "1" ]]
}

using_named_cloudflare_tunnel() {
  [[ -n "$CLOUDFLARE_TUNNEL_TOKEN" && -n "$CLOUDFLARE_TUNNEL_PUBLIC_URL" ]]
}

start_named_cloudflare_tunnel() {
  ensure_cloudflared
  local public_url
  public_url=$(normalize_stable_public_url "$CLOUDFLARE_TUNNEL_PUBLIC_URL")

  echo "==> Starting named Cloudflare tunnel (stable URL: $public_url)" >&2
  tmux_cmd kill-session -t cloudflare-tunnel 2>/dev/null || true
  tmux_cmd kill-session -t cf-tunnel 2>/dev/null || true
  sleep 1
  : >"$TUNNEL_LOG"

  tmux_cmd new-session -d -s cloudflare-tunnel -c "$ROOT" -- bash -lc "
    exec '$CLOUDFLARED_BIN' tunnel run --token '$CLOUDFLARE_TUNNEL_TOKEN' 2>&1 | tee '$TUNNEL_LOG'
  "
}

wait_for_named_public_url() {
  local public_url
  public_url=$(normalize_stable_public_url "$CLOUDFLARE_TUNNEL_PUBLIC_URL")
  [[ -n "$public_url" ]] || return 1

  for _ in {1..60}; do
    if public_url_is_healthy "$public_url"; then
      echo "$public_url"
      return 0
    fi
    sleep 2
  done
  return 1
}

ensure_cloudflare_tunnel() {
  if using_named_cloudflare_tunnel; then
    local stable_url
    stable_url=$(normalize_stable_public_url "$CLOUDFLARE_TUNNEL_PUBLIC_URL")
    if tmux_cmd has-session -t cloudflare-tunnel 2>/dev/null; then
      if public_url_is_healthy "$stable_url"; then
        echo "$stable_url"
        return 0
      fi
      echo "==> Named Cloudflare tunnel is unhealthy; restarting" >&2
    fi
    start_named_cloudflare_tunnel
    if wait_for_named_public_url; then
      return 0
    fi
    return 1
  fi

  local existing_url=""
  if [[ -f "$PUBLIC_URL_FILE" ]]; then
    existing_url=$(normalize_public_url "$(cat "$PUBLIC_URL_FILE")")
  fi

  if tmux_cmd has-session -t cloudflare-tunnel 2>/dev/null; then
    existing_url="${existing_url:-$(tunnel_url_from_log)}"
    if public_url_is_healthy "$existing_url"; then
      echo "$existing_url"
      return 0
    fi
    echo "==> Existing Cloudflare tunnel is unhealthy; restarting" >&2
  fi

  start_cloudflare_tunnel
  wait_for_public_url
}

# Each Cloudflare quick-tunnel URL is a new hostname. Clerk must proxy FAPI through
# the primary domain's proxy_url — NOT as a satellite (satellites cannot sign in).
configure_clerk_proxy_for_tunnel() {
  local public_url="$1"
  local proxy_url="${public_url}/api/__clerk"
  local host="${public_url#https://}"
  local secret="${CLERK_SEC_FOR_STACK:-${CLERK_SECRET_KEY:-}}"

  if [[ -z "$secret" ]]; then
    echo "WARNING: CLERK_SECRET_KEY missing — skipping Clerk proxy configuration" >&2
    return 1
  fi

  echo "==> Validating Clerk secret key"
  local domains_json
  domains_json=$(curl -sf -H "Authorization: Bearer $secret" "https://api.clerk.com/v1/domains" 2>/dev/null || true)
  if [[ -z "$domains_json" ]] || echo "$domains_json" | rg -q '"clerk_key_invalid"'; then
    echo "ERROR: CLERK_SECRET_KEY is invalid or does not match VITE_CLERK_PUBLISHABLE_KEY." >&2
    echo "       Update CLERK_SECRET_KEY in environment secrets with the secret for fitting-ox / your Clerk app." >&2
    echo "       Sign-up on Cloudflare preview will not work until this is fixed." >&2
    return 1
  fi

  echo "==> Configuring Clerk proxy for Cloudflare tunnel ($host)"
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

configure_amazon_redirect_for_tunnel() {
  local public_url="$1"
  local redirect="${public_url}/api/amazon/oauth/callback"
  echo "==> Updating Amazon OAuth redirect URI ($redirect)"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    INSERT INTO settings (key, value, category, is_secret, updated_at)
    VALUES ('amazon_sp_redirect_uri', '$redirect', 'amazon', false, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, category = EXCLUDED.category, updated_at = NOW();
  " >/dev/null 2>&1; then
    echo "Amazon redirect URI set to $redirect"
  else
    echo "WARNING: Could not update amazon_sp_redirect_uri in DB" >&2
  fi
}

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -t -i:"${port}" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

echo "==> Stopping stale dev processes"
for port in 8080 19145 3000; do
  kill_port "$port"
done
sleep 3
for port in 8080 19145 3000; do
  if lsof -i:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARNING: port $port still in use — force killing again" >&2
    kill_port "$port"
    sleep 2
  fi
done

echo "==> Applying database schema (local sync)"
tmux_cmd kill-session -t db-push 2>/dev/null || true
tmux_cmd new-session -d -s db-push -c "$ROOT" -- bash -lc "
  export DATABASE_URL='$DATABASE_URL'
  bash scripts/sync-local-db.sh
"

echo "==> Starting API server (port 8080)"
tmux_cmd kill-session -t api-server-live 2>/dev/null || true
tmux_cmd new-session -d -s api-server-live -c "$ROOT" -- bash -lc "
  export DATABASE_URL='$DATABASE_URL'
  export PORT=8080
  export ENABLE_CLERK_PROXY=\"\${ENABLE_CLERK_PROXY:-true}\"
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
  export VITE_DISABLE_HMR=true
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

PUBLIC_URL=""
if should_skip_cloudflare_tunnel; then
  PUBLIC_URL=$(normalize_stable_public_url "$LOCAL_DEV_PUBLIC_URL")
  [[ -n "$PUBLIC_URL" ]] || PUBLIC_URL="http://127.0.0.1:3000"
  printf '%s\n' "$PUBLIC_URL" >"$PUBLIC_URL_FILE"
  echo "==> Skipping Cloudflare tunnel — stable local URL: $PUBLIC_URL" >&2
elif public_url=$(ensure_cloudflare_tunnel); then
  PUBLIC_URL="$public_url"
  printf '%s\n' "$PUBLIC_URL" >"$PUBLIC_URL_FILE"
fi

echo ""
echo "Stack ready"
echo "  Local:    http://127.0.0.1:3000/admin/dashboard"
if [[ -n "$PUBLIC_URL" ]]; then
  if should_skip_cloudflare_tunnel; then
    echo "  Stable:   $PUBLIC_URL/admin/dashboard  (localhost — URL never changes)"
    echo "  Sign in:  $PUBLIC_URL/sign-in"
    echo "  Amazon OAuth redirect: $PUBLIC_URL/api/amazon/oauth/callback"
  else
    echo "  Cloudflare: $PUBLIC_URL/admin/dashboard"
    echo "  Sign in:    $PUBLIC_URL/sign-in"
    if using_named_cloudflare_tunnel; then
      echo "  (stable named tunnel — URL does not change on restart)"
    else
      echo "  (quick tunnel — URL changes when dev-stack restarts; set SKIP_CLOUDFLARE_TUNNEL=true for localhost, or CLOUDFLARE_TUNNEL_TOKEN + CLOUDFLARE_TUNNEL_PUBLIC_URL)"
    fi
  fi
  echo ""
  if should_skip_cloudflare_tunnel; then
    echo "==> Configuring Amazon OAuth redirect for local dev"
    configure_amazon_redirect_for_tunnel "$PUBLIC_URL"
  else
    echo "==> Enabling Clerk proxy for Cloudflare (required for sign-in on trycloudflare.com)"
  fi
  CLERK_PROXY_FOR_STACK="${PUBLIC_URL}/api/__clerk"
  if ! should_skip_cloudflare_tunnel; then
    configure_clerk_proxy_for_tunnel "$PUBLIC_URL"
  fi
  if ! should_skip_cloudflare_tunnel; then
    configure_amazon_redirect_for_tunnel "$PUBLIC_URL"
  fi
  tmux_cmd kill-session -t api-server-live 2>/dev/null || true
  kill_port 8080
  kill_port 19145
  sleep 2

  tmux_cmd kill-session -t api-server-live 2>/dev/null || true
  tmux_cmd new-session -d -s api-server-live -c "$ROOT" -- bash -lc "
    export DATABASE_URL='$DATABASE_URL'
    export PORT=8080
    export ENABLE_CLERK_PROXY=true
    export CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
    export CLERK_SECRET_KEY='$CLERK_SEC_FOR_STACK'
    export ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
    export ALLOW_DEV_ADMIN_BOOTSTRAP=\"\${ALLOW_DEV_ADMIN_BOOTSTRAP:-true}\"
    export AI_INTEGRATIONS_OPENAI_BASE_URL=\"\${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.openai.com/v1}\"
    export AI_INTEGRATIONS_OPENAI_API_KEY=\"\${AI_INTEGRATIONS_OPENAI_API_KEY:-sk-dummy}\"
    pnpm --filter @workspace/api-server run dev
  "

  tmux_cmd kill-session -t frontend-live 2>/dev/null || true
  tmux_cmd new-session -d -s frontend-live -c "$ROOT" -- bash -lc "
    export PORT=19145
    export BASE_PATH=/
    export VITE_DISABLE_HMR=true
    export VITE_CLERK_PUBLISHABLE_KEY='$CLERK_PUB_FOR_STACK'
    export VITE_CLERK_PROXY_URL='$CLERK_PROXY_FOR_STACK'
    export VITE_ADMIN_USER_IDS='$ADMIN_IDS_FOR_STACK'
    while true; do
      pnpm --filter @workspace/listing-auditor run dev || true
      echo 'Frontend exited — restarting in 3s...'
      sleep 3
    done
  "

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
  echo "  Cloudflare: (still starting — check $TUNNEL_LOG)"
fi
