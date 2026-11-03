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
- If the DB is ever missing/empty, recreate it: `sudo -u postgres psql -c "CREATE ROLE lauser LOGIN PASSWORD 'lapass' CREATEDB;"` then `sudo -u postgres createdb -O lauser listingauditor`, then `bash scripts/sync-local-db.sh` (or `DATABASE_URL=... pnpm --filter @workspace/db run push` and `seed-plans`).
- After schema changes in `lib/db/src/schema/`, run `bash scripts/sync-local-db.sh` locally and `bash scripts/sync-production-db.sh` on production (same additive SQL + drizzle push). `bash scripts/check-production-schema.sh` verifies critical columns (including `audits.reference_research`).

### Local / Cloud Agent auth (`bash scripts/dev-stack.sh`)
- **`scripts/dev-stack.sh` and `dev-stack-reload.sh` default to native email/password auth** — no Clerk CDN, `/api/__clerk` proxy, or `CLERK_*` / `VITE_CLERK_*` keys required on the preview link.
- API: `NATIVE_AUTH_ENABLED=true`, `AUTH_SESSION_SECRET` (defaults to a dev value if unset), `AUTH_COOKIE_SECURE=false` on the stack.
- Frontend build: `VITE_AUTH_PROVIDER=native` (Vite aliases `@clerk/react` to the native sign-in UI).
- Dev user (created idempotently): **`dev@local.test`** / **`DevAudit!2026`** — override with `DEV_STACK_LOGIN_EMAIL` / `DEV_STACK_LOGIN_PASSWORD`. Sign up on the preview also works (no Clerk CAPTCHA).
- Opt back into **Clerk** on local preview: `DEV_STACK_USE_CLERK=true bash scripts/dev-stack.sh` (requires valid Clerk keys in Environment).
- Production / sellerlens.io stays on Clerk until you deploy with `VITE_AUTH_PROVIDER=native` (see `docs/AUTH-MIGRATION.md`).

### Running the API server (port 8080) manually
- Required: `DATABASE_URL`, `PORT=8080`, dummy or real `AI_INTEGRATIONS_OPENAI_*` (see `lib/integrations-openai-ai-server/src/client.ts`).
- **Native auth:** `NATIVE_AUTH_ENABLED=true` and `AUTH_SESSION_SECRET=...` — no Clerk keys.
- **Clerk mode:** `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (dummy pair documented in older notes still works for signed-out public routes).
- Run: `pnpm --filter @workspace/api-server run dev`. `GET /api/healthz` includes `apiBuildId` / `staleProcess`. Stripe init failing on boot is expected and non-fatal.

### Running the frontend (port 19145) manually
- Vite config throws unless `PORT` and `BASE_PATH` are set: `PORT=19145 BASE_PATH=/`.
- **Native:** `VITE_AUTH_PROVIDER=native` — no `VITE_CLERK_PUBLISHABLE_KEY`.
- **Clerk:** requires a real, network-reachable `VITE_CLERK_PUBLISHABLE_KEY`.
- There is **no Vite dev proxy** for `/api`; the frontend calls `${BASE_PATH}/api/...` on its own origin. For full UI E2E you need a reverse proxy so the frontend origin also serves the API on `/api` (see `DEPLOY.md` Nginx example), or serve the built frontend from the API host.

### Quality gate / tests
- There is **no ESLint config and no automated test suite**. The quality gate is `pnpm run typecheck`.
- Note: `pnpm run typecheck` currently fails on one pre-existing frontend error in `artifacts/listing-auditor/src/pages/audit-workflow.tsx` (`project.imageRecords` possibly undefined). This is unrelated to environment setup. `pnpm run build` runs typecheck first, so build per-package (`pnpm --filter <pkg> run build`) to bypass it; both `api-server` (esbuild) and `listing-auditor` (vite) build cleanly on their own.

### Full UI E2E — same-origin proxy + auth testing (important gotchas)
- The frontend has no Vite `/api` proxy, so for a working UI run a reverse proxy that serves the SPA and forwards `/api` to the API. A minimal Node proxy (route `/api*` → `127.0.0.1:8080`, everything else + websocket upgrades → `127.0.0.1:19145`) on a spare port works; then browse to the proxy port so `/api` calls resolve.
- **Cloudflare preview URL:** `scripts/dev-stack.sh` starts a tunnel to port 3000. Quick tunnels (`*.trycloudflare.com`) **always get a new random hostname** when the tunnel restarts — they cannot be made permanent. When a tunnel is enabled, dev-stack **builds the frontend and runs `vite preview`** (not Vite dev/HMR) so the preview page is not blank behind Cloudflare. After code changes, prefer **`bash scripts/dev-stack-reload.sh`** to rebuild API/frontend/proxy **without** restarting `cloudflared` so the same trycloudflare URL keeps working. Use full `dev-stack.sh` only when the tunnel is missing or you need a first-time URL.
- **Staging/production deploys:** Do **not** set `VITE_CLOUD_AGENT_PREVIEW` or `ENABLE_CLOUD_AGENT_QUICK_TUNNEL`. Quick-tunnel auth/onboarding helpers are opt-in; dev-stack sets them only for ephemeral `*.trycloudflare.com` runs so merging `staging` → `main` does not enable Cloudflare-only behavior on `sellerlens.io`.
- **Stable preview URL (recommended):** Create a **named Cloudflare Tunnel** on your zone (e.g. `https://dev-preview.sellerlens.io` → `http://127.0.0.1:3000` in the Cloud Agent VM). Add environment secrets:
  - `CLOUDFLARE_TUNNEL_TOKEN` — tunnel run token from Cloudflare Zero Trust → Networks → Tunnels
  - `CLOUDFLARE_TUNNEL_PUBLIC_URL` — exact public URL, e.g. `https://dev-preview.sellerlens.io`
  Then `bash scripts/dev-stack.sh` uses the named tunnel and the URL stays the same across restarts. Register the same hostname in Amazon OAuth (redirect + login URI) and Clerk if needed.
- **Stable local Amazon testing:** `SKIP_CLOUDFLARE_TUNNEL=true bash scripts/dev-stack.sh` uses `http://127.0.0.1:3000` inside the VM. **On Cloud Agent, your laptop browser cannot open that URL** (`ERR_CONNECTION_REFUSED`) — `127.0.0.1` is the remote VM, not your PC. From your browser use the Cloudflare preview link, a named tunnel hostname, or `https://sellerlens.io`. Register the **same host you browse** in Amazon OAuth (redirect + login URI).
- **Clerk-only** (when `DEV_STACK_USE_CLERK=true`): sign-up CAPTCHA often fails on `*.trycloudflare.com`; do not repoint production Clerk `proxy_url` to quick tunnels (breaks sellerlens.io). Use named tunnel + Clerk keys if you must test Clerk on preview.
- **Native dev-stack (default):** sign in at `/sign-in` with `dev@local.test` / `DevAudit!2026` or register a new account on the preview URL.
- Creating an audit still needs OpenAI configured in Admin → AI Settings (DB `settings` table) and credits for the user.

### AI provider configuration (audits / content / images)
- The default AI provider is **OpenAI**, and its key is read from the **DB `settings` table** (`openai_api_key`, optional `openai_base_url`) — i.e. the **Admin → AI Settings** screen — NOT from the `AI_INTEGRATIONS_OPENAI_*` env (those are only used by the legacy `replit` provider). See `artifacts/api-server/src/lib/openai-client.ts` / `ai-provider.ts`.
- The chat model is hardcoded to **`gpt-5.4`** and images to `gpt-image-1.5`; the OpenAI key must have access to those. To enable AI, upsert `settings` rows `ai_provider=openai` and `openai_api_key=<key>` (the client caches by key, so restart the API or change the key to refresh).
- Audit/content/image endpoints require **credits** from the `credits` table (audit = 1 audit credit by default). A brand-new user has 0 credits until onboarding/plan grants them; for testing you can insert a `credits` row for the user id.

### External secrets
- **Local dev-stack:** no Clerk secrets required (native auth). **Production / Clerk mode:** real Clerk keys as today.
- A real OpenAI key enables the full audit flow; when present it lives in the DB `settings` table (see above). The `AI_INTEGRATIONS_OPENAI_API_KEY` env is only a dummy and does not drive the default OpenAI provider.
- **Dropbox Excel image URLs (optional):** When `DROPBOX_ACCESS_TOKEN` is set on the API server, Amazon/multi-marketplace **Excel and CSV export** upload listing images to Dropbox and write **Dropbox direct links** in `main_image_url` / `other_image_url*` (instead of signed `/api/marketplace-publish/images/…?token=…`). Requires Dropbox app scopes `files.content.write` and `sharing.write`. Optional `DROPBOX_EXPORT_PREFIX` (default `/ecommerce-guru/exports`). Live marketplace publish is unchanged. Without the token, export keeps the previous signed-URL behavior.
