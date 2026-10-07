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

/** Feature types that are funding/transfers, not consumption. */
export const BILLING_USAGE_EXCLUDED_FEATURES = ["subscription", "workspace_pool_transfer"] as const;

/** Period consumption by feature, matching team/workspace Used filters. */
export function aggregatePeriodUsage(transactions: CreditUsageTx[]): {
  totalSpent: number;
  spentByFeatureType: Record<string, number>;
} {
  const exclude = new Set<string>(BILLING_USAGE_EXCLUDED_FEATURES);
  const refunded = refundedDebitIds(transactions);
  const spentByFeatureType: Record<string, number> = {};
  let totalSpent = 0;
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const ft = tx.featureType ?? "other";
    if (exclude.has(ft)) continue;
    if (isRefundedDebit(tx, refunded)) continue;
    const spent = Math.abs(tx.amount);
    spentByFeatureType[ft] = (spentByFeatureType[ft] ?? 0) + spent;
    totalSpent += spent;
  }
  return { totalSpent, spentByFeatureType };
}

export function spentForFeatureTypes(
  spentByFeatureType: Record<string, number>,
  featureTypes: readonly string[],
): number {
  return featureTypes.reduce((sum, ft) => sum + (spentByFeatureType[ft] ?? 0), 0);
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
