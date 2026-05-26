# Memory

- [Custom credit purchase flow](custom-credit-purchase.md) — Stripe `success_url` must include `{CHECKOUT_SESSION_ID}` placeholder so the frontend can call `/api/buy-credits/confirm`. Passing `amount_creditType` directly means the backend never records the transaction.
- [Payment idempotency](payment-idempotency.md) — Always guard confirm endpoints by checking `paymentsTable.gatewayPaymentId` against the incoming sessionId before creating duplicate records. This prevents double-crediting on page refresh.
