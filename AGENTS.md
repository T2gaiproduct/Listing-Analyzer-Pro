# AGENTS.md

Project overview, run/build commands, and architecture live in `replit.md` and `DEPLOY.md`. Read those first — this file only adds cloud-agent-specific operating notes.

## Cursor Cloud specific instructions

This is a pnpm workspace monorepo (Node.js, TypeScript) for the **Amazon Listing Auditor** SaaS. The two runnable dev services are the Express **API server** (`@workspace/api-server`, port 8080) and the React/Vite **frontend** (`@workspace/listing-auditor`, port 19145). Standard commands are documented in `replit.md`.

### Startup layer vs. this file
- The update script only runs `pnpm install --frozen-lockfile`. Everything below (starting Postgres, exporting env, running services) is a manual/service step — do NOT add it to the update script.

### PostgreSQL (local dev DB)
- Postgres is installed in the VM image but is **not started automatically**. Start it each session:
  - `sudo pg_ctlcluster 16 main start`
- A local dev database already exists in the image (role `lauser` / password `lapass`, database `listingauditor`). The Drizzle schema and seeded plans persist in the cluster's data dir. Connection string:
  - `export DATABASE_URL="postgresql://lauser:lapass@127.0.0.1:5432/listingauditor"`
- If the DB is ever missing/empty, recreate it: `sudo -u postgres psql -c "CREATE ROLE lauser LOGIN PASSWORD 'lapass' CREATEDB;"` then `sudo -u postgres createdb -O lauser listingauditor`, then `DATABASE_URL=... pnpm --filter @workspace/db run push` and `DATABASE_URL=... pnpm --filter @workspace/db run seed-plans`.

### Running the API server (port 8080)
- The API requires several env vars just to boot and serve **any** route:
  - `DATABASE_URL` (see above), `PORT=8080`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — module-level throw at import if unset (`lib/integrations-openai-ai-server/src/client.ts`). Dummy values let the server boot; real values are only needed for AI audits/content/image generation.
  - `CLERK_PUBLISHABLE_KEY` **and** `CLERK_SECRET_KEY` — `clerkMiddleware` runs on every request and 500s the whole app if either is missing. Clerk's well-known dummy pair lets signed-out (public) routes work: `CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k`, `CLERK_SECRET_KEY=sk_test_<any-40+-char-string>`. With dummies, public routes (`/api/healthz`, `/api/plans`, `/api/fetch-listing`, `/api/credit-*`) work and auth-gated routes correctly return 401.
- Run: `pnpm --filter @workspace/api-server run dev` (esbuild bundle → `dist/index.mjs`, then node). Stripe init failing on boot ("Missing Replit environment variables") is expected and non-fatal.

### Running the frontend (port 19145)
- Vite config throws unless `PORT` and `BASE_PATH` are set: `PORT=19145 BASE_PATH=/`.
- The SPA renders **nothing** without a real, network-reachable Clerk instance: `App.tsx` throws if `VITE_CLERK_PUBLISHABLE_KEY` is unset, and the landing page waits on `useUser().isLoaded`, which never completes if Clerk JS can't load. The dummy key above is NOT reachable, so the UI shows a runtime-error overlay. A **real** `VITE_CLERK_PUBLISHABLE_KEY` (from a live Clerk instance) is required to see/exercise any UI.
- There is **no Vite dev proxy** for `/api`; the frontend calls `${BASE_PATH}/api/...` on its own origin. For full UI E2E you need a reverse proxy so the frontend origin also serves the API on `/api` (see `DEPLOY.md` Nginx example), or serve the built frontend from the API host.

### Quality gate / tests
- There is **no ESLint config and no automated test suite**. The quality gate is `pnpm run typecheck`.
- Note: `pnpm run typecheck` currently fails on one pre-existing frontend error in `artifacts/listing-auditor/src/pages/audit-workflow.tsx` (`project.imageRecords` possibly undefined). This is unrelated to environment setup. `pnpm run build` runs typecheck first, so build per-package (`pnpm --filter <pkg> run build`) to bypass it; both `api-server` (esbuild) and `listing-auditor` (vite) build cleanly on their own.

### External secrets needed for full E2E (not present in this environment)
- Real Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) for auth / any UI.
- An AI provider key (OpenAI/Gemini via `AI_INTEGRATIONS_OPENAI_*`, or configured in Admin → AI Settings) for audits, content, and image generation.
