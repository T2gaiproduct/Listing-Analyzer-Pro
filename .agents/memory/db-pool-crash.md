---
name: DB pool crash prevention
description: Why and how to prevent the pg pool unhandled error from crashing the production server
---

## The rule
`lib/db/src/index.ts` must register `pool.on('error', handler)`. The server entry `artifacts/api-server/src/index.ts` must register `process.on('uncaughtException')` and `process.on('unhandledRejection')` before anything else.

## Why
When Replit's production Postgres service performs routine connection termination (e.g., maintenance), the `pg` BoundPool emits an `'error'` event on idle clients. If no handler is registered, Node.js treats it as an uncaught exception and kills the process — causing all in-flight requests to fail and a cold restart (~5s downtime). This was confirmed in production logs showing repeated `terminating connection due to administrator command` errors immediately followed by healthcheck failures and `signal: terminated`.

## How to apply
Pool config in `lib/db/src/index.ts`:
```ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
pool.on("error", (err) => {
  console.error("[DB pool] idle client error — will reconnect:", err.message);
});
```

Process guards at the very top of `artifacts/api-server/src/index.ts` (before any imports that could throw):
```ts
process.on("uncaughtException", (err) => { logger.error({ err }, "Uncaught exception — server remains up"); });
process.on("unhandledRejection", (reason) => { logger.error({ reason }, "Unhandled rejection — server remains up"); });
```

The pg pool self-heals after connection drops — no manual reconnect logic needed. The error handler just prevents the process from dying.
