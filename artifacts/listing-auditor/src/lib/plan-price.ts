export interface PlanPriceFields {
  priceMonthly: number;
  priceYearly: number;
}

export type PlanPriceDisplay =
  | { kind: "custom" }
  | { kind: "price"; amount: number; period: "/mo" | "/year"; billedYearly?: boolean };

/** Display price from admin plan fields — yearly uses priceYearly ($/mo when billed yearly). */
export function resolvePlanPriceDisplay(plan: PlanPriceFields, yearly: boolean): PlanPriceDisplay {
  if (yearly && plan.priceYearly > 0) {
    return { kind: "price", amount: plan.priceYearly, period: "/mo", billedYearly: true };
  }

  return { kind: "price", amount: plan.priceMonthly, period: "/mo" };
}

export function planYearlySavingsPercent(plan: PlanPriceFields): number | null {
  if (plan.priceMonthly <= 0 || plan.priceYearly <= 0 || plan.priceYearly >= plan.priceMonthly) return null;
  return Math.round((1 - plan.priceYearly / plan.priceMonthly) * 100);
}

export function maxPlanYearlySavingsPercent(plans: PlanPriceFields[]): number | null {
  const values = plans.map(planYearlySavingsPercent).filter((v): v is number => v != null && v > 0);
  if (!values.length) return null;
  return Math.max(...values);
}
