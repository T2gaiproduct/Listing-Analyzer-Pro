#!/usr/bin/env bash
# Rebuild frontend + restart API/proxy without restarting cloudflared — keeps the same trycloudflare.com URL.
# After code changes on Cloud Agent, prefer THIS script over full dev-stack.sh (full restart = new random trycloudflare hostname).
set -euo pipefail
export DEV_STACK_RELOAD_ONLY=1
exec bash "$(cd "$(dirname "$0")" && pwd)/dev-stack.sh"
