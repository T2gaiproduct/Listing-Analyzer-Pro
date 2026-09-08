function errorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? err.cause.message : "";
  return `${err.message}\n${cause}`;
}

export function isMissingProductOrdersColumnError(err: unknown, column: string): boolean {
  const message = errorText(err);
  return message.toLowerCase().includes(column.toLowerCase())
    && /does not exist|failed query/i.test(message);
}

export function formatProductOrderSyncError(err: unknown, orderLabel?: string): string {
  const message = err instanceof Error ? err.message : String(err);

  if (isMissingProductOrdersColumnError(err, "payment_status")) {
    return "Order sync needs the product_orders.payment_status column. Run scripts/sync-production-db.sh on the server.";
  }

  if (/Failed query:/i.test(message)) {
    const label = orderLabel ? `Order ${orderLabel}` : "Order sync";
    return `${label} could not be saved. If this persists, run the production database schema upgrade.`;
  }

  if (message.length > 220) {
    return orderLabel
      ? `Could not save order ${orderLabel}.`
      : "Could not save marketplace order.";
  }

  return message;
}
