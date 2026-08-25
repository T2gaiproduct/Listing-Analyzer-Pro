#!/bin/bash
set -e
pnpm install --frozen-lockfile
# On Replit/production, DATABASE_URL points at the live database — use full production sync.
pnpm run db:sync-production
pnpm --filter @workspace/api-server run build
