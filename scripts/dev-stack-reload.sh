#!/usr/bin/env bash
# Rebuild frontend + restart API/proxy without restarting cloudflared — keeps the same trycloudflare.com URL.
set -euo pipefail
export DEV_STACK_RELOAD_ONLY=1
exec bash "$(cd "$(dirname "$0")" && pwd)/dev-stack.sh"
