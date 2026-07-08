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

### Full UI E2E — same-origin proxy + auth testing (important gotchas)
- The frontend has no Vite `/api` proxy, so for a working UI run a reverse proxy that serves the SPA and forwards `/api` to the API. A minimal Node proxy (route `/api*` → `127.0.0.1:8080`, everything else + websocket upgrades → `127.0.0.1:19145`) on a spare port works; then browse to the proxy port so `/api` calls resolve.
- Clerk **sign-up** is blocked in this VM: the instance has bot-protection CAPTCHA (Smart CAPTCHA/Turnstile) that can't load headlessly ("The CAPTCHA failed to load"). Do NOT try to demo account creation through the UI.
- To test authenticated flows, create the user via the **Clerk Backend API** (bypasses CAPTCHA), then **sign in** through the UI (sign-in has no CAPTCHA):
  - `curl -X POST https://api.clerk.com/v1/users -H "Authorization: Bearer $CLERK_SECRET_KEY" -H 'Content-Type: application/json' -d '{"email_address":["demo+clerk_test@example.com"],"password":"DemoAudit!2026","skip_password_checks":true}'`
  - Use a Clerk **test email** (`+clerk_test@example.com`); `.test`/disposable TLDs are rejected. The email-code verification step accepts the fixed dev code **`424242`**.
- With real Clerk keys, signing in reaches the dashboard and the API authenticates the session (profile/stats/credits load from Postgres). Creating an audit still needs a real AI key.

### AI provider configuration (audits / content / images)
- The default AI provider is **OpenAI**, and its key is read from the **DB `settings` table** (`openai_api_key`, optional `openai_base_url`) — i.e. the **Admin → AI Settings** screen — NOT from the `AI_INTEGRATIONS_OPENAI_*` env (those are only used by the legacy `replit` provider). See `artifacts/api-server/src/lib/openai-client.ts` / `ai-provider.ts`.
- The chat model is hardcoded to **`gpt-5.4`** and images to `gpt-image-1.5`; the OpenAI key must have access to those. To enable AI, upsert `settings` rows `ai_provider=openai` and `openai_api_key=<key>` (the client caches by key, so restart the API or change the key to refresh).
- Audit/content/image endpoints require **credits** from the `credits` table (audit = 1 audit credit by default). A brand-new user has 0 credits until onboarding/plan grants them; for testing you can insert a `credits` row for the user id.

### External secrets
- Real Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are required for auth / any UI — currently provisioned.
- A real OpenAI key enables the full audit flow; when present it lives in the DB `settings` table (see above). The `AI_INTEGRATIONS_OPENAI_API_KEY` env is only a dummy and does not drive the default OpenAI provider.
