# Amazon Listing Auditor

An AI-powered tool for Amazon sellers to audit product listings — scoring title, bullet points, images, and keywords, with competitor comparison.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/listing-auditor run dev` — run the frontend (port 19145)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path prefix `/api`)
- Auth: Clerk (Replit-managed) — `@clerk/express` server-side, `@clerk/react` client-side
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`)
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Frontend: React + Vite + Wouter routing + shadcn/ui + TanStack Query
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/db/src/schema/` — Drizzle DB schema (`audits.ts`, `competitors.ts`)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — Clerk proxy (production only)
- `artifacts/api-server/src/lib/analyzer.ts` — AI analysis logic (OpenAI)
- `artifacts/listing-auditor/src/pages/` — frontend pages (landing, sign-in, sign-up, dashboard, audit-*)
- `artifacts/listing-auditor/src/components/` — shared components (layout, score-ring, image-gallery)
- `artifacts/listing-auditor/public/logo.svg` — branded logo used in Clerk auth pages

## Architecture decisions

- Contract-first: OpenAPI spec drives codegen for both client hooks and server Zod validators
- AI analysis is synchronous in the POST /audits handler — audit is inserted as "pending", analyzed, then updated to "complete" before the response is sent
- Competitor analysis runs server-side via the same OpenAI integration, comparing against the parent audit's listing
- Codegen post-step patches `lib/api-zod/src/index.ts` to remove duplicate type exports from Orval
- Stats route `/audits/stats` is declared before `/audits/:id` to avoid Express matching "stats" as an ID
- Auth: Clerk Replit-managed; `requireAuth` middleware on all audit routes; audits are scoped to `userId` (DB column)
- Clerk proxy middleware is production-only; dev uses Clerk's own CDN loaded via pk_test key
- `VITE_CLERK_PUBLISHABLE_KEY` is a Replit secret — the Vite server must be restarted after provisioning for it to pick it up
- Do NOT use `publishableKeyFromHost` on the client side — the white-label key encodes the app domain, causing Clerk to try loading its JS from `clerk.{hostname}` which doesn't resolve in dev

## Product

- Landing: public marketing page with feature highlights and CTAs to sign up / sign in
- Sign In / Sign Up: Clerk-powered auth pages with branded appearance (orange/navy theme, Plus Jakarta Sans font)
- Dashboard: per-user portfolio overview with score stats and recent audits list
- New Audit: multi-section form (product info, title, bullets, images, keywords) → AI scores 4 categories 0-100
- Audit Detail: overall score ring, per-category breakdowns with issues + suggestions, competitor comparison table
- Add Competitor: analyze a rival listing and compare strengths/weaknesses side-by-side
- Image Studio: per-image regenerate/edit with style presets, aspect ratios, version history

## User preferences

_Populate as you build._

## Gotchas

- Do not run `pnpm dev` at workspace root — workflows handle this
- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after schema changes (dev only)
- API server rebuilds on each workflow restart (esbuild, ~500ms)
- After adding new Replit secrets, restart the Vite dev server workflow so it picks them up
- Do NOT use `publishableKeyFromHost` on the Vite client — use `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` directly
- Clerk auth is required for all `/api/audits/*` routes; existing audits without a `userId` won't be visible (expected for dev seed data)

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure and TypeScript setup
- See `.local/skills/ai-integrations-openai` for OpenAI integration details
