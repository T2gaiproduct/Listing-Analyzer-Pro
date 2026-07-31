#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-stack-lib.sh
source "$ROOT/scripts/dev-stack-lib.sh"

url=""
if [[ -f "$PUBLIC_URL_FILE" ]]; then
  url=$(tr -d '[:space:]' <"$PUBLIC_URL_FILE")
fi
url="${url:-$(tunnel_url_from_log)}"

if [[ -z "$url" ]]; then
  echo "No Cloudflare URL yet. Run: bash scripts/dev-stack.sh" >&2
  exit 1
fi

if ! tunnel_session_running; then
  echo "WARNING: cloudflared session is not running — URL may be stale" >&2
fi

echo "$url"
echo "  Admin:  $url/admin/dashboard"
echo "  Sign in: $url/sign-in"

if local_stack_healthy; then
  echo "  Status: local stack healthy"
else
  echo "  Status: local stack not fully ready (watchdog should recover shortly)" >&2
fi
