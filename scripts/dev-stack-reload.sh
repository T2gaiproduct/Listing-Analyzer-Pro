#!/usr/bin/env bash
# Rebuild frontend + restart API/proxy without restarting cloudflared — keeps the same trycloudflare.com URL.
# After code changes on Cloud Agent, prefer THIS script over full dev-stack.sh (full restart = new random trycloudflare hostname).
# Defaults to native auth; do not run bare `pnpm --filter @workspace/listing-auditor run build` on Cloud Agent (Clerk keys in env bake Clerk UI).
set -euo pipefail
unset DEV_STACK_USE_CLERK 2>/dev/null || true
export DEV_STACK_RELOAD_ONLY=1
exec bash "$(cd "$(dirname "$0")" && pwd)/dev-stack.sh"
