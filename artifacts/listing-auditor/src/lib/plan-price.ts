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

/** CTA on white plan cards — explicit colors so dark-mode body text does not wash out on mobile. */
export function planCardCtaClassName(highlighted: boolean): string {
  return highlighted
    ? "w-full mt-auto bg-orange-500 hover:bg-orange-600 text-white border-0"
    : "w-full mt-auto border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900";
}
