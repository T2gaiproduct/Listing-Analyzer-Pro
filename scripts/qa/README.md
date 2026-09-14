# QA automation (local / staging)

Safe-by-default API checks for the Amazon Listing Auditor monorepo. **Do not** point load tests at production without explicit approval.

## Prerequisites

- Postgres running (`sudo pg_ctlcluster 16 main start`)
- API on port 8080 (see `AGENTS.md`)
- Optional: dev proxy on 3000, frontend on 19145
- [k6](https://k6.io/) for load scripts

## Commands

| Script | Command |
|--------|---------|
| Smoke | `PROXY_URL=http://127.0.0.1:3000 pnpm run test:qa:smoke` |
| Integration | `pnpm run test:qa:integration` |
| DB failure | `RUN_DB_DOWN_TEST=1 pnpm run test:qa:integration` |
| Security | `pnpm run test:qa:security` |
| Concurrency | `pnpm run test:qa:concurrency` |
| Load | `pnpm run test:qa:load` |
| Stress | `k6 run -e MAX_VUS=500 scripts/qa/load-stress.k6.js` |

Environment variables: `BASE_URL`, `PROXY_URL`, `FRONTEND_URL`, `QA_OUT`.

Existing plan tests: `pnpm test` at repo root.
