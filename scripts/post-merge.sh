#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run db:sync-local
pnpm --filter @workspace/api-server run build
