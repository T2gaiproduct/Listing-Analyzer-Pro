# SellerLens auth migration (Clerk → native)

This document describes the approved migration while **preserving existing behavior** until you explicitly cut over.

## Goals

- Keep **`user_id` = Clerk id** for all existing Postgres rows (audits, credits, workspaces, billing, etc.).
- **Cannot import passwords** from Clerk; migrated users set a new password or sign in with Google again.
- **No member-dashboard or Clerk UI changes** until `VITE_AUTH_PROVIDER=native` on staging/production.
- **Dual mode**: production stays on Clerk until env flags enable native auth.

## Phases

| Phase | Scope | Production default |
|-------|--------|-------------------|
| **1 (this PR)** | DB tables, `/api/auth/*`, session cookies + Bearer, shared `requireAuth`, Clerk user import script | Clerk unchanged |
| **2** | Staging: `VITE_AUTH_PROVIDER=native` sign-in/up UI, `NativeAuthBridge` for API tokens | Test on staging only |
| **3** | Email templates, forced password reset campaign, Google OAuth client on your domain | Staging QA |
| **4** | Cutover: disable Clerk keys, remove Clerk packages, proxy cleanup | After approval |

## Data model

- `auth_credentials` — one row per user (`user_id` text PK, same as Clerk id for imports).
- `auth_oauth_identities` — Google `sub` → `user_id`.
- `auth_sessions` — server-side sessions (cookie + optional Bearer token).
- `auth_password_reset_tokens` — one-time reset links.

Passwords: **scrypt** (Node `crypto`), never stored in plaintext.

## Env (Phase 1+)

| Variable | Purpose |
|----------|---------|
| `NATIVE_AUTH_ENABLED` | `true` to register `/api/auth/*` and accept native sessions (default off) |
| `AUTH_SESSION_SECRET` | HMAC/signing for session ids and OAuth state (required when native enabled) |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google sign-in |
| `GOOGLE_OAUTH_REDIRECT_URI` | e.g. `https://test.sellerlens.io/api/auth/google/callback` |
| `AUTH_COOKIE_SECURE` | `true` in production (HTTPS) |
| `VITE_AUTH_PROVIDER` | `clerk` (default) or `native` (Phase 2 frontend) |

Clerk env vars remain required until Phase 4.

## Import Clerk export

```bash
DATABASE_URL=... pnpm --filter @workspace/api-server exec tsx scripts/import-clerk-auth-users.ts /path/to/clerk-users.json
```

Imports ids, emails, verification flags, and Google links — **not** passwords.

## Security notes

- Sessions are HttpOnly cookies; CSRF for cookie-only flows uses SameSite=Lax and OAuth state HMAC.
- Rate-limit login/forgot-password before production cutover (Phase 3).
- Rotate `AUTH_SESSION_SECRET` invalidates all native sessions.

## Branching

Per `.github/BRANCHING.md`: merge feature → `staging`, test, then `staging` → `main`.
