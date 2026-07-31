#!/usr/bin/env bash
set -euo pipefail

# Keeps API, frontend, and dev proxy alive without touching the Cloudflare tunnel.
# Started automatically by dev-stack.sh; safe to run standalone.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-stack-lib.sh
source "$ROOT/scripts/dev-stack-lib.sh"

CLERK_PROXY_FOR_STACK="${CLERK_PROXY_FOR_STACK:-}"
if [[ -f "$PUBLIC_URL_FILE" && -z "$CLERK_PROXY_FOR_STACK" ]]; then
  public_url=$(tr -d '[:space:]' <"$PUBLIC_URL_FILE")
  if [[ -n "$public_url" ]]; then
    CLERK_PROXY_FOR_STACK="${public_url}/api/__clerk"
  fi
fi

ENABLE_CLERK_PROXY="false"
if [[ -n "$CLERK_PROXY_FOR_STACK" ]]; then
  ENABLE_CLERK_PROXY="true"
fi

echo "Dev watchdog running (checks every 20s; tunnel session '$TUNNEL_SESSION' is never restarted)"

while true; do
  if ! api_healthy; then
    echo "[watchdog] API down — restarting"
    start_api_server "$ENABLE_CLERK_PROXY"
    sleep 5
  fi

  if ! frontend_healthy; then
    echo "[watchdog] Frontend down — restarting"
    start_frontend "$CLERK_PROXY_FOR_STACK"
    sleep 8
  fi

  if ! local_proxy_healthy; then
    echo "[watchdog] Dev proxy down — restarting"
    start_dev_proxy
    sleep 3
  fi

  sleep 20
done
