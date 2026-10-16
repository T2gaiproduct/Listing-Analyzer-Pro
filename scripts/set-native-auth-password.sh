#!/usr/bin/env bash
# Upsert native auth_credentials (see artifacts/api-server/src/cli/set-native-auth-password.ts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec pnpm --filter @workspace/api-server exec tsx src/cli/set-native-auth-password.ts "$@"
