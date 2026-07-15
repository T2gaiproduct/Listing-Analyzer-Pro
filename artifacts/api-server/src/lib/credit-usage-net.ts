export interface CreditUsageTx {
  id?: number;
  amount: number;
  featureType: string | null;
  createdAt: Date | string;
  metadata?: Record<string, unknown> | null;
}

/** Debit transaction IDs reversed by a matching adjustment refund. */
export function refundedDebitIds(transactions: CreditUsageTx[]): Set<number> {
  const ids = new Set<number>();
  for (const tx of transactions) {
    if (tx.amount <= 0 || tx.featureType !== "adjustment") continue;
    const refId = tx.metadata?.refundForTransactionId;
    if (typeof refId === "number") ids.add(refId);
  }
  return ids;
}

export function isRefundedDebit(tx: CreditUsageTx, refundedIds: Set<number>): boolean {
  return tx.amount < 0 && typeof tx.id === "number" && refundedIds.has(tx.id);
}

export function netSpentAmount(
  transactions: CreditUsageTx[],
  options?: { excludeFeatureTypes?: string[]; start?: Date; end?: Date },
): number {
  const exclude = new Set(options?.excludeFeatureTypes ?? ["subscription"]);
  const refunded = refundedDebitIds(transactions);

  return transactions.reduce((sum, tx) => {
    if (tx.amount >= 0) return sum;
    if (tx.featureType && exclude.has(tx.featureType)) return sum;
    if (isRefundedDebit(tx, refunded)) return sum;
    if (options?.start && options?.end) {
      const at = new Date(tx.createdAt);
      if (at < options.start || at > options.end) return sum;
    }
    return sum + Math.abs(tx.amount);
  }, 0);
}
