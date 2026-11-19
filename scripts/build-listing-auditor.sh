#!/usr/bin/env bash
# Production Vite build for small VPS (avoids exit 137 / OOM). Works under dash/sh (no bash ${var:-} in package.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/artifacts/listing-auditor"

export VITE_BUILD_LOW_MEMORY=1
export VITE_BUILD_ULTRA_LOW_MEMORY=1
export PORT=19145
export BASE_PATH=/
export NODE_ENV=production

if [[ -z "${NODE_OPTIONS:-}" ]]; then
  # Cap V8 heap — large heaps on 2GB VMs trigger kernel OOM kills before Node throws.
  export NODE_OPTIONS="--max-old-space-size=1024"
fi

echo "==> listing-auditor build (low-memory) NODE_OPTIONS=${NODE_OPTIONS}" >&2
exec vite build --config vite.config.ts