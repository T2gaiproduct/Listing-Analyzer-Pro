export type RevenueCalculatorInput = {
  sellingPrice: number;
  cogs: number;
  referralFeePercent: number;
  closingFee: number;
  fbaFee: number;
  otherCosts: number;
  unitsPerMonth: number;
};

export type RevenueCalculatorResult = {
  referralFee: number;
  totalFees: number;
  netProfitPerUnit: number;
  marginPercent: number;
  breakEvenPrice: number;
  estimatedMonthlyProfit: number;
};

export function computeRevenueCalculator(
  input: RevenueCalculatorInput,
): RevenueCalculatorResult | null {
  const sellingPrice = input.sellingPrice;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return null;

  const referralFee = Math.max(0, sellingPrice * (input.referralFeePercent / 100));
  const closingFee = Math.max(0, input.closingFee);
  const fbaFee = Math.max(0, input.fbaFee);
  const otherCosts = Math.max(0, input.otherCosts);
  const cogs = Math.max(0, input.cogs);

  const totalFees = referralFee + closingFee + fbaFee + otherCosts;
  const netProfitPerUnit = sellingPrice - cogs - totalFees;
  const marginPercent = (netProfitPerUnit / sellingPrice) * 100;

  const fixedPerUnit = cogs + closingFee + fbaFee + otherCosts;
  const referralRate = input.referralFeePercent / 100;
  const breakEvenPrice = referralRate >= 1
    ? sellingPrice
    : fixedPerUnit / Math.max(0.0001, 1 - referralRate);

  const units = Math.max(0, input.unitsPerMonth);
  const estimatedMonthlyProfit = netProfitPerUnit * units;

  return {
    referralFee,
    totalFees,
    netProfitPerUnit,
    marginPercent,
    breakEvenPrice,
    estimatedMonthlyProfit,
  };
}

/**
 * Suggested referral % by broad category label (manual estimates).
 * Not marketplace-specific — sellers should adjust for US/UK/EU/IN/etc. Seller Central rates.
 */
export function defaultReferralFeePercentForCategory(category: string | null | undefined): number {
  const c = category?.trim().toLowerCase() ?? "";
  if (c.includes("watch")) return 15;
  if (c.includes("jewel")) return 12;
  if (c.includes("cloth") || c.includes("apparel") || c.includes("fashion")) return 17;
  if (c.includes("electron") || c.includes("computer")) return 8;
  if (c.includes("book")) return 15;
  if (c.includes("grocery") || c.includes("food")) return 8;
  return 10;
}
