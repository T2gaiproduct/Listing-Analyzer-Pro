# Amazon Listing Auditor (SellerLens)

AI-powered Amazon listing audits, competitor analysis, graphics, and subscription billing.

## Quick start

1. Copy environment template: `cp .env.example .env` and fill in real values.
2. Install: `pnpm install --frozen-lockfile`
3. Database: start Postgres, set `DATABASE_URL`, then `pnpm --filter @workspace/db run push`
4. API: `pnpm --filter @workspace/api-server run dev` (port 8080)
5. Frontend: `PORT=19145 BASE_PATH=/ pnpm --filter @workspace/listing-auditor run dev`

See `replit.md` and `DEPLOY.md` for full architecture and production deployment.

## Environment variables

All secrets must live in `.env` or your host's secret manager — never in source code.

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Server only | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Server only | Clerk backend secret |
| `CLERK_PUBLISHABLE_KEY` | Server | Same value as Vite publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client (build-time) | Clerk publishable key — safe to expose |
| `VITE_CLERK_PROXY_URL` | Client (optional) | Public Clerk proxy URL |
| `VITE_ADMIN_USER_IDS` | Client (optional) | Dev UI shortcut only; does not grant server admin |
| `AI_INTEGRATIONS_OPENAI_*` | Server only | Legacy module boot; real AI key is in Admin → AI Settings (DB) |
| Payment / SMTP / Amazon keys | Server + DB settings | Configured via Admin UI; stored with `is_secret` flag |

Full list: `.env.example`

### Client-exposed `VITE_*` variables

Vite embeds any `VITE_*` variable into the browser bundle. Only put **public-safe** values there:

- OK: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`
- Never: `CLERK_SECRET_KEY`, Stripe secret key, database URL, OpenAI secret key, SMTP password, service-role keys

OpenAI, Stripe secret, Razorpay/PayPal secrets, and SMTP credentials are stored server-side in the `settings` table (masked in API responses).

## Security — rotate secrets if they were ever committed

**If any real API key, password, or token was ever committed to this repository (including `.replit`, shell scripts, or docs), assume it is compromised.** Git history retains old values even after deletion.

Rotate immediately:

1. **Clerk** — rotate secret key in Clerk Dashboard; update `CLERK_SECRET_KEY` and redeploy.
2. **OpenAI** — revoke and create a new key; update Admin → AI Settings.
3. **Stripe / Razorpay / PayPal** — roll keys in each provider dashboard; update Admin → Payment Settings.
4. **Database** — change the DB user password and update `DATABASE_URL`.
5. **SMTP** — rotate SMTP credentials.
6. **Amazon SP-API / AWS** — rotate IAM and LWA credentials.

After rotation, consider `git filter-repo` or GitHub secret scanning if production keys were exposed.

## Docs

- `replit.md` — monorepo layout and dev commands
- `DEPLOY.md` — production deployment (Nginx, PM2, SSL)
- `AGENTS.md` — Cursor Cloud agent operating notes
