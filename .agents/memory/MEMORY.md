# Memory

- [Custom credit purchase flow](custom-credit-purchase.md) — Stripe `success_url` must include `{CHECKOUT_SESSION_ID}` placeholder so the frontend can call `/api/buy-credits/confirm`. Passing `amount_creditType` directly means the backend never records the transaction.
- [Payment idempotency](payment-idempotency.md) — Always guard confirm endpoints by checking `paymentsTable.gatewayPaymentId` against the incoming sessionId before creating duplicate records. This prevents double-crediting on page refresh.
- [Dynamic Tailwind classes](tailwind-colors.md) — `bg-${color}-50` won't render in production. Always use hardcoded string maps for dynamic colors.
- [Landing page pricing sync](homepage-sync.md) — Homepage pricing section should fetch from `/api/plans` instead of hardcoding, to stay in sync with DB values and admin edits.
- [Checkout HTML error parse](checkout-html-error-parse.md) — "The string did not match the expected pattern" on checkout = server threw unhandled error → HTML body → client `r.json()` fails. Fix server-side, always return JSON errors.
